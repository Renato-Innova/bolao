import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getRanking } from '@/services/ranking'
import type { JogoCopa, ClassificacaoGrupo, RankingEntry } from '@/types'

export type DashboardSharedData = {
  totalAtivos: number | null
  totalUsuarios: number | null
  totalJogos: number | null
  jogosRealizados: number | null
  proximosJogos: JogoCopa[]
  ultimosResultados: JogoCopa[]
  ranking: RankingEntry[]
  grupoJogos: ClassificacaoGrupo[]
  boletins: { id: number; tipo: string; titulo: string; conteudo: string; gerado_em: string }[]
  totalBoletins: number | null
  artilheiros: { id: number; jogador: string; seleção: string; escudo_url: string | null; gols: number; assistencias: number | null; penaltis: number | null; jogos: number; atualizado_em: string }[]
  pontuacaoResumo: { fase: string; tipo: string; pontos_unitario: number; pontos_max: number }[]
  jogosPorFase: { fase: string; resultado: unknown }[]
  maiorClassifRow: { pontos_classificacao: number }[]
  jogosKOTodos: JogoCopa[]
  palpitesProximos: { jogo_id: number; placar_palpite_a: number; placar_palpite_b: number }[]
}

// Tudo que aparece no dashboard e NÃO depende do usuário logado — mesmos
// dados para todo visitante. Cacheado via admin client (sem cookies) para
// evitar refazer ~14 round-trips ao Supabase em todo page load. As partes
// pessoais (jogos pendentes do usuário) seguem sendo buscadas ao vivo em
// dashboard/page.tsx.
async function getDashboardSharedData(): Promise<DashboardSharedData> {
  const supabase = createAdminClient()
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { count: totalAtivos },
    { count: totalUsuarios },
    { count: totalJogos },
    { count: jogosRealizados },
    { data: proximosJogos },
    { data: ultimosResultados },
    ranking,
    { data: grupoJogos },
    { data: boletins },
    { count: totalBoletins },
    { data: artilheiros },
    { data: pontuacaoResumo },
    { data: jogosPorFase },
    { data: maiorClassifRow },
    { data: jogosKOTodos },
  ] = await Promise.all([
    supabase.from('palpites').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa').select('*', { count: 'exact', head: true }),
    supabase.from('resultados').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').gte('data', hoje).order('data').order('horario').limit(8),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').not('resultado', 'is', null).order('data', { ascending: false }).order('horario', { ascending: false }).limit(20),
    getRanking(),
    supabase.from('classificacao_grupos').select('*').order('grupo').order('pts', { ascending: false }).order('dg', { ascending: false }).order('m', { ascending: false }),
    supabase.from('boletim_copa').select('*').order('gerado_em', { ascending: false }).limit(10),
    supabase.from('boletim_copa').select('*', { count: 'exact', head: true }),
    supabase.from('artilheiros_copa').select('*').order('gols', { ascending: false }).order('assistencias', { ascending: false }).limit(10),
    supabase.from('pontuacao_resumo').select('fase, tipo, pontos_unitario, pontos_max'),
    supabase.from('jogos_copa').select('fase, resultado:resultados(id)'),
    supabase.from('palpites').select('pontos_classificacao').eq('status', 'ativo')
      .order('pontos_classificacao', { ascending: false }).limit(1),
    supabase.from('jogos_copa')
      .select('id, numero_jogo, fase, data, horario, time_a, time_b, codigo_pais_a, codigo_pais_b, resultado:resultados(placar_real_a, placar_real_b, placar_penalti_a, placar_penalti_b)')
      .neq('fase', 'GS')
      .order('numero_jogo'),
  ])

  // Contagem de palpites para próximos jogos (vitória A / empate / vitória B)
  // — não depende do usuário logado, só dos jogos próximos, então entra no
  // mesmo lote cacheado.
  const proximosIds = (proximosJogos ?? []).map((j: JogoCopa) => j.id)
  let palpitesProximos: { jogo_id: number; placar_palpite_a: number; placar_palpite_b: number }[] = []
  if (proximosIds.length > 0) {
    const { data: pjData } = await supabase
      .from('palpites_jogos')
      .select('jogo_id, placar_palpite_a, placar_palpite_b')
      .in('jogo_id', proximosIds)
      .not('submitted_at', 'is', null)
    palpitesProximos = pjData ?? []
  }

  return {
    totalAtivos, totalUsuarios, totalJogos, jogosRealizados,
    proximosJogos: (proximosJogos ?? []) as JogoCopa[],
    ultimosResultados: (ultimosResultados ?? []) as JogoCopa[],
    ranking,
    grupoJogos: (grupoJogos ?? []) as ClassificacaoGrupo[],
    boletins: boletins ?? [],
    totalBoletins,
    artilheiros: artilheiros ?? [],
    pontuacaoResumo: pontuacaoResumo ?? [],
    jogosPorFase: jogosPorFase ?? [],
    maiorClassifRow: maiorClassifRow ?? [],
    jogosKOTodos: (jogosKOTodos ?? []) as unknown as JogoCopa[],
    palpitesProximos,
  }
}

// TTL de 24h é rede de segurança — toda rota de admin que muda dados usados
// aqui (resultado, recalcular, classificação, especiais, chave, boletim,
// artilheiros) chama revalidateTag('dashboard'), e o snapshot diário do
// ranking é coberto pelo cron /api/cron/revalidate-ranking. Atualização
// sempre instantânea; o TTL nunca deveria ser realmente acionado.
export const getDashboardSharedDataCached = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? unstable_cache(getDashboardSharedData, ['dashboard-shared'], { revalidate: 86400, tags: ['dashboard', 'ranking'] })
  : getDashboardSharedData
