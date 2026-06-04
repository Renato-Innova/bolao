// ── Shared scoring logic ─────────────────────────────────────────────────────
// Used by both /api/admin/resultado (batch recalc) and
// /api/palpites/[id]/submit (single-palpite recalc on submission).

export interface PontuacaoConfig {
  tipo_acerto: 'placar_exato' | 'vencedor'
  pontos: number
}

/**
 * Returns the winning side for a match:
 *  'A' | 'B'  — 90-min result or penalty shootout winner
 *  'E'        — draw (only valid in group stage — KO should never return this)
 */
export function getWinnerSide(
  a: number, b: number,
  pa: number | null, pb: number | null,
): 'A' | 'B' | 'E' {
  if (a > b) return 'A'
  if (b > a) return 'B'
  if (pa != null && pb != null) {
    if (pa > pb) return 'A'
    if (pb > pa) return 'B'
  }
  return 'E'
}

/**
 * Calculates the points a single palpite earns for a given game.
 *
 * @param palpite   - the user's predicted scores (90-min + optional penalties)
 * @param resultado - the official result
 * @param isKO      - true for knockout phase games (penalties apply)
 * @param configs   - scoring configuration rows for this phase
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
  const pontosExato    = configs.find(c => c.tipo_acerto === 'placar_exato')?.pontos ?? 3
  const pontosVencedor = configs.find(c => c.tipo_acerto === 'vencedor')?.pontos    ?? 1

  const { placar_palpite_a: pa, placar_palpite_b: pb } = palpite
  const { placar_real_a: ra, placar_real_b: rb,
          placar_penalti_a: rpa, placar_penalti_b: rpb } = resultado

  // Exact 90-min score match
  if (pa === ra && pb === rb) return pontosExato

  // Correct winner (penalty-aware for KO games)
  const pPenA = isKO ? (palpite.placar_penalti_a ?? null) : null
  const pPenB = isKO ? (palpite.placar_penalti_b ?? null) : null
  const actualWinner    = getWinnerSide(ra, rb, isKO ? rpa : null, isKO ? rpb : null)
  const predictedWinner = getWinnerSide(pa, pb, pPenA, pPenB)

  if (actualWinner !== 'E' && actualWinner === predictedWinner) return pontosVencedor

  return 0
}
