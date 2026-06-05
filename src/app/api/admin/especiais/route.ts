import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularPontosEspeciais } from '@/utils/scoring'
import type { SpecialResults } from '@/utils/scoring'

// POST /api/admin/especiais
// Body: { campeao?, vice_campeao?, artilheiro?, melhor_jogador?, melhor_goleiro? }
//
// Saves the official special results and recalculates pontos_especiais
// for every active palpite. Safe to call multiple times (idempotent).

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const body = await req.json() as Partial<SpecialResults>

  // 1 — Save official special results (upsert the single row)
  const { error: upsertError } = await supabase
    .from('resultados_especiais')
    .upsert({ id: 1, ...body, atualizado_em: new Date().toISOString() }, { onConflict: 'id' })
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  // 2 — Read back the full resultados_especiais row (other fields may already be set)
  const { data: especiais } = await supabase
    .from('resultados_especiais').select('*').eq('id', 1).single()
  if (!especiais) return NextResponse.json({ error: 'Erro ao ler resultados especiais.' }, { status: 500 })

  const resultados: SpecialResults = {
    campeao:       especiais.campeao       ?? null,
    vice_campeao:  especiais.vice_campeao  ?? null,
    artilheiro:    especiais.artilheiro    ?? null,
    melhor_jogador:especiais.melhor_jogador?? null,
    melhor_goleiro:especiais.melhor_goleiro?? null,
  }

  // 3 — Recalculate pontos_especiais for all palpites that have any special prediction
  const { data: palpites } = await supabase
    .from('palpites')
    .select('id, campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro')

  let updatedCount = 0
  for (const p of palpites ?? []) {
    const pontos_especiais = calcularPontosEspeciais(p, resultados)
    await supabase.from('palpites').update({ pontos_especiais }).eq('id', p.id)
    updatedCount++
  }

  return NextResponse.json({ ok: true, updatedCount })
}

// GET /api/admin/especiais — read current official special results
export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('resultados_especiais').select('*').eq('id', 1).single()
  return NextResponse.json(data ?? {})
}
