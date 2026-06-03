import { createClient } from '@/lib/supabase/server'
import { TabelaClient } from '@/components/tabela/TabelaClient'
import type { ClassificacaoGrupo, JogoCopa } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TabelaPage() {
  const supabase = await createClient()

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

  const todosJogos = (jogosData ?? []) as JogoCopa[]
  const jogosKO    = todosJogos.filter(j => j.fase !== 'GS')

  return (
    <TabelaClient
      todosJogos={todosJogos}
      jogosKO={jogosKO}
      classificacao={(classificacaoData ?? []) as ClassificacaoGrupo[]}
    />
  )
}
