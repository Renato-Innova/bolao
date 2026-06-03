import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PalpitesClient } from '@/components/palpites/PalpitesClient'

export const dynamic = 'force-dynamic'

export default async function PalpitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Ensure a users row exists
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
      id: user.id, email: user.email!, nome: fallbackNome, is_admin: false,
    }, { onConflict: 'id' })
    userData = { nome: fallbackNome }
  }

  const [{ data: palpites }, { data: todosJogos }] = await Promise.all([
    supabase
      .from('palpites')
      .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
      .eq('usuario_id', user.id)
      .order('criado_em', { ascending: false }),

    // Fetch ALL 104 games — GS for tab 1 + Tabela, knockout for tab 2
    // KO team names are the official ones set by admin (no client-side resolution needed)
    supabase
      .from('jogos_copa')
      .select('*, resultado:resultados(*)')
      .order('data', { ascending: true })
      .order('horario', { ascending: true }),
  ])

  return (
    <PalpitesClient
      userId={user.id}
      userName={userData?.nome ?? ''}
      palpitesIniciais={palpites ?? []}
      todosJogos={todosJogos ?? []}
    />
  )
}
