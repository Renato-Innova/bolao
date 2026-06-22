import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Palpites gerados por IA ───────────────────────────────────────────────────
// Baseado em: ranking FIFA, desempenho nas eliminatórias, histórico de confrontos,
// força ofensiva/defensiva e fator local (EUA, Canadá, México como sede).
//
// Critério: favorecer ligeiramente o time mais forte, placar realista (poucos gols),
// com empates estratégicos em confrontos equilibrados.

const PALPITES = {
  // Grupo A
  'México':          { 'África do Sul': [2, 0], 'Tchéquia': [1, 1], 'Coreia do Sul': [2, 1] },
  'África do Sul':   { 'Tchéquia': [1, 2],       'Coreia do Sul': [0, 2] },
  'Tchéquia':        { 'Coreia do Sul': [1, 1] },

  // Grupo B
  'Canadá':               { 'Bósnia e Herzegovina': [2, 0], 'Suíça': [1, 1],  'Catar': [3, 0] },
  'Bósnia e Herzegovina': { 'Suíça': [0, 2],                'Catar': [2, 1] },
  'Suíça':                { 'Catar': [2, 0] },

  // Grupo C
  'Brasil':  { 'Marrocos': [2, 1], 'Haiti': [4, 0], 'Escócia': [3, 0] },
  'Marrocos':{ 'Haiti': [2, 0],    'Escócia': [1, 0] },
  'Haiti':   { 'Escócia': [0, 2] },

  // Grupo D
  'EUA':       { 'Paraguai': [2, 0], 'Austrália': [1, 1], 'Turquia': [2, 1] },
  'Paraguai':  { 'Austrália': [1, 1], 'Turquia': [1, 1] },
  'Austrália': { 'Turquia': [1, 2] },

  // Grupo E
  'Alemanha':        { 'Curaçao': [4, 0], 'Costa do Marfim': [2, 1], 'Equador': [3, 1] },
  'Curaçao':         { 'Costa do Marfim': [0, 2], 'Equador': [0, 3] },
  'Costa do Marfim': { 'Equador': [1, 1] },

  // Grupo F
  'Holanda': { 'Japão': [2, 1], 'Suécia': [2, 1], 'Tunísia': [3, 0] },
  'Japão':   { 'Suécia': [1, 1], 'Tunísia': [2, 0] },
  'Suécia':  { 'Tunísia': [2, 0] },

  // Grupo G
  'Bélgica':       { 'Egito': [2, 1], 'Irã': [2, 0], 'Nova Zelândia': [3, 0] },
  'Egito':         { 'Irã': [1, 1],   'Nova Zelândia': [2, 0] },
  'Irã':           { 'Nova Zelândia': [1, 0] },

  // Grupo H
  'Espanha':        { 'Cabo Verde': [3, 0], 'Arábia Saudita': [2, 0], 'Uruguai': [1, 1] },
  'Cabo Verde':     { 'Arábia Saudita': [0, 2], 'Uruguai': [0, 2] },
  'Arábia Saudita': { 'Uruguai': [1, 2] },

  // Grupo I
  'França':  { 'Senegal': [2, 1], 'Iraque': [3, 0], 'Noruega': [2, 1] },
  'Senegal': { 'Iraque': [2, 0],  'Noruega': [1, 1] },
  'Iraque':  { 'Noruega': [0, 2] },

  // Grupo J
  'Argentina': { 'Argélia': [3, 0], 'Áustria': [2, 0], 'Jordânia': [4, 0] },
  'Argélia':   { 'Áustria': [1, 1], 'Jordânia': [2, 0] },
  'Áustria':   { 'Jordânia': [2, 0] },

  // Grupo K
  'Portugal':           { 'Rep. Dem. do Congo': [3, 0], 'Uzbequistão': [3, 0], 'Colômbia': [2, 1] },
  'Rep. Dem. do Congo': { 'Uzbequistão': [1, 1], 'Colômbia': [0, 2] },
  'Uzbequistão':        { 'Colômbia': [0, 3] },

  // Grupo L
  'Inglaterra': { 'Croácia': [2, 0], 'Gana': [3, 1], 'Sérvia': [2, 1] },
  'Croácia':    { 'Gana': [2, 0],    'Sérvia': [1, 1] },
  'Gana':       { 'Sérvia': [1, 2] },
}

function getPlacar(timeA, timeB) {
  if (PALPITES[timeA]?.[timeB]) return PALPITES[timeA][timeB]
  if (PALPITES[timeB]?.[timeA]) {
    const [a, b] = PALPITES[timeB][timeA]
    return [b, a]
  }
  return [1, 1] // fallback empate
}

async function main() {
  // 1. Buscar usuário
  const { data: user, error: userErr } = await sb
    .from('users').select('id, nome').eq('email', 'renatoclpereira@gmail.com').single()
  if (userErr || !user) { console.error('Usuário não encontrado', userErr); process.exit(1) }
  console.log(`Usuário: ${user.nome} (${user.id})`)

  // 2. Verificar se já existe palpite "Gerado por AI"
  const { data: existing } = await sb
    .from('palpites').select('id').eq('usuario_id', user.id).eq('nome', 'Gerado por AI').maybeSingle()
  if (existing) {
    console.log(`Palpite já existe (id=${existing.id}), removendo palpites_jogos antigos...`)
    await sb.from('palpites_jogos').delete().eq('palpite_id', existing.id)
    await sb.from('palpites').delete().eq('id', existing.id)
  }

  // 3. Criar palpite
  const { data: palpite, error: pErr } = await sb
    .from('palpites').insert({ usuario_id: user.id, nome: 'Gerado por AI', status: 'inativo', pontos_especiais: 0, pontos_classificacao: 0 }).select('id').single()
  if (pErr || !palpite) { console.error('Erro ao criar palpite', pErr); process.exit(1) }
  console.log(`Palpite criado: id=${palpite.id}`)

  // 4. Buscar jogos da fase de grupos
  const { data: jogos } = await sb
    .from('jogos_copa').select('id, time_a, time_b, fase').eq('fase', 'GS').order('data').order('horario')
  console.log(`${jogos.length} jogos da fase de grupos encontrados`)

  // 5. Inserir palpites_jogos
  const rows = jogos.map(j => {
    const [a, b] = getPlacar(j.time_a, j.time_b)
    return {
      palpite_id: palpite.id,
      jogo_id: j.id,
      placar_palpite_a: a,
      placar_palpite_b: b,
      pontos: 0,
    }
  })

  const { error: insErr } = await sb.from('palpites_jogos').insert(rows)
  if (insErr) { console.error('Erro ao inserir palpites_jogos', insErr); process.exit(1) }

  console.log(`✅ ${rows.length} palpites inseridos com sucesso!`)
  rows.forEach((r, i) => {
    const j = jogos[i]
    console.log(`  ${j.time_a} ${r.placar_palpite_a} x ${r.placar_palpite_b} ${j.time_b}`)
  })
}

main().catch(console.error)
