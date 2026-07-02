import { getTabelaDataCached } from '@/services/jogos'
import { TabelaClient } from '@/components/tabela/TabelaClient'

// TTL de 60min é rede de segurança — mutação de admin chama revalidatePath('/tabela')
// e revalidateTag('tabela'), que atualizam a página na hora.
export const revalidate = 3600

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
