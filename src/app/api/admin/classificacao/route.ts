import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()

  // Auth + admin guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  // ── 1. Fetch all group-stage games ────────────────────────────────────────
  const { data: gsJogos, error: jogosErr } = await supabase
    .from('jogos_copa')
    .select('id, grupo, time_a, time_b, codigo_pais_a, codigo_pais_b')
    .eq('fase', 'GS')
    .order('data').order('horario')
  if (jogosErr || !gsJogos) return NextResponse.json({ error: 'Erro ao buscar jogos.' }, { status: 500 })

  // ── 2. Determine official qualifiers from classificacao_grupos ────────────
  const { data: classifOficial } = await supabase
    .from('classificacao_grupos')
    .select('grupo, pais_nome, pts, dg, m')  // pts, dg=goal_diff, m=goals_for
    .order('grupo').order('pts', { ascending: false })

  if (!classifOficial || classifOficial.length === 0) {
    return NextResponse.json({
      error: 'Tabela classificacao_grupos está vazia. Insira a classificação oficial primeiro.',
    }, { status: 400 })
  }

  // Build official qualifiers set: top 2 per group + best 8 third-place teams
  const byGroup: Record<string, typeof classifOficial> = {}
  for (const row of classifOficial) {
    if (!byGroup[row.grupo]) byGroup[row.grupo] = []
    byGroup[row.grupo].push(row)
  }

  const oficiais = new Set<string>()

  // Top 2 from each group (already ordered by pts desc)
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
  const { data: palpites } = await supabase
    .from('palpites')
    .select('id, palpites_jogos(jogo_id, placar_palpite_a, placar_palpite_b, submitted_at)')

  if (!palpites) return NextResponse.json({ error: 'Erro ao buscar palpites.' }, { status: 500 })

  const gsJogoIds = new Set(gsJogos.map(j => j.id))

  // ── 4. Calculate and save bonus for each palpite ──────────────────────────
  let updatedCount = 0

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

    const pontos_classificacao = calcularBonusClassificacao(gsJogos, predicoes, oficiais)
    await supabase.from('palpites').update({ pontos_classificacao }).eq('id', palpite.id)
    updatedCount++
  }

  return NextResponse.json({
    ok: true,
    updatedCount,
    oficiais: [...oficiais].sort(),
  })
}
