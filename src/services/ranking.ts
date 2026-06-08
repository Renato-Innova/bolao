import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { RankingEntry } from '@/types'

export async function getRanking(): Promise<RankingEntry[]> {
  // Prefer admin client (bypasses RLS); fall back to anon client if key is missing
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : await createClient()

  const { data: palpites, error } = await supabase
    .from('palpites')
    .select('id, nome, usuario_id, avatar_type, avatar_value, palpites_jogos(pontos), usuario:users(nome)')
    .eq('status', 'ativo')

  if (error) {
    console.error('[getRanking] query error:', error.message, error.details)
    return []
  }
  if (!palpites) return []

  const entries = palpites.map((p: Record<string, unknown>, idx: number) => {
    const jogos = (p.palpites_jogos as { pontos: number }[]) ?? []
    const total = jogos.reduce((sum: number, j: { pontos: number }) => sum + (j.pontos ?? 0), 0)
    return {
      posicao: 0,
      palpite_id: p.id as number,
      nome: p.nome as string,
      usuario_nome: (p.usuario as { nome: string } | null)?.nome ?? '',
      usuario_id: p.usuario_id as string,
      total_pontos: total,
      acertos_exatos: 0,
      acertos_vencedor: 0,
      variacao: 0,
      avatar_type: p.avatar_type as string | null,
      avatar_value: p.avatar_value as string | null,
    }
  })

  entries.sort((a: RankingEntry, b: RankingEntry) => b.total_pontos - a.total_pontos)
  entries.forEach((e: RankingEntry, i: number) => { e.posicao = i + 1 })

  return entries
}
