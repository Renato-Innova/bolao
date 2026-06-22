import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Carrega .env.local manualmente
const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data: resultados } = await supabase
  .from('resultados')
  .select('jogo_id, placar_real_a, placar_real_b')

const jogoIds = resultados.map(r => r.jogo_id)

const { data: jogos } = await supabase
  .from('jogos_copa')
  .select('id, time_a, time_b, data, fase, grupo')
  .in('id', jogoIds)
  .order('data')

const { data: palpites } = await supabase
  .from('palpites')
  .select('id, nome')
  .eq('status', 'ativo')
  .order('nome')

const { data: pj } = await supabase
  .from('palpites_jogos')
  .select('palpite_id, jogo_id, submitted_at, pontos')
  .in('jogo_id', jogoIds)
  .in('palpite_id', palpites.map(p => p.id))

console.log(`Palpites ativos : ${palpites.length}`)
console.log(`Jogos c/ resultado: ${jogos.length}`)
console.log('─'.repeat(90))

// Agrupa por jogo
for (const jogo of jogos) {
  const res = resultados.find(r => r.jogo_id === jogo.id)
  const grp = jogo.grupo ? ` Gr.${jogo.grupo}` : ''
  const perdidos = []

  for (const p of palpites) {
    const entry = pj.find(x => x.palpite_id === p.id && x.jogo_id === jogo.id)
    if (!entry || !entry.submitted_at) {
      perdidos.push({ nome: p.nome, status: !entry ? 'SEM REGISTRO' : 'NÃO ENVIADO' })
    }
  }

  if (perdidos.length > 0) {
    console.log(`\n[${jogo.fase}${grp}] ${jogo.time_a} ${res.placar_real_a}x${res.placar_real_b} ${jogo.time_b}  (${jogo.data})`)
    for (const p of perdidos) {
      console.log(`  ❌ ${p.nome.padEnd(35)} ${p.status}`)
    }
  }
}

console.log('\n' + '─'.repeat(90))
console.log('Legenda: SEM REGISTRO = nunca abriu o jogo | NÃO ENVIADO = abriu mas não clicou Enviar')
