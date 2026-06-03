import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getDownstreamPhases, PHASE_ORDER } from '@/services/bracketSlots'

/**
 * GET /api/palpites/[id]/downstream-impact?jogoId=X
 *
 * Returns the number of submitted KO predictions that would be cleared
 * if the user edits their prediction for jogoId, plus which phases are affected.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const palpiteId = parseInt(idStr, 10)
  if (isNaN(palpiteId)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  const jogoIdStr = req.nextUrl.searchParams.get('jogoId')
  const jogoId    = parseInt(jogoIdStr ?? '', 10)
  if (isNaN(jogoId)) {
    return NextResponse.json({ error: 'jogoId inválido.' }, { status: 400 })
  }

  // Auth check
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const admin = await createAdminClient()

  // Verify ownership
  const { data: palpite } = await admin
    .from('palpites')
    .select('usuario_id')
    .eq('id', palpiteId)
    .maybeSingle()

  if (!palpite || palpite.usuario_id !== user.id) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  // Find the phase of the game being edited
  const { data: jogo } = await admin
    .from('jogos_copa')
    .select('fase')
    .eq('id', jogoId)
    .maybeSingle()

  if (!jogo) return NextResponse.json({ error: 'Jogo não encontrado.' }, { status: 404 })

  const downstreamPhases = getDownstreamPhases(jogo.fase)

  if (downstreamPhases.length === 0) {
    return NextResponse.json({ affectedCount: 0, affectedPhases: [] })
  }

  // Count submitted predictions in downstream phases for this palpite
  const { data: downstreamJogos } = await admin
    .from('jogos_copa')
    .select('id')
    .in('fase', downstreamPhases)

  if (!downstreamJogos || downstreamJogos.length === 0) {
    return NextResponse.json({ affectedCount: 0, affectedPhases: [] })
  }

  const jogoIds = downstreamJogos.map(j => j.id)

  const { data: submitted } = await admin
    .from('palpites_jogos')
    .select('jogo_id, jogo:jogos_copa(fase)')
    .eq('palpite_id', palpiteId)
    .in('jogo_id', jogoIds)
    .not('submitted_at', 'is', null)

  const affectedCount = submitted?.length ?? 0

  // Which downstream phases actually have submitted predictions?
  const affectedPhaseSet = new Set<string>()
  for (const pj of submitted ?? []) {
    const fase = (pj.jogo as unknown as { fase: string } | null)?.fase
    if (fase) affectedPhaseSet.add(fase)
  }
  // Return in canonical order
  const affectedPhases = PHASE_ORDER.filter(p => affectedPhaseSet.has(p))

  return NextResponse.json({ affectedCount, affectedPhases })
}
