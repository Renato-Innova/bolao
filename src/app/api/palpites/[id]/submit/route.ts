import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularPontos } from '@/utils/scoring'

// POST /api/palpites/[id]/submit
// Body: { jogoId, placarA, placarB, penaltiA?, penaltiB? }
//
// Saves (or updates) the user's match prediction and immediately calculates
// points if the admin has already entered the official result.
// Handles late submissions and re-submissions after admin corrections.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: idStr } = await params
  const palpiteId = parseInt(idStr, 10)
  if (isNaN(palpiteId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  // Validate ownership
  const { data: palpite } = await supabase
    .from('palpites').select('usuario_id').eq('id', palpiteId).maybeSingle()
  if (!palpite) return NextResponse.json({ error: 'Palpite não encontrado.' }, { status: 404 })
  if (palpite.usuario_id !== user.id)
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

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

  const now = new Date().toISOString()

  // Fetch game info (fase + horário para checar lock)
  const { data: jogo } = await supabase
    .from('jogos_copa').select('fase, data, horario').eq('id', jogoId).single()
  if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado.' }, { status: 404 })

  // Check lock: impede edição X minutos antes do jogo
  const { data: sysConfig } = await supabase
    .from('configuracoes_sistema').select('minutos_lock_jogo').eq('id', 1).maybeSingle()
  const minutosLock = sysConfig?.minutos_lock_jogo ?? 60
  if (jogo.data && jogo.horario) {
    const kickoff = new Date(`${jogo.data}T${jogo.horario}-03:00`).getTime()
    const lockMs  = minutosLock * 60 * 1000
    if (Date.now() >= kickoff - lockMs) {
      return NextResponse.json(
        { error: `Edição encerrada: prazo de ${minutosLock} min antes do jogo expirou.` },
        { status: 403 }
      )
    }
  }

  const isKO = jogo.fase !== 'GS'
  const isDraw = placarA === placarB

  // Only store penalty prediction when it's a KO draw
  const finalPenaltiA = isKO && isDraw ? penaltiA : null
  const finalPenaltiB = isKO && isDraw ? penaltiB : null

  // Check if the official result already exists for immediate scoring
  const { data: resultado } = await supabase
    .from('resultados')
    .select('placar_real_a, placar_real_b, placar_penalti_a, placar_penalti_b')
    .eq('jogo_id', jogoId)
    .maybeSingle()

  let pontos = 0
  if (resultado) {
    // Result is already known — calculate points immediately
    const { data: configs } = await supabase
      .from('configuracoes_pontuacao')
      .select('tipo_acerto, pontos')
      .eq('fase', jogo.fase)

    pontos = calcularPontos(
      {
        placar_palpite_a: placarA,
        placar_palpite_b: placarB,
        placar_penalti_a: finalPenaltiA,
        placar_penalti_b: finalPenaltiB,
      },
      resultado,
      isKO,
      configs ?? [],
    )
  }

  // Upsert prediction + computed points
  const { error } = await supabase.from('palpites_jogos').upsert({
    palpite_id: palpiteId,
    jogo_id: jogoId,
    placar_palpite_a: placarA,
    placar_palpite_b: placarB,
    placar_penalti_a: finalPenaltiA,
    placar_penalti_b: finalPenaltiB,
    submitted_at: now,
    pontos,
  }, { onConflict: 'palpite_id,jogo_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, pontos, submittedAt: now })
}
