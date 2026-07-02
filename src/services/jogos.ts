import { unstable_cache } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { ClassificacaoGrupo, JogoCopa } from '@/types'

export async function getJogos(): Promise<JogoCopa[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .order('data', { ascending: true })
    .order('horario', { ascending: true })
  return (data ?? []) as JogoCopa[]
}

export async function getJogosPorFase(fase: string): Promise<JogoCopa[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .eq('fase', fase)
    .order('rodada', { ascending: true })
    .order('data', { ascending: true })
  return (data ?? []) as JogoCopa[]
}

export async function getJogosPorGrupo(grupo: string): Promise<JogoCopa[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .eq('grupo', grupo)
    .order('rodada', { ascending: true })
  return (data ?? []) as JogoCopa[]
}

export async function getProximosJogos(limit = 5): Promise<JogoCopa[]> {
  const supabase = await createClient()
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]  // BRT (UTC-3)
  const { data } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .gte('data', hoje)
    .order('data', { ascending: true })
    .order('horario', { ascending: true })
    .limit(limit)
  return (data ?? []) as JogoCopa[]
}

export async function getUltimosResultados(limit = 5): Promise<JogoCopa[]> {
  const supabase = await createClient()
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]  // BRT (UTC-3)
  const { data } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .lt('data', hoje)
    .not('resultado', 'is', null)
    .order('data', { ascending: false })
    .order('horario', { ascending: false })
    .limit(limit)
  return (data ?? []) as JogoCopa[]
}

// Dados públicos (sem dependência de sessão/cookies) usados na página /tabela —
// cacheados via admin client para evitar 2 round-trips ao Supabase em todo
// page load. Mesmo padrão de getRankingCached() em services/ranking.ts.
async function getTabelaData(): Promise<{ classificacao: ClassificacaoGrupo[]; todosJogos: JogoCopa[] }> {
  const supabase = createAdminClient()
  const [{ data: classificacaoData }, { data: jogosData }] = await Promise.all([
    supabase
      .from('classificacao_grupos')
      .select('*')
      .order('grupo')
      .order('pts',  { ascending: false })
      .order('dg',   { ascending: false })
      .order('m',    { ascending: false }),

    supabase
      .from('jogos_copa')
      .select('*, resultado:resultados(*)')
      .order('data',    { ascending: true })
      .order('horario', { ascending: true }),
  ])

  return {
    classificacao: (classificacaoData ?? []) as ClassificacaoGrupo[],
    todosJogos: (jogosData ?? []) as JogoCopa[],
  }
}

// TTL de 24h é rede de segurança — rotas de admin que mudam jogos/resultados
// chamam revalidateTag('tabela') e a atualização é instantânea. classificacao_grupos
// é mantida em sincronia por um trigger no Postgres (fn_update_classificacao_grupos,
// disparado por INSERT/UPDATE/DELETE em resultados) — sempre que o admin salva
// um resultado via /api/admin/resultado, essa tabela já reflete a mudança
// antes mesmo do revalidateTag('tabela') rodar.
export const getTabelaDataCached = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? unstable_cache(getTabelaData, ['tabela'], { revalidate: 86400, tags: ['tabela'] })
  : getTabelaData
