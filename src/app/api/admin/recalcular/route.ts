import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcularPontos, type PontuacaoConfig } from '@/utils/scoring'

// POST /api/admin/recalcular
//
// Recalculates palpites_jogos.pontos for EVERY submitted prediction
// that has an official result. Safe to run multiple times (idempotent).
//
// Useful after:
//   • Scoring rule changes (new regulation values)
//   • Old palpites created before the scoring overhaul
//   • Manual corrections to official results

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

  // 1 — Fetch all games that have an official result
  const { data: jogos } = await admin
    .from('jogos_copa')
    .select('id, fase, resultado:resultados(placar_real_a, placar_real_b, placar_penalti_a, placar_penalti_b)')
    .not('resultado', 'is', null)

  if (!jogos || jogos.length === 0) {
    return NextResponse.json({ ok: true, updatedCount: 0, message: 'Nenhum resultado oficial encontrado.' })
  }

  // 2 — Fetch all scoring configs once
  const { data: allConfigs } = await admin
    .from('configuracoes_pontuacao')
    .select('fase, tipo_acerto, pontos')

  // Build config map: fase → configs[]
  const configsByFase: Record<string, PontuacaoConfig[]> = {}
  for (const c of allConfigs ?? []) {
    if (!configsByFase[c.fase]) configsByFase[c.fase] = []
    configsByFase[c.fase].push({ tipo_acerto: c.tipo_acerto, pontos: c.pontos })
  }

  // 3 — Fetch ALL submitted predictions for ALL games-with-result in a single
  // query (avoids N+1: antes fazia uma query por jogo, agora é uma só, com
  // os resultados agrupados em memória).
  const jogoIds = jogos.map(j => j.id)
  const { data: todosPalpitesJogos } = await admin
    .from('palpites_jogos')
    .select('id, jogo_id, placar_palpite_a, placar_palpite_b, placar_penalti_a, placar_penalti_b, submitted_at')
    .in('jogo_id', jogoIds)

  const palpitesJogosPorJogo: Record<number, typeof todosPalpitesJogos> = {}
  for (const pj of todosPalpitesJogos ?? []) {
    if (!palpitesJogosPorJogo[pj.jogo_id]) palpitesJogosPorJogo[pj.jogo_id] = []
    palpitesJogosPorJogo[pj.jogo_id]!.push(pj)
  }

  // 4 — For each game with a result, recalculate all submitted predictions
  const updates: Array<{ id: number; pontos: number }> = []

  for (const jogo of jogos) {
    const resultado = Array.isArray(jogo.resultado) ? jogo.resultado[0] : jogo.resultado
    if (!resultado) continue

    const isKO = jogo.fase !== 'GS'
    const configs = configsByFase[jogo.fase] ?? []

    for (const pj of palpitesJogosPorJogo[jogo.id] ?? []) {
      if (!pj.submitted_at || pj.placar_palpite_a == null || pj.placar_palpite_b == null) continue

      const pontos = calcularPontos(
        {
          placar_palpite_a: pj.placar_palpite_a,
          placar_palpite_b: pj.placar_palpite_b,
          placar_penalti_a: pj.placar_penalti_a ?? null,
          placar_penalti_b: pj.placar_penalti_b ?? null,
        },
        {
          placar_real_a: resultado.placar_real_a,
          placar_real_b: resultado.placar_real_b,
          placar_penalti_a: resultado.placar_penalti_a ?? null,
          placar_penalti_b: resultado.placar_penalti_b ?? null,
        },
        isKO,
        configs,
      )

      updates.push({ id: pj.id, pontos })
    }
  }

  // 5 — Batched upserts (chunks de 500) em vez de um upsert por jogo — reduz
  // drasticamente os round-trips (antes: 1 por jogo, ~50+; agora: 1 a cada
  // 500 linhas) sem arriscar payload gigante numa chamada só.
  let updatedCount = 0
  const CHUNK_SIZE = 500
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE)
    const { error: upsertErr } = await admin
      .from('palpites_jogos')
      .upsert(chunk, { onConflict: 'id' })
    if (upsertErr) {
      return NextResponse.json({ error: `Erro ao atualizar pontos: ${upsertErr.message}` }, { status: 500 })
    }
    updatedCount += chunk.length
  }

  revalidateTag('ranking', 'max')
  revalidateTag('dashboard', 'max')
  revalidateTag('tabela', 'max')
  revalidatePath('/tabela')

  return NextResponse.json({
    ok: true,
    updatedCount,
    jogosComResultado: jogos.length,
  })
}
