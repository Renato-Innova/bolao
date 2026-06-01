import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminResultadosClient } from '@/components/admin/AdminResultadosClient'

export const dynamic = 'force-dynamic'

export default async function AdminResultadosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  if (!userData?.is_admin) redirect('/dashboard')

  const { data: jogos } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .order('data', { ascending: true })
    .order('horario', { ascending: true })

  return <AdminResultadosClient jogos={jogos ?? []} />
}
