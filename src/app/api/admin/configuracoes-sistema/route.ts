import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// GET — retorna as configurações atuais
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { data, error } = await supabase.from('configuracoes_sistema').select('*').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, data })
}

// POST — salva as configurações
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = await req.json()
  const { especiais_deadline, novo_palpite_deadline, minutos_lock_jogo } = body

  // Usa service role para escrever (RLS não tem policy de update pública)
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await service
    .from('configuracoes_sistema')
    .update({
      especiais_deadline:    especiais_deadline    || null,
      novo_palpite_deadline: novo_palpite_deadline || null,
      minutos_lock_jogo:     minutos_lock_jogo     ?? 60,
      atualizado_em:         new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
