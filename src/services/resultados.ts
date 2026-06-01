import { createClient } from '@/lib/supabase/server'

export async function inserirResultado(
  jogoId: string,
  placarA: number,
  placarB: number
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('resultados')
    .upsert({ jogo_id: jogoId, placar_real_a: placarA, placar_real_b: placarB }, { onConflict: 'jogo_id' })
}

export async function calcularPontosPalpites(jogoId: string): Promise<void> {
  const supabase = await createClient()

  const { data: resultado } = await supabase
    .from('resultados')
    .select('*')
    .eq('jogo_id', jogoId)
    .single()

  if (!resultado) return

  const { data: jogo } = await supabase.from('jogos_copa').select('fase').eq('id', jogoId).single()
  if (!jogo) return

  const { data: configs } = await supabase
    .from('configuracoes_pontuacao')
    .select('*')
    .eq('fase', jogo.fase)

  const pontosExato = configs?.find((c: { tipo_acerto: string }) => c.tipo_acerto === 'placar_exato')?.pontos ?? 3
  const pontosVencedor = configs?.find((c: { tipo_acerto: string }) => c.tipo_acerto === 'vencedor')?.pontos ?? 1

  const { data: palpitesJogos } = await supabase
    .from('palpites_jogos')
    .select('*')
    .eq('jogo_id', jogoId)

  if (!palpitesJogos) return

  for (const pj of palpitesJogos) {
    if (pj.placar_palpite_a == null || pj.placar_palpite_b == null) continue

    let pontos = 0
    const ra = resultado.placar_real_a
    const rb = resultado.placar_real_b
    const pa = pj.placar_palpite_a
    const pb = pj.placar_palpite_b

    if (pa === ra && pb === rb) {
      pontos = pontosExato
    } else {
      const vencedorReal = ra > rb ? 'A' : ra < rb ? 'B' : 'E'
      const vencedorPalpite = pa > pb ? 'A' : pa < pb ? 'B' : 'E'
      if (vencedorReal === vencedorPalpite) pontos = pontosVencedor
    }

    await supabase.from('palpites_jogos').update({ pontos }).eq('id', pj.id)
  }
}
