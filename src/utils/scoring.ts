// ── Shared scoring logic ─────────────────────────────────────────────────────
// Implements the official Regulamento de Pontuação — Bolão Copa do Mundo 2026.
//
// Five cumulative criteria (from the regulation):
//   1. placar_exato   — exact 90+ET score → maximum points, standalone
//   2. empate         — predicted draw AND actual draw (wrong score) → partial
//   3. vencedor       — correct winner (game had a winner, wrong score) → partial
//   4. gols_equipe    — correct goals of ONE team (cumulative with 2/3)
//   5. penalti        — correct penalty-shootout winner (cumulative, KO only)
//
// Stacking rules per regulation:
//   • placar_exato is standalone (does not stack with gols_equipe)
//   • vencedor + gols_equipe stack
//   • empate + gols_equipe do NOT stack (they're mutually exclusive by score math)
//   • penalti stacks with everything (including placar_exato)

// Minimal subset of ConfiguracaoPontuacao used by the scoring engine
export interface PontuacaoConfig {
  tipo_acerto: 'placar_exato' | 'empate' | 'vencedor' | 'gols_equipe' | 'penalti'
  pontos: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the winning side based on 90+ET score (ignoring penalties for base result) */
export function getSide90(a: number, b: number): 'A' | 'B' | 'E' {
  if (a > b) return 'A'
  if (b > a) return 'B'
  return 'E'
}

/** Returns the penalty-shootout winner ('A' | 'B' | null if no shootout) */
export function getPenaltyWinner(
  pa: number | null | undefined,
  pb: number | null | undefined,
): 'A' | 'B' | null {
  if (pa == null || pb == null) return null
  if (pa > pb) return 'A'
  if (pb > pa) return 'B'
  return null   // tied penalty — shouldn't happen in real matches
}

// ── Main calculation ──────────────────────────────────────────────────────────

/**
 * Calculates the points a single palpite earns for one game.
 *
 * @param palpite   - the user's predicted scores
 * @param resultado - the official result (placar = 90+ET; penalti = shootout)
 * @param isKO      - true for knockout phases (R32 through Final)
 * @param configs   - scoring config rows for this phase from configuracoes_pontuacao
 */
export function calcularPontos(
  palpite: {
    placar_palpite_a: number
    placar_palpite_b: number
    placar_penalti_a: number | null
    placar_penalti_b: number | null
  },
  resultado: {
    placar_real_a: number
    placar_real_b: number
    placar_penalti_a: number | null
    placar_penalti_b: number | null
  },
  isKO: boolean,
  configs: PontuacaoConfig[],
): number {
  // Resolve point values from config (regulation defaults as fallback)
  const pts = {
    exato:   configs.find(c => c.tipo_acerto === 'placar_exato')?.pontos ?? 20,
    empate:  configs.find(c => c.tipo_acerto === 'empate')?.pontos       ?? 15,
    vencedor:configs.find(c => c.tipo_acerto === 'vencedor')?.pontos     ?? 10,
    gols:    configs.find(c => c.tipo_acerto === 'gols_equipe')?.pontos  ?? 5,
    penalti: configs.find(c => c.tipo_acerto === 'penalti')?.pontos      ?? 0,
  }

  const { placar_palpite_a: pa, placar_palpite_b: pb,
          placar_penalti_a: ppa, placar_penalti_b: ppb } = palpite
  const { placar_real_a: ra, placar_real_b: rb,
          placar_penalti_a: rpa, placar_penalti_b: rpb } = resultado

  // ── Penalty winner check ──────────────────────────────────────────────────
  // A penalty shootout only happens in KO games where the 90+ET score is a draw.
  const hadShootout = isKO && getPenaltyWinner(rpa, rpb) !== null
  const actualPenWinner  = hadShootout ? getPenaltyWinner(rpa, rpb)  : null
  const predictedPenWinner = hadShootout ? getPenaltyWinner(ppa, ppb) : null
  const penaltyCorrect = hadShootout && actualPenWinner === predictedPenWinner && predictedPenWinner !== null

  // ── Base score ────────────────────────────────────────────────────────────
  let points = 0

  if (pa === ra && pb === rb) {
    // ① Exact 90+ET score — maximum, standalone (no gols_equipe stacked on top)
    points = pts.exato

  } else {
    // Not exact — apply empate / vencedor / gols_equipe
    const actualSide   = getSide90(ra, rb)
    const predictedSide = getSide90(pa, pb)

    if (actualSide === 'E' && predictedSide === 'E') {
      // ② Correct draw (wrong score) — empate
      points += pts.empate

    } else if (actualSide !== 'E' && actualSide === predictedSide) {
      // ③ Correct winner (game had a winner, wrong score) — vencedor
      points += pts.vencedor
    }

    // ④ Gols_equipe — cumulative bonus: correct goals for team A OR team B
    //    Never stacks with placar_exato (handled by being in the else branch)
    //    Mathematically cannot stack with empate (see note in module header)
    if (pa === ra || pb === rb) {
      points += pts.gols
    }
  }

  // ⑤ Penalty winner bonus — always cumulative (stacks with everything incl. exact)
  if (penaltyCorrect) {
    points += pts.penalti
  }

  return points
}

// ── Special predictions scoring ───────────────────────────────────────────────

export interface SpecialPredictions {
  campeao?:       string | null
  vice_campeao?:  string | null
  artilheiro?:    string | null
  melhor_jogador?: string | null
  melhor_goleiro?: string | null
}

export interface SpecialResults {
  campeao:       string | null
  vice_campeao:  string | null
  artilheiro:    string | null
  melhor_jogador: string | null
  melhor_goleiro: string | null
}

// Points per correct special prediction (per regulation)
export const SPECIAL_POINTS = {
  campeao:       100,
  vice_campeao:   70,
  artilheiro:     50,
  melhor_jogador: 50,
  melhor_goleiro: 50,
} as const

/**
 * Calculates total points earned from special predictions.
 * Only counts fields where the official result has been set (non-null).
 *
 * @param pontosConfig  - points per category, admin-configurable via
 *                        configuracoes_pontuacao (fase='ESP'). Defaults to
 *                        SPECIAL_POINTS if not provided.
 */
export function calcularPontosEspeciais(
  palpite: SpecialPredictions,
  resultados: SpecialResults,
  pontosConfig: typeof SPECIAL_POINTS = SPECIAL_POINTS,
): number {
  let total = 0
  for (const key of Object.keys(SPECIAL_POINTS) as (keyof typeof SPECIAL_POINTS)[]) {
    const oficial = resultados[key]
    const predito = palpite[key]
    // Only score if the official result has been entered
    if (oficial && predito && oficial.trim().toLowerCase() === predito.trim().toLowerCase()) {
      total += pontosConfig[key]
    }
  }
  return total
}

// ── Group classification bonus ────────────────────────────────────────────────
// Default points per team correctly predicted to qualify from the group stage.
// Admin-configurable via configuracoes_pontuacao (fase='GS', tipo_acerto='classificacao') —
// this constant is only the fallback when that row hasn't been read from the DB yet.
export const PONTOS_CLASSIFICACAO_GRUPO = 20
