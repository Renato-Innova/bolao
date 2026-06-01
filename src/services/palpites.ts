import { createClient } from '@/lib/supabase/server'
import type { Palpite, PalpiteJogo } from '@/types'

export async function getPalpitesByUser(userId: string): Promise<Palpite[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('palpites')
    .select('*, palpites_jogos(*, jogo:jogos_copa(*))')
    .eq('usuario_id', userId)
    .order('criado_em', { ascending: false })
  return (data ?? []) as Palpite[]
}

export async function getPalpiteById(id: string): Promise<Palpite | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('palpites')
    .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
    .eq('id', id)
    .single()
  return data as Palpite | null
}

export async function criarPalpite(userId: string, nome: string): Promise<Palpite | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('palpites')
    .insert({ usuario_id: userId, nome, status: 'inativo', artilheiro: '' })
    .select()
    .single()
  return data as Palpite | null
}

export async function atualizarPalpiteJogo(
  palpiteJogoId: string,
  placarA: number,
  placarB: number
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('palpites_jogos')
    .update({ placar_palpite_a: placarA, placar_palpite_b: placarB })
    .eq('id', palpiteJogoId)
}

export async function atualizarArtilheiro(
  palpiteId: string,
  artilheiro: string
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('palpites')
    .update({ artilheiro })
    .eq('id', palpiteId)
}

export async function getTotalPalpitesAtivos(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('palpites')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ativo')
  return count ?? 0
}

export async function inicializarPalpitesJogos(palpiteId: string): Promise<void> {
  const supabase = await createClient()
  const { data: jogos } = await supabase.from('jogos_copa').select('id').eq('fase', 'grupos')
  if (!jogos) return
  const rows = jogos.map((j: { id: string }) => ({
    palpite_id: palpiteId,
    jogo_id: j.id,
    pontos: 0,
  }))
  await supabase.from('palpites_jogos').upsert(rows, { onConflict: 'palpite_id,jogo_id' })
}

export async function getPalpitesJogos(palpiteId: string): Promise<PalpiteJogo[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('palpites_jogos')
    .select('*, jogo:jogos_copa(*, resultado:resultados(*))')
    .eq('palpite_id', palpiteId)
  return (data ?? []) as PalpiteJogo[]
}
