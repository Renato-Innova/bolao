import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PALPITE_ID = 14
const NOW = new Date().toISOString()

/*
  Previsões da IA para o mata-mata
  Formato: [jogo_id, placar_a, placar_b, penalti_a, penalti_b]
  penalti_a/b = null se não for nos pênaltis

  Critério: resultados variados, com alguns jogos indo a pênaltis,
  coerente com o perfil do palpite (Campeão: México).
  A IA aposta em surpresas e jogos equilibrados na Copa 2026 nos EUA/México/Canadá.
*/
const previsoes = [
  // ── R32 (32 avos) ──────────────────────────────────────────────
  // id=73  2ºA x 2ºB
  [73,  2, 1, null, null],
  // id=74  1ºE x Melhor3º
  [74,  1, 0, null, null],
  // id=75  1ºF x 2ºC
  [75,  2, 0, null, null],
  // id=76  1ºC x 2ºF
  [76,  1, 1, 4, 3],      // pênaltis: A vence 4-3
  // id=77  1ºI x Melhor3º
  [77,  1, 0, null, null],
  // id=78  2ºE x 2ºI
  [78,  2, 1, null, null],
  // id=79  1ºA x Melhor3º
  [79,  3, 1, null, null],
  // id=80  1ºL x Melhor3º
  [80,  2, 0, null, null],
  // id=81  1ºD x Melhor3º
  [81,  1, 1, 5, 4],      // pênaltis: A vence 5-4
  // id=82  1ºG x Melhor3º
  [82,  2, 1, null, null],
  // id=83  2ºK x 2ºL
  [83,  1, 0, null, null],
  // id=84  1ºH x 2ºJ
  [84,  2, 2, 3, 2],      // pênaltis: A vence 3-2
  // id=85  1ºB x Melhor3º
  [85,  1, 0, null, null],
  // id=86  1ºJ x 2ºH
  [86,  2, 1, null, null],
  // id=87  1ºK x Melhor3º
  [87,  1, 0, null, null],
  // id=88  2ºD x 2ºG
  [88,  0, 0, 4, 3],      // pênaltis: A vence 4-3

  // ── R16 (oitavas) ──────────────────────────────────────────────
  // id=89  Venc74 x Venc77
  [89,  2, 1, null, null],
  // id=90  Venc73 x Venc75
  [90,  1, 0, null, null],
  // id=91  Venc76 x Venc78
  [91,  2, 2, 5, 4],      // pênaltis
  // id=92  Venc79 x Venc80
  [92,  1, 0, null, null],
  // id=93  Venc83 x Venc84
  [93,  2, 1, null, null],
  // id=94  Venc81 x Venc82
  [94,  1, 1, 4, 2],      // pênaltis
  // id=95  Venc86 x Venc88
  [95,  1, 0, null, null],
  // id=96  Venc85 x Venc87
  [96,  2, 0, null, null],

  // ── QF (quartas) ───────────────────────────────────────────────
  // id=97  Venc89 x Venc90
  [97,  1, 0, null, null],
  // id=98  Venc93 x Venc94
  [98,  2, 1, null, null],
  // id=99  Venc91 x Venc92
  [99,  1, 1, 4, 3],      // pênaltis
  // id=100 Venc95 x Venc96
  [100, 2, 0, null, null],

  // ── SF (semifinais) ────────────────────────────────────────────
  // id=101 Venc97 x Venc98
  [101, 2, 1, null, null],
  // id=102 Venc99 x Venc100
  [102, 1, 0, null, null],

  // ── 3º lugar ───────────────────────────────────────────────────
  // id=103 Perd101 x Perd102
  [103, 2, 1, null, null],

  // ── Final ──────────────────────────────────────────────────────
  // id=104 Venc101 x Venc102
  [104, 2, 1, null, null],
]

// Monta os registros para inserção
const rows = previsoes.map(([jogo_id, a, b, pa, pb]) => ({
  palpite_id:       PALPITE_ID,
  jogo_id,
  placar_palpite_a: a,
  placar_palpite_b: b,
  placar_penalti_a: pa ?? null,
  placar_penalti_b: pb ?? null,
  pontos:           0,
  submitted_at:     NOW,
}))

console.log(`Inserindo ${rows.length} palpites KO para palpite_id=${PALPITE_ID}...`)

const { data, error } = await sb.from('palpites_jogos').insert(rows).select('id, jogo_id')

if (error) {
  console.error('ERRO:', error.message)
  process.exit(1)
}

console.log(`✓ ${data.length} linhas inseridas com sucesso.`)
console.log('IDs:', data.map(r => r.jogo_id).join(', '))
