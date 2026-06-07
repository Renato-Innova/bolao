import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getDownstreamPhases, calculateBracketSlots } from '@/services/bracketSlots'

/**
 * POST /api/palpites/[id]/cascade-clear
 * Body: { jogoId: number }
 *
 * When a user confirms editing an already-submitted prediction:
 *  1. Find the game's phase
 *  2. Nullify (clear submitted_at + scores) for all downstream palpites_jogos
 *  3. Delete bracket_slots for all downstream phases for this palpite
 *  4. Recalculate bracket_slots from scratch
 *  5. Return the list of cleared jogo_ids so the client can update local state
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const palpiteId = parseInt(idStr, 10)
  if (isNaN(palpiteId)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  let body: { jogoId?: number }
  try { body = await req.json() } catch { body = {} }

  const jogoId = typeof body.jogoId === 'number' ? body.jogoId : NaN
  if (isNaN(jogoId)) {
    return NextResponse.json({ error: 'jogoId inválido.' }, { status: 400 })
  }

  // Auth check
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const admin = createAdminClient()

  // Verify ownership
  const { data: palpite } = await admin
    .from('palpites')
    .select('usuario_id')
    .eq('id', palpiteId)
    .maybeSingle()

  if (!palpite || palpite.usuario_id !== user.id) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  // Find phase of the game being edited
  const { data: jogo } = await admin
    .from('jogos_copa')
    .select('fase')
    .eq('id', jogoId)
    .maybeSingle()

  if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado.' }, { status: 404 })

  const downstreamPhases = getDownstreamPhases(jogo.fase)

  let clearedJogoIds: number[] = []

  if (downstreamPhases.length > 0) {
    // Get all downstream jogo_ids
    const { data: downstreamJogos } = await admin
      .from('jogos_copa')
      .select('id')
      .in('fase', downstreamPhases)

    if (downstreamJogos && downstreamJogos.length > 0) {
      const ids = downstreamJogos.map(j => j.id)

      // Clear submitted_at and scores for downstream predictions
      await admin
        .from('palpites_jogos')
        .update({
          submitted_at:     null,
          placar_palpite_a: null,
          placar_palpite_b: null,
        })
        .eq('palpite_id', palpiteId)
        .in('jogo_id', ids)
        .not('submitted_at', 'is', null)

      clearedJogoIds = ids
    }

    // Delete all bracket_slots for this palpite in the downstream phases
    // (we can't easily filter by phase in bracket_slots without a join, so delete all
    //  for this palpite and let recalculate rebuild them)
    await admin
      .from('bracket_slots')
      .delete()
      .eq('palpite_id', palpiteId)
      .in('jogo_id',
        (await admin
          .from('jogos_copa')
          .select('id')
          .in('fase', downstreamPhases)
          .then(r => (r.data ?? []).map(j => j.id))
        )
      )
  }

  // Recalculate bracket_slots for this palpite from scratch
  try {
    await calculateBracketSlots(palpiteId, admin)
  } catch {
    // Non-fatal — bracket_slots will be recalculated on next load
  }

  return NextResponse.json({ ok: true, clearedJogoIds })
}
