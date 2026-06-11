import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { RankingEntry } from '@/types'

export async function getRanking(): Promise<RankingEntry[]> {
  // Prefer admin client (bypasses RLS); fall back to anon client if key is missing
  const hasAdminKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = hasAdminKey ? createAdminClient() : await createClient()

  console.log('[getRanking] using', hasAdminKey ? 'admin' : 'anon', 'client')

  // Step 1 — fetch active palpites (no joins, maximum compatibility)
  const { data: palpites, error: errP } = await supabase
    .from('palpites')
    .select('id, nome, usuario_id, avatar_type, avatar_value')
    .eq('status', 'ativo')

  if (errP) {
    console.error('[getRanking] palpites error:', errP.message, errP.code)
    return []
  }
  if (!palpites || palpites.length === 0) {
    console.log('[getRanking] no active palpites found')
    return []
  }

  console.log('[getRanking] found', palpites.length, 'active palpites')

  const palpiteIds = palpites.map((p: { id: number }) => p.id)

  // Step 2 — aggregate points per palpite via RPC (avoids PostgREST max_rows=1000 cap)
  // A query REST simples retorna no máximo 1000 linhas mesmo com .limit() maior;
  // a função SQL agrega no banco e retorna 1 linha por palpite, sem toque no cap.
  const { data: jogos, error: errJ } = await supabase
    .rpc('get_pontos_por_palpite', { p_ids: palpiteIds })

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
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: historico } = await supabase
    .from('ranking_historico')
    .select('palpite_id, total_pontos')
    .lt('data', todayStr)
    .in('palpite_id', palpiteIds)
    .order('data', { ascending: false })
    .limit(palpiteIds.length)

  // Build lookup maps
  // RPC retorna 1 linha por palpite com total_pontos já somado
  const pontosPorPalpite: Record<number, number> = {}
  for (const j of (jogos ?? [])) {
    pontosPorPalpite[j.palpite_id] = Number(j.total_pontos ?? 0)
  }
  const nomeUsuario: Record<string, string> = {}
  for (const u of (users ?? [])) {
    nomeUsuario[u.id] = u.nome
  }
  const pontosOntem: Record<number, number> = {}
  for (const h of (historico ?? [])) {
    pontosOntem[h.palpite_id] = h.total_pontos
  }

  console.log('[getRanking] todayStr:', todayStr, '| historico rows:', historico?.length ?? 0, '| sample:', JSON.stringify(historico?.[0]))
  console.log('[getRanking] pontosOntem sample:', JSON.stringify(Object.entries(pontosOntem).slice(0, 3)))
  console.log('[getRanking] pontosHoje sample:', JSON.stringify(Object.entries(pontosPorPalpite).slice(0, 3)))

  // Calculate yesterday's ranking positions from snapshot
  // Sort by yesterday's points descending → position = index + 1
  const posicaoOntem: Record<number, number> = {}
  if (historico && historico.length > 0) {
    const sorted = [...historico].sort((a, b) => b.total_pontos - a.total_pontos)
    sorted.forEach((h, i) => { posicaoOntem[h.palpite_id] = i + 1 })
  }

  const entries: RankingEntry[] = palpites.map((p: Record<string, unknown>) => {
    const id         = p.id as number
    const pontosHoje = pontosPorPalpite[id] ?? 0
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
      acertos_exatos:   0,
      acertos_vencedor: 0,
      variacao,
      variacao_posicao,
      avatar_type:      p.avatar_type as string | null,
      avatar_value:     p.avatar_value as string | null,
    }
  })

  // Desempate por palpite_id (estável e determinístico quando pontos são iguais)
  entries.sort((a, b) => b.total_pontos - a.total_pontos || a.palpite_id - b.palpite_id)
  entries.forEach((e, i) => {
    e.posicao = i + 1
    // positive = moved up in ranking (e.g. was 5th yesterday, now 3rd → +2)
    if (e.palpite_id in posicaoOntem) {
      e.variacao_posicao = posicaoOntem[e.palpite_id] - e.posicao
    }
  })

  return entries
}
