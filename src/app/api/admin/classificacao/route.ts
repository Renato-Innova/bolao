import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcularBonusClassificacao } from '@/utils/classificacao'

// POST /api/admin/classificacao
//
// Calculates the group-stage classification bonus (20 pts per correctly
// predicted qualifier) for every palpite and saves the result in
// palpites.pontos_classificacao.
//
// Trigger: admin calls this once, after ALL group-stage results are official
// and confirmed in the resultados table.
//
// Official qualifiers are derived from the classificacao_grupos table
// (top 2 from each group + best 8 third-place teams by FIFA tiebreaker).

export async function POST() {
  // Auth check via anon client (reads session cookie)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  // All DB reads/writes use admin client (service role) to bypass RLS
  const admin = createAdminClient()

  // ── 0. Fetch the configured points-per-qualifier (admin-editable) ─────────
  const { data: pontosConfig } = await admin
    .from('configuracoes_pontuacao')
    .select('pontos')
    .eq('fase', 'GS').eq('tipo_acerto', 'classificacao')
    .maybeSingle()
  const pontosPorAcerto = pontosConfig?.pontos ?? 20

  // ── 1. Fetch all group-stage games ────────────────────────────────────────
  const { data: gsJogos, error: jogosErr } = await admin
    .from('jogos_copa')
    .select('id, grupo, time_a, time_b, codigo_pais_a, codigo_pais_b')
    .eq('fase', 'GS')
    .order('data').order('horario')
  if (jogosErr || !gsJogos) return NextResponse.json({ error: 'Erro ao buscar jogos.' }, { status: 500 })

  // ── 2. Determine official qualifiers from classificacao_grupos ────────────
  const { data: classifOficial } = await admin
    .from('classificacao_grupos')
    .select('grupo, pais_nome, pts, dg, m')  // pts, dg=goal_diff, m=goals_for

  if (!classifOficial || classifOficial.length === 0) {
    return NextResponse.json({
      error: 'Tabela classificacao_grupos está vazia. Insira a classificação oficial primeiro.',
    }, { status: 400 })
  }

  // Build official qualifiers set: top 2 per group + best 8 third-place teams.
  // A ordem de inserção em classificacao_grupos não é confiável (a tabela é
  // preenchida manualmente, sem desempate) — por isso cada grupo é reordenado
  // aqui por pts → saldo de gols → gols marcados antes de decidir quem são o
  // 1º e o 2º colocados.
  const byGroup: Record<string, typeof classifOficial> = {}
  for (const row of classifOficial) {
    if (!byGroup[row.grupo]) byGroup[row.grupo] = []
    byGroup[row.grupo].push(row)
  }
  for (const rows of Object.values(byGroup)) {
    rows.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.m - a.m)
  }

  const oficiais = new Set<string>()

  // Top 2 de cada grupo (já ordenado por pts → saldo → gols marcados acima)
  for (const rows of Object.values(byGroup)) {
    if (rows[0]) oficiais.add(rows[0].pais_nome)
    if (rows[1]) oficiais.add(rows[1].pais_nome)
  }

  // Best 8 third-place teams by pts → goal_diff → goals_for
  const thirds = Object.values(byGroup)
    .filter(rows => rows.length >= 3)
    .map(rows => rows[2])
  const best8thirds = [...thirds]
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.m - a.m)
    .slice(0, 8)
  for (const t of best8thirds) oficiais.add(t.pais_nome)

  // ── 3. Fetch all palpites with their GS predictions ───────────────────────
  const { data: palpites } = await admin
    .from('palpites')
    .select('id, nome, palpites_jogos(jogo_id, placar_palpite_a, placar_palpite_b, submitted_at)')

  if (!palpites) return NextResponse.json({ error: 'Erro ao buscar palpites.' }, { status: 500 })

  const gsJogoIds = new Set(gsJogos.map(j => j.id))

  // ── 4. Calculate and save bonus for each palpite ──────────────────────────
  // nome é incluído pois a tabela exige NOT NULL — o upsert reenvia o valor
  // existente apenas para satisfazer a constraint, o valor não é alterado.
  const updates: Array<{ id: number; nome: string; pontos_classificacao: number }> = []

  for (const palpite of palpites) {
    // Build predictions map: jogoId → { a, b } — only submitted GS predictions
    const predicoes: Record<number, { a: number; b: number }> = {}
    for (const pj of (palpite.palpites_jogos ?? []) as Array<{
      jogo_id: number; placar_palpite_a: number | null; placar_palpite_b: number | null; submitted_at: string | null
    }>) {
      if (
        pj.submitted_at &&
        gsJogoIds.has(pj.jogo_id) &&
        pj.placar_palpite_a != null &&
        pj.placar_palpite_b != null
      ) {
        predicoes[pj.jogo_id] = { a: pj.placar_palpite_a, b: pj.placar_palpite_b }
      }
    }

    const pontos_classificacao = calcularBonusClassificacao(gsJogos, predicoes, oficiais, pontosPorAcerto)
    updates.push({ id: palpite.id, nome: palpite.nome, pontos_classificacao })
  }

  let updatedCount = 0
  if (updates.length > 0) {
    const { error: upsertErr } = await admin
      .from('palpites')
      .upsert(updates, { onConflict: 'id' })
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    updatedCount = updates.length
  }

  revalidateTag('ranking', 'max')
  revalidateTag('dashboard', 'max')
  revalidateTag('tabela', 'max')
  revalidatePath('/tabela')

  return NextResponse.json({
    ok: true,
    updatedCount,
    oficiais: [...oficiais].sort(),
  })
}
