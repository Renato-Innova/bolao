import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PalpitesClient } from '@/components/palpites/PalpitesClient'
import { getRanking, getRankingHistoricoCached } from '@/services/ranking'

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

  const [{ data: palpites }, { data: todosJogos }, { data: configs }, { data: sysConfig }, { data: classificacaoGrupos }, ranking] = await Promise.all([
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

    // Classificação final dos grupos — usada no painel "Info" do mata-mata
    supabase
      .from('classificacao_grupos')
      .select('*'),

    getRanking(),
  ])

  // Build variacao map for user's palpites only
  const variacaoMap: Record<number, { variacao: number; variacao_posicao: number; posicao: number; acertos_exatos: number }> = {}
  for (const r of ranking) {
    variacaoMap[r.palpite_id] = { variacao: r.variacao, variacao_posicao: r.variacao_posicao, posicao: r.posicao, acertos_exatos: r.acertos_exatos }
  }

  // Líder do ranking geral — usado no botão "Comparar com TOP 1" do gráfico de pontos/dia
  const topEntry = ranking[0] ?? null

  // Histórico diário (pontos + acertos exatos) para o gráfico de pontos/dia —
  // busca só os palpites do usuário + o líder, para manter a página leve
  const ownIds = (palpites ?? []).map(p => p.id)
  const idsParaHistorico = Array.from(new Set([...ownIds, ...(topEntry ? [topEntry.palpite_id] : [])]))
  const { historico: historicoBase, historicoCompleto: historicoCompletoBase } = idsParaHistorico.length > 0
    ? await getRankingHistoricoCached(idsParaHistorico)
    : { historico: [], historicoCompleto: [] }

  // O snapshot de hoje só é gravado às 23:55 BRT (pg_cron) — se algo for
  // recalculado depois disso (ex: bônus de classificação de grupos rodado de
  // novo durante o dia), o snapshot de hoje fica desatualizado até a próxima
  // meia-noite, fazendo o último ponto do gráfico "cair" em relação a ontem.
  // Como `ranking` (getRanking(), sem cache) já é o total ao vivo, sobrescreve
  // (ou adiciona) a entrada de hoje com esse valor em vez de esperar o cron.
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
  const rankingPorId = new Map(ranking.map(r => [r.palpite_id, r]))
  const historico = [
    ...historicoBase.filter(h => !(idsParaHistorico.includes(h.palpite_id) && h.data === hoje)),
    ...idsParaHistorico.filter(id => rankingPorId.has(id)).map(id => ({
      palpite_id: id, data: hoje, total_pontos: rankingPorId.get(id)!.total_pontos,
    })),
  ]
  const historicoCompleto = [
    ...historicoCompletoBase.filter(h => !(idsParaHistorico.includes(h.palpite_id) && h.data === hoje)),
    ...idsParaHistorico.filter(id => rankingPorId.has(id)).map(id => ({
      palpite_id: id, data: hoje, posicao: rankingPorId.get(id)!.posicao, acertos_exatos: rankingPorId.get(id)!.acertos_exatos,
    })),
  ]

  return (
    <PalpitesClient
      userId={user.id}
      userName={userData?.nome ?? ''}
      palpitesIniciais={palpites ?? []}
      todosJogos={todosJogos ?? []}
      scoringConfigs={configs ?? []}
      classificacaoGrupos={classificacaoGrupos ?? []}
      especiaisDeadline={sysConfig?.especiais_deadline ?? null}
      novoPalpiteDeadline={sysConfig?.novo_palpite_deadline ?? null}
      minutosLockJogo={sysConfig?.minutos_lock_jogo ?? 60}
      variacaoMap={variacaoMap}
      historico={historico}
      historicoCompleto={historicoCompleto}
      topPalpite={topEntry ? { id: topEntry.palpite_id, nome: topEntry.nome } : null}
    />
  )
}
