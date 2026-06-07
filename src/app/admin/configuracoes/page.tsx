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

  const { data: usuarios } = await supabase
    .from('users')
    .select('*')
    .order('criado_em', { ascending: false })

  const { data: palpites } = await supabase
    .from('palpites')
    .select('*, usuario:users(nome, email), palpites_jogos(submitted_at)')
    .order('criado_em', { ascending: false })

  // Use admin client to bypass RLS on resultados_especiais
  const admin = createAdminClient()
  const { data: especiais } = await admin
    .from('resultados_especiais')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  return (
    <AdminConfigClient
      configs={configs ?? []}
      usuarios={usuarios ?? []}
      palpites={palpites ?? []}
      especiais={especiais ?? null}
    />
  )
}
