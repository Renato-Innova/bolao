import { createClient } from '@/lib/supabase/server'
import type { JogoCopa } from '@/types'

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
  const hoje = new Date().toISOString().split('T')[0]
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
  const hoje = new Date().toISOString().split('T')[0]
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
