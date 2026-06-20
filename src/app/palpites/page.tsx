import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PalpitesClient } from '@/components/palpites/PalpitesClient'
import { getRanking } from '@/services/ranking'

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

  const [{ data: palpites }, { data: todosJogos }, { data: configs }, { data: sysConfig }, ranking] = await Promise.all([
    supabase
      .from('palpites')
      .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
      .eq('usuario_id', user.id)
      .order('status', { ascending: true })   // 'ativo' < 'inativo' alphabetically → ativos first
      .order('criado_em', { ascending: false }),

    // Fetch ALL 104 games — GS for tab 1 + Tabela, knockout for tab 2
    supabase
      .from('jogos_copa')
      .select('*, resultado:resultados(*)')
      .order('data', { ascending: true })
      .order('horario', { ascending: true }),

    // Scoring config for the Pontuação tab
    supabase
      .from('configuracoes_pontuacao')
      .select('fase, tipo_acerto, pontos'),

    // System config: deadlines + lock minutes
    supabase
      .from('configuracoes_sistema')
      .select('especiais_deadline, novo_palpite_deadline, minutos_lock_jogo')
      .eq('id', 1)
      .maybeSingle(),

    getRanking(),
  ])

  // Build variacao map for user's palpites only
  const variacaoMap: Record<number, { variacao: number; variacao_posicao: number; posicao: number; acertos_exatos: number }> = {}
  for (const r of ranking) {
    variacaoMap[r.palpite_id] = { variacao: r.variacao, variacao_posicao: r.variacao_posicao, posicao: r.posicao, acertos_exatos: r.acertos_exatos }
  }

  return (
    <PalpitesClient
      userId={user.id}
      userName={userData?.nome ?? ''}
      palpitesIniciais={palpites ?? []}
      todosJogos={todosJogos ?? []}
      scoringConfigs={configs ?? []}
      especiaisDeadline={sysConfig?.especiais_deadline ?? null}
      novoPalpiteDeadline={sysConfig?.novo_palpite_deadline ?? null}
      minutosLockJogo={sysConfig?.minutos_lock_jogo ?? 60}
      variacaoMap={variacaoMap}
    />
  )
}
