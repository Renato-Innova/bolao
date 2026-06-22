import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const decisao_titulo = 'Decisão: Palpites Especiais'
const decisao_texto =
  'A enquete sobre os Palpites Especiais foi encerrada. ' +
  'A decisão é abrir Campeão, Vice-Campeão, Artilheiro, Melhor Jogador e Melhor Goleiro para edição até o dia 24/06 às 15h — uma hora antes do início das terceiras partidas dos grupos.\n\n' +
  'Aproveite para revisar suas apostas antes do prazo!'

const { error } = await supabase
  .from('enquete_config')
  .upsert({ id: 1, decisao_titulo, decisao_texto }, { onConflict: 'id' })

if (error) {
  console.error('Erro:', error.message)
  process.exit(1)
}
console.log('Decisão salva (visível só para admin — ative o toggle no painel quando aprovar).')
