import { getTabelaDataCached } from '@/services/jogos'
import { TabelaClient } from '@/components/tabela/TabelaClient'

export const revalidate = 20

export default async function TabelaPage() {
  const { classificacao, todosJogos } = await getTabelaDataCached()
  const jogosKO = todosJogos.filter(j => j.fase !== 'GS')

  return (
    <TabelaClient
      todosJogos={todosJogos}
      jogosKO={jogosKO}
      classificacao={classificacao}
    />
  )
}
