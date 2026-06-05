import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// PATCH /api/operador/ativar  { palpiteId: number }
// Only accessible by users with is_operador = true (or is_admin = true)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  // Check operador or admin permission
  const { data: profile } = await supabase
    .from('users').select('is_operador, is_admin').eq('id', user.id).single()
  if (!profile?.is_operador && !profile?.is_admin) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { palpiteId } = await req.json()
  if (!palpiteId) return NextResponse.json({ error: 'palpiteId obrigatório.' }, { status: 400 })

  // Use admin client to bypass RLS for status update
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('palpites')
    .update({ status: 'ativo' })
    .eq('id', palpiteId)
    .eq('status', 'inativo')
    .select('id, nome, status')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Palpite não encontrado ou já ativo.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, palpite: data })
}
