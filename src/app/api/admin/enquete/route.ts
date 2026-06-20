import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, boolean | string | null> = {}
  if (typeof body.aberta === 'boolean') updates.aberta = body.aberta
  if (typeof body.resultado_visivel === 'boolean') updates.resultado_visivel = body.resultado_visivel
  if (typeof body.decisao_visivel === 'boolean') updates.decisao_visivel = body.decisao_visivel
  if (typeof body.decisao_titulo === 'string') updates.decisao_titulo = body.decisao_titulo
  if (typeof body.decisao_texto === 'string') updates.decisao_texto = body.decisao_texto

  const admin = createAdminClient()
  const { error } = await admin
    .from('enquete_config')
    .upsert({ id: 1, ...updates }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
