import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PalpitesClient } from '@/components/palpites/PalpitesClient'

export const dynamic = 'force-dynamic'

export default async function PalpitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Ensure a users row exists — handles accounts created via Supabase dashboard
  // or cases where the register insert failed silently.
  let { data: userData } = await supabase
    .from('users')
    .select('nome')
    .eq('id', user.id)
    .maybeSingle()

  if (!userData) {
    const fallbackNome = (user.user_metadata?.full_name as string | undefined)
      ?? user.email?.split('@')[0]
      ?? 'Usuário'
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email!,
      nome: fallbackNome,
      is_admin: false,
    }, { onConflict: 'id' })
    userData = { nome: fallbackNome }
  }

  const { data: palpites } = await supabase
    .from('palpites')
    .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
    .eq('usuario_id', user.id)
    .order('criado_em', { ascending: false })

  const { data: todosJogos } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .eq('fase', 'grupos')
    .order('data', { ascending: true })
    .order('horario', { ascending: true })

  return (
    <PalpitesClient
      userId={user.id}
      userName={userData?.nome ?? ''}
      palpitesIniciais={palpites ?? []}
      todosJogos={todosJogos ?? []}
    />
  )
}
