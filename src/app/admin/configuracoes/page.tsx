import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AdminConfigClient } from '@/components/admin/AdminConfigClient'

export const dynamic = 'force-dynamic'

export default async function AdminConfigPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  if (!userData?.is_admin) redirect('/dashboard')

  const { data: configs } = await supabase
    .from('configuracoes_pontuacao')
    .select('*')
    .order('fase')

  // Admin client needed for auth.users, resultados_especiais, and activity_log
  const admin = createAdminClient()

  const { data: usuariosRaw } = await supabase
    .from('users')
    .select('*')
    .order('nome', { ascending: true })

  // Merge last_sign_in_at from auth.users (requires service role)
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authMap = new Map(authUsers.map(u => [u.id, u.last_sign_in_at ?? null]))
  const usuarios = (usuariosRaw ?? []).map(u => ({
    ...u,
    last_sign_in_at: authMap.get(u.id) ?? null,
  }))

  const { data: palpites } = await supabase
    .from('palpites')
    .select('*, usuario:users(nome, email), palpites_jogos(submitted_at)')
    .order('nome', { ascending: true })
  const { data: especiais } = await admin
    .from('resultados_especiais')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  // Activity log: usuario_id FK points to auth.users (not public.users) so
  // PostgREST can't resolve the join. We fetch without the user join and merge
  // manually using the usuarios list already loaded above.
  const { data: activityLogRaw } = await admin
    .from('palpites_activity_log')
    .select('*, palpite:palpites(nome), jogo:jogos_copa(numero_jogo, time_a, time_b)')
    .order('criado_em', { ascending: false })
    .limit(500)

  const userMap = new Map((usuariosRaw ?? []).map(u => [u.id, { nome: u.nome, email: u.email }]))
  const activityLog = (activityLogRaw ?? []).map(e => ({
    ...e,
    usuario: userMap.get(e.usuario_id ?? '') ?? null,
  }))

  return (
    <AdminConfigClient
      configs={configs ?? []}
      usuarios={usuarios ?? []}
      palpites={palpites ?? []}
      especiais={especiais ?? null}
      activityLog={activityLog}
    />
  )
}
