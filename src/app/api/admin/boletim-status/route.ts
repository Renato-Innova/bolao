import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: ultimo }, { count }] = await Promise.all([
    supabase
      .from('boletim_copa')
      .select('gerado_em, auditoria, conteudo_original, conteudo')
      .order('id', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('boletim_copa')
      .select('*', { count: 'exact', head: true }),
  ])

  if (!ultimo) return NextResponse.json({ data: null })

  return NextResponse.json({
    data: {
      gerado_em: ultimo.gerado_em,
      auditoria: ultimo.auditoria,
      reescrito: ultimo.conteudo !== ultimo.conteudo_original,
      total: count ?? 0,
    },
  })
}
