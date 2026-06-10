import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/operador/palpites
// Returns all inactive palpites — accessible by operadores and admins.
// Uses admin client to bypass RLS (anon client can only see own palpites).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('is_operador, is_admin').eq('id', user.id).single()
  if (!profile?.is_operador && !profile?.is_admin) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('palpites')
    .select('id, nome, status, criado_em, usuario:users(nome, email)')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
