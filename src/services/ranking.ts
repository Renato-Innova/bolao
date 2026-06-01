import { createClient } from '@/lib/supabase/server'
import type { RankingEntry } from '@/types'

export async function getRanking(): Promise<RankingEntry[]> {
  const supabase = await createClient()

  const { data: palpites } = await supabase
    .from('palpites')
    .select('id, nome, usuario_id, palpites_jogos(pontos), usuario:users(nome)')
    .eq('status', 'ativo')

  if (!palpites) return []

  const entries = palpites.map((p: Record<string, unknown>, idx: number) => {
    const jogos = (p.palpites_jogos as { pontos: number }[]) ?? []
    const total = jogos.reduce((sum: number, j: { pontos: number }) => sum + (j.pontos ?? 0), 0)
    return {
      posicao: 0,
      palpite_id: p.id as string,
      nome: p.nome as string,
      usuario_nome: (p.usuario as { nome: string } | null)?.nome ?? '',
      usuario_id: p.usuario_id as string,
      total_pontos: total,
      acertos_exatos: 0,
      acertos_vencedor: 0,
      variacao: 0,
    }
  })

  entries.sort((a: RankingEntry, b: RankingEntry) => b.total_pontos - a.total_pontos)
  entries.forEach((e: RankingEntry, i: number) => { e.posicao = i + 1 })

  return entries
}
