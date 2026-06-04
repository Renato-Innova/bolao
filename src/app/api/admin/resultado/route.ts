import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWinnerSide, calcularPontos } from '@/utils/scoring'

// POST /api/admin/resultado
// Body: { jogoId, placarA, placarB, penaltiA?, penaltiB? }
// Saves the official result (including optional penalty shootout scores).
// Recalculates points for ALL palpites that have a submitted prediction for
// this game — covers both first-time results and corrections.

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const body = await req.json() as {
    jogoId: number; placarA: number; placarB: number
    penaltiA?: number | null; penaltiB?: number | null
  }
  const { jogoId, placarA, placarB, penaltiA = null, penaltiB = null } = body

  if (!Number.isInteger(placarA) || !Number.isInteger(placarB) || placarA < 0 || placarB < 0) {
    return NextResponse.json({ error: 'Placar inválido.' }, { status: 400 })
  }

  const isDraw = placarA === placarB

  // KO draws must have a penalty result with a winner — block incomplete data
  if (isDraw) {
    const { data: jogoCheck } = await supabase
      .from('jogos_copa').select('fase').eq('id', jogoId).single()
    const isKO = jogoCheck?.fase !== 'GS'

    if (isKO) {
      const penA = penaltiA ?? null
      const penB = penaltiB ?? null
      if (penA == null || penB == null || penA === penB) {
        return NextResponse.json({
          error: 'Jogo do mata-mata empatado: informe o placar dos pênaltis com um vencedor.',
        }, { status: 400 })
      }
    }
  }

  const finalPenaltiA = isDraw ? penaltiA : null
  const finalPenaltiB = isDraw ? penaltiB : null

  // 1 — Save / update the result
  const { error: resError } = await supabase
    .from('resultados')
    .upsert({
      jogo_id: jogoId,
      placar_real_a: placarA,
      placar_real_b: placarB,
      placar_penalti_a: finalPenaltiA,
      placar_penalti_b: finalPenaltiB,
    }, { onConflict: 'jogo_id' })
  if (resError) return NextResponse.json({ error: resError.message }, { status: 500 })

  // 2 — Get game phase for scoring config
  const { data: jogo } = await supabase
    .from('jogos_copa').select('fase').eq('id', jogoId).single()

  const isKO = jogo?.fase !== 'GS'

  // 3 — Fetch all palpites for this game (include penalty predictions)
  const { data: palpitesJogos } = await supabase
    .from('palpites_jogos')
    .select('id, placar_palpite_a, placar_palpite_b, placar_penalti_a, placar_penalti_b')
    .eq('jogo_id', jogoId)

  const { data: configs } = await supabase
    .from('configuracoes_pontuacao').select('tipo_acerto, pontos').eq('fase', jogo?.fase ?? '')

  const resultado = {
    placar_real_a: placarA, placar_real_b: placarB,
    placar_penalti_a: finalPenaltiA, placar_penalti_b: finalPenaltiB,
  }

  // Recalculate points for every palpite that has a submitted prediction
  for (const pj of palpitesJogos ?? []) {
    if (pj.placar_palpite_a == null || pj.placar_palpite_b == null) continue

    const pontos = calcularPontos(
      { placar_palpite_a: pj.placar_palpite_a, placar_palpite_b: pj.placar_palpite_b,
        placar_penalti_a: pj.placar_penalti_a ?? null, placar_penalti_b: pj.placar_penalti_b ?? null },
      resultado,
      isKO,
      configs ?? [],
    )

    await supabase.from('palpites_jogos').update({ pontos }).eq('id', pj.id)
  }

  return NextResponse.json({ ok: true })
}
