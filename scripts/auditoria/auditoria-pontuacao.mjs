// Auditoria de pontuação — SOMENTE LEITURA, zero escrita no banco
// Recalcula pontos de cada palpite_jogo usando as regras oficiais
// e compara com o valor salvo em palpites_jogos.pontos

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Carrega .env.local manualmente
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8').split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=', 2))
)

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

// ── Replica de calcularPontos (scoring.ts) ───────────────────────────────────
function getSide90(a, b) { return a > b ? 'A' : b > a ? 'B' : 'E' }
function getPenaltyWinner(pa, pb) {
  if (pa == null || pb == null) return null
  return pa > pb ? 'A' : pb > pa ? 'B' : null
}

function calcularPontos(palpite, resultado, isKO, configs) {
  const pts = {
    exato:    configs.find(c => c.tipo_acerto === 'placar_exato')?.pontos ?? 20,
    empate:   configs.find(c => c.tipo_acerto === 'empate')?.pontos       ?? 15,
    vencedor: configs.find(c => c.tipo_acerto === 'vencedor')?.pontos     ?? 10,
    gols:     configs.find(c => c.tipo_acerto === 'gols_equipe')?.pontos  ?? 5,
    penalti:  configs.find(c => c.tipo_acerto === 'penalti')?.pontos      ?? 0,
  }

  const { placar_palpite_a: pa, placar_palpite_b: pb,
          placar_penalti_a: ppa, placar_penalti_b: ppb } = palpite
  const { placar_real_a: ra, placar_real_b: rb,
          placar_penalti_a: rpa, placar_penalti_b: rpb } = resultado

  const hadShootout = isKO && getPenaltyWinner(rpa, rpb) !== null
  const penaltyCorrect = hadShootout &&
    getPenaltyWinner(ppa, ppb) === getPenaltyWinner(rpa, rpb) &&
    getPenaltyWinner(ppa, ppb) !== null

  let points = 0
  if (pa === ra && pb === rb) {
    points = pts.exato
  } else {
    const actualSide    = getSide90(ra, rb)
    const predictedSide = getSide90(pa, pb)
    if (actualSide === 'E' && predictedSide === 'E') {
      points += pts.empate
    } else if (actualSide !== 'E' && actualSide === predictedSide) {
      points += pts.vencedor
    }
    if (pa === ra || pb === rb) points += pts.gols
  }
  if (penaltyCorrect) points += pts.penalti
  return points
}

// ── Fases KO ─────────────────────────────────────────────────────────────────
const KO_FASES = new Set(['R32', 'R16', 'QF', 'SF', 'TPL', 'F'])

async function main() {
  console.log('Buscando dados do banco...\n')

  // 1. Configurações de pontuação por fase
  const { data: configs } = await supabase
    .from('configuracoes_pontuacao')
    .select('fase, tipo_acerto, pontos')
  const configsByFase = {}
  for (const c of configs) {
    if (!configsByFase[c.fase]) configsByFase[c.fase] = []
    configsByFase[c.fase].push(c)
  }

  // 2. Jogos com resultado
  const { data: jogos } = await supabase
    .from('jogos_copa')
    .select('id, fase, time_a, time_b, data, resultado:resultados(*)')
  const jogoMap = {}
  for (const j of jogos) {
    const r = Array.isArray(j.resultado) ? j.resultado[0] : j.resultado
    if (r) jogoMap[j.id] = { ...j, resultado: r }
  }
  const jogosComResultado = Object.keys(jogoMap).map(Number)
  console.log(`Jogos com resultado: ${jogosComResultado.length}`)

  // 3. Palpites ativos
  const { data: palpites } = await supabase
    .from('palpites')
    .select('id, nome')
    .eq('status', 'ativo')
  console.log(`Palpites ativos: ${palpites.length}`)

  // 4. Palpites_jogos submetidos para jogos com resultado
  const { data: pjs } = await supabase
    .from('palpites_jogos')
    .select('id, palpite_id, jogo_id, placar_palpite_a, placar_palpite_b, placar_penalti_a, placar_penalti_b, pontos, submitted_at')
    .in('jogo_id', jogosComResultado)
    .not('submitted_at', 'is', null)
  console.log(`Palpites_jogos submetidos com resultado: ${pjs.length}\n`)

  // ── Auditoria ────────────────────────────────────────────────────────────────
  const erros = []
  const nomeMap = Object.fromEntries(palpites.map(p => [p.id, p.nome]))

  for (const pj of pjs) {
    const jogo = jogoMap[pj.jogo_id]
    if (!jogo) continue

    const fase   = jogo.fase
    const isKO   = KO_FASES.has(fase)
    const configs = configsByFase[fase] ?? []
    const resultado = jogo.resultado

    const pontosCalculados = calcularPontos(
      {
        placar_palpite_a: pj.placar_palpite_a,
        placar_palpite_b: pj.placar_palpite_b,
        placar_penalti_a: pj.placar_penalti_a,
        placar_penalti_b: pj.placar_penalti_b,
      },
      {
        placar_real_a:    resultado.placar_real_a,
        placar_real_b:    resultado.placar_real_b,
        placar_penalti_a: resultado.placar_penalti_a,
        placar_penalti_b: resultado.placar_penalti_b,
      },
      isKO,
      configs,
    )

    if (pontosCalculados !== pj.pontos) {
      erros.push({
        palpite_id:   pj.palpite_id,
        nome:         nomeMap[pj.palpite_id] ?? `palpite#${pj.palpite_id}`,
        jogo_id:      pj.jogo_id,
        jogo:         `${jogo.time_a} x ${jogo.time_b} (${jogo.data}, ${fase})`,
        palpite:      `${pj.placar_palpite_a}-${pj.placar_palpite_b}`,
        resultado:    `${resultado.placar_real_a}-${resultado.placar_real_b}`,
        pontos_banco: pj.pontos,
        pontos_calc:  pontosCalculados,
        diferenca:    pontosCalculados - pj.pontos,
      })
    }
  }

  // ── Resultado ────────────────────────────────────────────────────────────────
  if (erros.length === 0) {
    console.log('✅ AUDITORIA CONCLUÍDA — Nenhum erro de pontuação encontrado.')
  } else {
    console.log(`❌ AUDITORIA CONCLUÍDA — ${erros.length} divergência(s) encontrada(s):\n`)
    for (const e of erros) {
      console.log(`[${e.nome}] | ${e.jogo}`)
      console.log(`  Palpite: ${e.palpite} | Resultado: ${e.resultado}`)
      console.log(`  Banco: ${e.pontos_banco} pts | Calculado: ${e.pontos_calc} pts | Diferença: ${e.diferenca > 0 ? '+' : ''}${e.diferenca}`)
      console.log()
    }

    // Resumo por palpite
    const porPalpite = {}
    for (const e of erros) {
      if (!porPalpite[e.nome]) porPalpite[e.nome] = { qtd: 0, diff: 0 }
      porPalpite[e.nome].qtd++
      porPalpite[e.nome].diff += e.diferenca
    }
    console.log('── Resumo por palpite ──────────────────────────────────')
    for (const [nome, { qtd, diff }] of Object.entries(porPalpite)) {
      console.log(`  ${nome}: ${qtd} jogo(s) divergente(s), impacto total: ${diff > 0 ? '+' : ''}${diff} pts`)
    }
  }
}

main().catch(console.error)
