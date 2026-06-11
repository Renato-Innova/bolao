import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcularPontos } from '@/utils/scoring'

// POST /api/admin/resultado
// Body: { jogoId, placarA, placarB, penaltiA?, penaltiB? }
//
// Saves (or updates) the official result for a match, then recalculates
// points for ALL palpites that have a submitted prediction for this game.
//
// placarA / placarB = score after 90 min + extra time (as per regulation)
// penaltiA / penaltiB = penalty-shootout score (KO only, when 90+ET is a draw)

export async function POST(req: NextRequest) {
  // Auth check via anon client (reads session cookie)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  // All DB writes use admin client (service role) to bypass RLS
  const admin = createAdminClient()

  const body = await req.json() as {
    jogoId: number
    placarA: number
    placarB: number
    penaltiA?: number | null
    penaltiB?: number | null
  }
  const { jogoId, placarA, placarB, penaltiA = null, penaltiB = null } = body

  if (!Number.isInteger(placarA) || !Number.isInteger(placarB) || placarA < 0 || placarB < 0) {
    return NextResponse.json({ error: 'Placar inválido.' }, { status: 400 })
  }

  // Fetch game to determine phase
  const { data: jogo } = await admin
    .from('jogos_copa').select('fase').eq('id', jogoId).single()
  if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado.' }, { status: 404 })

  const isKO = jogo.fase !== 'GS'
  const isDraw = placarA === placarB

  // KO draws must have a valid penalty result with a clear winner
  if (isKO && isDraw) {
    const penA = penaltiA ?? null
    const penB = penaltiB ?? null
    if (penA == null || penB == null || penA === penB) {
      return NextResponse.json({
        error: 'Jogo do mata-mata empatado: informe o placar dos pênaltis com um vencedor.',
      }, { status: 400 })
    }
  }

  // Only store penalty scores when the match was a draw (regulation note 4)
  const finalPenaltiA = isKO && isDraw ? penaltiA : null
  const finalPenaltiB = isKO && isDraw ? penaltiB : null

  // 1 — Save / update the official result
  const { error: resError } = await admin
    .from('resultados')
    .upsert({
      jogo_id: jogoId,
      placar_real_a: placarA,
      placar_real_b: placarB,
      placar_penalti_a: finalPenaltiA,
      placar_penalti_b: finalPenaltiB,
    }, { onConflict: 'jogo_id' })
  if (resError) return NextResponse.json({ error: resError.message }, { status: 500 })

  // 2 — Fetch scoring config for this phase
  const { data: configs } = await admin
    .from('configuracoes_pontuacao')
    .select('tipo_acerto, pontos')
    .eq('fase', jogo.fase)

  const resultado = {
    placar_real_a: placarA,
    placar_real_b: placarB,
    placar_penalti_a: finalPenaltiA,
    placar_penalti_b: finalPenaltiB,
  }

  // 3 — Fetch all submitted palpites for this game and recalculate points
  const { data: palpitesJogos } = await admin
    .from('palpites_jogos')
    .select('id, placar_palpite_a, placar_palpite_b, placar_penalti_a, placar_penalti_b, submitted_at')
    .eq('jogo_id', jogoId)

  let updated = 0
  for (const pj of palpitesJogos ?? []) {
    // Only score submitted predictions with valid scores
    if (!pj.submitted_at || pj.placar_palpite_a == null || pj.placar_palpite_b == null) continue

    const pontos = calcularPontos(
      {
        placar_palpite_a: pj.placar_palpite_a,
        placar_palpite_b: pj.placar_palpite_b,
        placar_penalti_a: pj.placar_penalti_a ?? null,
        placar_penalti_b: pj.placar_penalti_b ?? null,
      },
      resultado,
      isKO,
      configs ?? [],
    )

    await admin.from('palpites_jogos').update({ pontos }).eq('id', pj.id)
    updated++
  }

  // 4 — Salva snapshot diário no ranking_historico para todos os palpites ativos
  // Usa a função RPC para obter a soma correta sem o cap de 1000 linhas do PostgREST
  try {
    const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data: palpitesAtivos } = await admin
      .from('palpites')
      .select('id')
      .eq('status', 'ativo')

    const palpiteIds = (palpitesAtivos ?? []).map((p: { id: number }) => p.id)

    if (palpiteIds.length > 0) {
      const { data: pontosPorPalpite } = await admin
        .rpc('get_pontos_por_palpite', { p_ids: palpiteIds }) as {
          data: { palpite_id: number; total_pontos: number }[] | null
        }

      const pontosMap: Record<number, number> = {}
      for (const r of pontosPorPalpite ?? []) {
        pontosMap[r.palpite_id] = Number(r.total_pontos ?? 0)
      }

      const snapshots = palpiteIds.map((id: number) => ({
        palpite_id:   id,
        data:         todayBRT,
        total_pontos: pontosMap[id] ?? 0,
      }))

      // upsert: atualiza o snapshot do dia se já existir
      await admin
        .from('ranking_historico')
        .upsert(snapshots, { onConflict: 'palpite_id,data' })
    }
  } catch (snapErr) {
    // Snapshot é não-crítico: não falha o request se der erro
    console.warn('[resultado] snapshot ranking_historico error (non-fatal):', snapErr)
  }

  return NextResponse.json({ ok: true, updatedCount: updated })
}
