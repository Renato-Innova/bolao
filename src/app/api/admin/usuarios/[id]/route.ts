import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/admin/usuarios/[id]
// Removes a user from public.users and auth.users.
// Guard: user must have no palpites and must not be admin.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check — only admins can call this
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: caller } = await supabase
    .from('users').select('is_admin').eq('id', user.id).maybeSingle()
  if (!caller?.is_admin)
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id: targetId } = await params

  // Cannot delete yourself
  if (targetId === user.id)
    return NextResponse.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 })

  const admin = createAdminClient()

  // Guard: target must not be admin
  const { data: target } = await admin
    .from('users').select('is_admin, nome').eq('id', targetId).maybeSingle()
  if (!target)
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  if (target.is_admin)
    return NextResponse.json({ error: 'Não é possível excluir contas de administrador.' }, { status: 400 })

  // Guard: user must have no palpites
  const { count } = await admin
    .from('palpites').select('id', { count: 'exact', head: true }).eq('usuario_id', targetId)
  if ((count ?? 0) > 0)
    return NextResponse.json({ error: 'Usuário possui palpites e não pode ser excluído.' }, { status: 400 })

  // Delete from public.users first (FK to auth.users)
  const { error: publicErr } = await admin
    .from('users').delete().eq('id', targetId)
  if (publicErr)
    return NextResponse.json({ error: `Erro ao excluir: ${publicErr.message}` }, { status: 500 })

  // Delete from auth.users
  const { error: authErr } = await admin.auth.admin.deleteUser(targetId)
  if (authErr)
    return NextResponse.json({ error: `Conta excluída do banco mas erro no auth: ${authErr.message}` }, { status: 500 })

  return NextResponse.json({ ok: true })
}
