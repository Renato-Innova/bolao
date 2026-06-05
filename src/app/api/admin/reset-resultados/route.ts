import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/reset-resultados
//
// Clears ALL official results and resets all point counters.
// Palpites and their predictions (palpites_jogos) are preserved.
//
// Resets:
//   • resultados          → all rows deleted
//   • resultados_especiais → all fields set to null
//   • palpites_jogos.pontos          → 0
//   • palpites.pontos_especiais      → 0
//   • palpites.pontos_classificacao  → 0

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  // 1 — Delete all official match results
  const { error: e1 } = await supabase.from('resultados').delete().neq('id', 0)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // 2 — Clear special results (keep the single row, null all fields)
  const { error: e2 } = await supabase
    .from('resultados_especiais')
    .update({ campeao: null, vice_campeao: null, artilheiro: null, melhor_jogador: null, melhor_goleiro: null })
    .eq('id', 1)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // 3 — Zero all game points
  const { error: e3 } = await supabase
    .from('palpites_jogos')
    .update({ pontos: 0 })
    .neq('id', 0)
  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })

  // 4 — Zero special + classification bonus points on every palpite
  const { error: e4 } = await supabase
    .from('palpites')
    .update({ pontos_especiais: 0, pontos_classificacao: 0 })
    .neq('id', 0)
  if (e4) return NextResponse.json({ error: e4.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
