import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { atualizarArtilheiros } from '@/app/api/artilheiros/atualizar/route'

// POST /api/admin/artilheiros
// Dispara manualmente a atualização do ranking de artilheiros (football-data.org),
// a mesma rotina que o cron roda automaticamente a cada 30 min.
export async function POST() {
  // Auth check via anon client (reads session cookie)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const result = await atualizarArtilheiros()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
