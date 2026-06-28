import { unstable_cache } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { RankingEntry } from '@/types'

export async function getRanking(): Promise<RankingEntry[]> {
  // Prefer admin client (bypasses RLS); fall back to anon client if key is missing
  const hasAdminKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = hasAdminKey ? createAdminClient() : await createClient()

  // Step 1 — fetch active palpites (no joins, maximum compatibility)
  const { data: palpites, error: errP } = await supabase
    .from('palpites')
    .select('id, nome, usuario_id, avatar_type, avatar_value, pontos_especiais, pontos_classificacao')
    .eq('status', 'ativo')

  if (errP) {
    console.error('[getRanking] palpites error:', errP.message, errP.code)
    return []
  }
  if (!palpites || palpites.length === 0) {
    return []
  }

  const palpiteIds = palpites.map((p: { id: number }) => p.id)

  // Step 2 — aggregate points and exact-score hits per palpite via RPC
  // (avoids PostgREST max_rows=1000 cap — both functions aggregate in DB)
  const [{ data: jogos, error: errJ }, { data: acertosData }] = await Promise.all([
    supabase.rpc('get_pontos_por_palpite', { p_ids: palpiteIds }),
    supabase.rpc('get_acertos_exatos_por_palpite', { p_ids: palpiteIds }),
  ])

  if (errJ) {
    console.warn('[getRanking] get_pontos_por_palpite error (non-fatal):', errJ.message)
  }

  // Step 3 — fetch user names
  const userIds = [...new Set(palpites.map((p: { usuario_id: string }) => p.usuario_id))]
  const { data: users, error: errU } = await supabase
    .from('users')
    .select('id, nome')
    .in('id', userIds)

  if (errU) {
    console.warn('[getRanking] users error (non-fatal):', errU.message)
  }

  // Step 4 — fetch the most recent snapshot before today for daily variation
  // Usa BRT (UTC-3), igual ao resto do app — usar UTC aqui faria "hoje" virar
  // o dia seguinte entre 21h e 23h59 BRT, incluindo o snapshot de hoje como se
  // fosse "ontem" e zerando a variação de todo mundo nessa janela diária.
  const todayStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: historico } = await supabase
    .from('ranking_historico')
    .select('palpite_id, total_pontos')
    .lt('data', todayStr)
    .in('palpite_id', palpiteIds)
    .order('data', { ascending: false })
    .limit(palpiteIds.length)

  // Build lookup maps
  const pontosPorPalpite: Record<number, number> = {}
  for (const j of (jogos ?? [])) {
    pontosPorPalpite[j.palpite_id] = Number(j.total_pontos ?? 0)
  }
  const acertosPorPalpite: Record<number, number> = {}
  for (const a of (acertosData ?? [])) {
    acertosPorPalpite[a.palpite_id] = Number(a.acertos_exatos ?? 0)
  }
  const nomeUsuario: Record<string, string> = {}
  for (const u of (users ?? [])) {
    nomeUsuario[u.id] = u.nome
  }
  const pontosOntem: Record<number, number> = {}
  for (const h of (historico ?? [])) {
    pontosOntem[h.palpite_id] = h.total_pontos
  }

  // Calculate yesterday's ranking positions from snapshot
  // Sort by yesterday's points descending → position = index + 1
  const posicaoOntem: Record<number, number> = {}
  if (historico && historico.length > 0) {
    const sorted = [...historico].sort((a, b) => b.total_pontos - a.total_pontos)
    sorted.forEach((h, i) => { posicaoOntem[h.palpite_id] = i + 1 })
  }

  const entries: RankingEntry[] = palpites.map((p: Record<string, unknown>) => {
    const id         = p.id as number
    // total = pontos de jogo + especiais (campeão, artilheiro...) + bônus de classificação
    // de grupos — mesma fórmula usada pelos snapshots em ranking_historico(_completo)
    const pontosHoje = (pontosPorPalpite[id] ?? 0)
      + Number(p.pontos_especiais ?? 0)
      + Number(p.pontos_classificacao ?? 0)
    const variacao          = id in pontosOntem ? pontosHoje - pontosOntem[id] : 0
    // variacao_posicao: positive means moved UP (lower number = better position)
    const variacao_posicao  = 0 // filled in after sort below
    return {
      posicao:          0,
      palpite_id:       id,
      nome:             p.nome as string,
      usuario_nome:     nomeUsuario[p.usuario_id as string] ?? '',
      usuario_id:       p.usuario_id as string,
      total_pontos:     pontosHoje,
      acertos_exatos:   acertosPorPalpite[id] ?? 0,
      acertos_vencedor: 0,
      variacao,
      variacao_posicao,
      avatar_type:      p.avatar_type as string | null,
      avatar_value:     p.avatar_value as string | null,
    }
  })

  // Desempate: 1º acertos de placar exato, 2º palpite_id (estável/determinístico)
  entries.sort((a, b) =>
    b.total_pontos - a.total_pontos ||
    b.acertos_exatos - a.acertos_exatos ||
    a.palpite_id - b.palpite_id
  )
  entries.forEach((e, i) => {
    e.posicao = i + 1
    // positive = moved up in ranking (e.g. was 5th yesterday, now 3rd → +2)
    if (e.palpite_id in posicaoOntem) {
      e.variacao_posicao = posicaoOntem[e.palpite_id] - e.posicao
    }
  })

  return entries
}

// Versão com cache: o ranking é o mesmo para todos os usuários, então não
// precisa ser recalculado em toda página/navegação. unstable_cache só pode
// envolver código que não lê cookies — por isso só fica ativo quando a
// service-role key está configurada (caminho que usa createAdminClient,
// sem depender da sessão do usuário). Sem a key, cai no cálculo ao vivo.
export const getRankingCached = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? unstable_cache(getRanking, ['ranking'], { revalidate: 20, tags: ['ranking'] })
  : getRanking
