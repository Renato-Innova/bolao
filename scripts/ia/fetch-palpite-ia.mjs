import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Ricardo tem id=35 (ativo). Busca todos os palpites_jogos
const { data: pj } = await sb
  .from('palpites_jogos')
  .select('jogo_id, placar_palpite_a, placar_palpite_b, pontos, submitted_at, jogo:jogos_copa(numero_jogo, fase, grupo, time_a, time_b)')
  .eq('palpite_id', 35)
  .order('jogo_id')

console.log(`Total de jogos: ${pj.length}\n`)

let fase = ''
for (const x of pj) {
  if (x.jogo.fase !== fase) {
    fase = x.jogo.fase
    console.log(`\n=== ${fase} ===`)
  }
  const sub = x.submitted_at ? '✓' : '–'
  const placar = x.placar_palpite_a !== null && x.placar_palpite_b !== null
    ? `${x.placar_palpite_a} x ${x.placar_palpite_b}`
    : '— x —'
  console.log(`  ${sub} #${x.jogo.numero_jogo} ${x.jogo.time_a} x ${x.jogo.time_b} | Palpite: ${placar} | Pts: ${x.pontos}`)
}
