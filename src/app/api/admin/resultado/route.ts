import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/resultado
// Body: { jogoId, placarA, placarB, penaltiA?, penaltiB? }
// Saves the official result (including optional penalty shootout scores).
// Recalculates palpite points using the final winner (penalties decide on draws).

// ── Winner helper ─────────────────────────────────────────────────────────────
// Returns 'A', 'B', or 'E' (empate — should never happen in a completed KO game)
function getWinnerSide(
  a: number, b: number,
  pa: number | null, pb: number | null
): 'A' | 'B' | 'E' {
  if (a > b) return 'A'
  if (b > a) return 'B'
  // Draw at 90 min — decide via penalties
  if (pa != null && pb != null) {
    if (pa > pb) return 'A'
    if (pb > pa) return 'B'
  }
  return 'E'
}

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

  const pontosExato    = configs?.find(c => c.tipo_acerto === 'placar_exato')?.pontos ?? 3
  const pontosVencedor = configs?.find(c => c.tipo_acerto === 'vencedor')?.pontos  ?? 1

  // Actual winner (using penalties for KO draws)
  const actualWinner = getWinnerSide(placarA, placarB, finalPenaltiA, finalPenaltiB)

  for (const pj of palpitesJogos ?? []) {
    if (pj.placar_palpite_a == null || pj.placar_palpite_b == null) continue

    const pPenA = isKO ? (pj.placar_penalti_a ?? null) : null
    const pPenB = isKO ? (pj.placar_penalti_b ?? null) : null

    let pontos = 0

    // Exact score: 90-min scores must match
    if (pj.placar_palpite_a === placarA && pj.placar_palpite_b === placarB) {
      pontos = pontosExato
    } else {
      // Winner: use penalty-aware winner determination for KO games
      const predictedWinner = getWinnerSide(pj.placar_palpite_a, pj.placar_palpite_b, pPenA, pPenB)
      if (actualWinner !== 'E' && actualWinner === predictedWinner) {
        pontos = pontosVencedor
      }
    }

    await supabase.from('palpites_jogos').update({ pontos }).eq('id', pj.id)
  }

  return NextResponse.json({ ok: true })
}
