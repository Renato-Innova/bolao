import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calcularPontosEspeciais, SPECIAL_POINTS } from '@/utils/scoring'
import type { SpecialResults } from '@/utils/scoring'

// POST /api/admin/especiais
// Body: { campeao?, vice_campeao?, artilheiro?, melhor_jogador?, melhor_goleiro? }
//
// Saves the official special results and recalculates pontos_especiais
// for every active palpite. Safe to call multiple times (idempotent).

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

  const body = await req.json() as Partial<SpecialResults>

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  // 1 — Save official special results (upsert the single row)
  const upsertPayload = { id: 1, ...body, atualizado_em: new Date().toISOString() }

  const { data: upsertData, error: upsertError } = await admin
    .from('resultados_especiais')
    .upsert(upsertPayload, { onConflict: 'id' })
    .select()

  if (upsertError) return NextResponse.json({
    error: upsertError.message,
    debug: { hasServiceKey, body, upsertPayload }
  }, { status: 500 })

  // If upsert returned no rows, it may have silently failed
  if (!upsertData || upsertData.length === 0) {
    return NextResponse.json({
      error: 'Upsert did not return any rows — row may not exist or RLS blocked the write.',
      debug: { hasServiceKey, body, upsertPayload, upsertData }
    }, { status: 500 })
  }

  // 2 — Read back the full resultados_especiais row (other fields may already be set)
  const { data: especiais } = await admin
    .from('resultados_especiais').select('*').eq('id', 1).single()
  if (!especiais) return NextResponse.json({ error: 'Erro ao ler resultados especiais.' }, { status: 500 })

  const resultados: SpecialResults = {
    campeao:        especiais.campeao        ?? null,
    vice_campeao:   especiais.vice_campeao   ?? null,
    artilheiro:     especiais.artilheiro     ?? null,
    melhor_jogador: especiais.melhor_jogador ?? null,
    melhor_goleiro: especiais.melhor_goleiro ?? null,
  }

  // 3 — Fetch admin-configured points per special category (fallback to SPECIAL_POINTS)
  const { data: pontosRows } = await admin
    .from('configuracoes_pontuacao')
    .select('tipo_acerto, pontos')
    .eq('fase', 'ESP')
  const pontosConfig = { ...SPECIAL_POINTS }
  for (const row of pontosRows ?? []) {
    if (row.tipo_acerto in pontosConfig) {
      (pontosConfig as Record<string, number>)[row.tipo_acerto] = row.pontos
    }
  }

  // 4 — Recalculate pontos_especiais for all palpites
  const { data: palpites } = await admin
    .from('palpites')
    .select('id, nome, campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro')

  // nome é incluído pois a tabela exige NOT NULL — o upsert reenvia o valor
  // existente apenas para satisfazer a constraint, o valor não é alterado.
  const updates = (palpites ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    pontos_especiais: calcularPontosEspeciais(p, resultados, pontosConfig),
  }))

  let updatedCount = 0
  if (updates.length > 0) {
    const { error: upsertErr } = await admin
      .from('palpites')
      .upsert(updates, { onConflict: 'id' })
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    updatedCount = updates.length
  }

  revalidateTag('ranking', 'max')

  return NextResponse.json({ ok: true, updatedCount })
}

// GET /api/admin/especiais — read current official special results
export async function GET() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('resultados_especiais').select('*').eq('id', 1).single()
  return NextResponse.json(data ?? {})
}
