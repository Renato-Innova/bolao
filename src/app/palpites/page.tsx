import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PalpitesClient } from '@/components/palpites/PalpitesClient'

export const dynamic = 'force-dynamic'

export default async function PalpitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('nome')
    .eq('id', user.id)
    .maybeSingle()

  const { data: palpites } = await supabase
    .from('palpites')
    .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
    .eq('usuario_id', user.id)
    .order('criado_em', { ascending: false })

  // All group-stage matches, chronological order
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
