import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { avatarType, avatarValue } = await request.json()
  if (!avatarType || !avatarValue) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  // Only owner can update their palpite avatar
  const { error } = await supabase
    .from('palpites')
    .update({ avatar_type: avatarType, avatar_value: avatarValue, atualizado_em: new Date().toISOString() })
    .eq('id', parseInt(id, 10))
    .eq('usuario_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
