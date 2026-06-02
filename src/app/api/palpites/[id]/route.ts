import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  // Identify the caller
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  // Validate ownership and inactive status via admin client (bypasses RLS)
  const admin = await createAdminClient()
  const { data: palpite } = await admin
    .from('palpites')
    .select('id, usuario_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!palpite) {
    return NextResponse.json({ error: 'Palpite não encontrado.' }, { status: 404 })
  }
  if (palpite.usuario_id !== user.id) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }
  if (palpite.status === 'ativo') {
    return NextResponse.json({ error: 'Palpites ativos não podem ser excluídos.' }, { status: 400 })
  }

  // ON DELETE CASCADE on palpites_jogos handles child rows automatically
  const { error } = await admin.from('palpites').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
