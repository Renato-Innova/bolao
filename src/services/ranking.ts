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

  // Step 2 — fetch points per palpite from palpites_jogos
  const palpiteIds = palpites.map((p: { id: number }) => p.id)
  const { data: jogos, error: errJ } = await supabase
    .from('palpites_jogos')
    .select('palpite_id, pontos')
    .in('palpite_id', palpiteIds)

  if (errJ) {
    console.warn('[getRanking] palpites_jogos error (non-fatal):', errJ.message)
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

  // Build lookup maps
  const pontosPorPalpite: Record<number, number> = {}
  for (const j of (jogos ?? [])) {
    pontosPorPalpite[j.palpite_id] = (pontosPorPalpite[j.palpite_id] ?? 0) + (j.pontos ?? 0)
  }
  const nomeUsuario: Record<string, string> = {}
  for (const u of (users ?? [])) {
    nomeUsuario[u.id] = u.nome
  }

  const entries: RankingEntry[] = palpites.map((p: Record<string, unknown>) => ({
    posicao:          0,
    palpite_id:       p.id as number,
    nome:             p.nome as string,
    usuario_nome:     nomeUsuario[p.usuario_id as string] ?? '',
    usuario_id:       p.usuario_id as string,
    total_pontos:     pontosPorPalpite[p.id as number] ?? 0,
    acertos_exatos:   0,
    acertos_vencedor: 0,
    variacao:         0,
    avatar_type:      p.avatar_type as string | null,
    avatar_value:     p.avatar_value as string | null,
  }))

  entries.sort((a, b) => b.total_pontos - a.total_pontos)
  entries.forEach((e, i) => { e.posicao = i + 1 })

  return entries
}
