import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/resultado
// Body: { jogoId, placarA, placarB }
// Saves the result using the caller's authenticated session, which is allowed
// by the "admin_manage_resultados" RLS policy (see 10_rls_admin_policies.sql).
// Points are recalculated for all palpites on that game.

export async function POST(req: NextRequest) {
  // One client — uses the caller's session cookie, which satisfies the
  // admin RLS policy (auth.uid() matches a user with is_admin = true).
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  // Verify admin flag
  const { data: userData } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const body = await req.json() as { jogoId: number; placarA: number; placarB: number }
  const { jogoId, placarA, placarB } = body

  if (
    !Number.isInteger(placarA) || !Number.isInteger(placarB) ||
    placarA < 0 || placarB < 0
  ) {
    return NextResponse.json({ error: 'Placar inválido.' }, { status: 400 })
  }

  // 1 — Save / update the result (allowed by admin RLS policy)
  const { error: resError } = await supabase
    .from('resultados')
    .upsert(
      { jogo_id: jogoId, placar_real_a: placarA, placar_real_b: placarB },
      { onConflict: 'jogo_id' }
    )
  if (resError) return NextResponse.json({ error: resError.message }, { status: 500 })

  // 2 — Recalculate points for every palpite on this game
  const { data: jogo } = await supabase
    .from('jogos_copa')
    .select('fase')
    .eq('id', jogoId)
    .single()

  const { data: palpitesJogos } = await supabase
    .from('palpites_jogos')
    .select('id, placar_palpite_a, placar_palpite_b')
    .eq('jogo_id', jogoId)

  const { data: configs } = await supabase
    .from('configuracoes_pontuacao')
    .select('tipo_acerto, pontos')
    .eq('fase', jogo?.fase ?? '')

  const pontosExato    = configs?.find(c => c.tipo_acerto === 'placar_exato')?.pontos ?? 3
  const pontosVencedor = configs?.find(c => c.tipo_acerto === 'vencedor')?.pontos  ?? 1

  for (const pj of palpitesJogos ?? []) {
    if (pj.placar_palpite_a == null || pj.placar_palpite_b == null) continue
    let pontos = 0
    if (pj.placar_palpite_a === placarA && pj.placar_palpite_b === placarB) {
      pontos = pontosExato
    } else {
      const vR = placarA > placarB ? 'A' : placarA < placarB ? 'B' : 'E'
      const vP = pj.placar_palpite_a > pj.placar_palpite_b ? 'A'
               : pj.placar_palpite_a < pj.placar_palpite_b ? 'B' : 'E'
      if (vR === vP) pontos = pontosVencedor
    }
    await supabase.from('palpites_jogos').update({ pontos }).eq('id', pj.id)
  }

  return NextResponse.json({ ok: true })
}
