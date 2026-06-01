import { createClient } from '@/lib/supabase/server'
import type { ConfiguracaoPontuacao } from '@/types'

export async function getConfiguracoesPontuacao(): Promise<ConfiguracaoPontuacao[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('configuracoes_pontuacao')
    .select('*')
    .order('fase')
  return (data ?? []) as ConfiguracaoPontuacao[]
}

export async function atualizarPontuacao(id: string, pontos: number): Promise<void> {
  const supabase = await createClient()
  await supabase.from('configuracoes_pontuacao').update({ pontos }).eq('id', id)
}
