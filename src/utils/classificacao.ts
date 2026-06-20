// ── Group classification logic ─────────────────────────────────────────────
// Ported from TabelaDoPalpite (PalpitesClient.tsx) so it can be used
// server-side to calculate which teams each palpite predicted to qualify
// from the group stage, enabling the 20-pts-per-qualifier bonus.
//
// Scoring: 20 pts per team correctly predicted to qualify.
//   • Top 2 from each of the 12 groups  → 24 qualifiers
//   • Best 8 third-place teams           → 8 more qualifiers
//   • Total possible: 32 × 20 = 640 pts

import { GRUPOS } from '@/utils/constants'
import { PONTOS_CLASSIFICACAO_GRUPO } from '@/utils/scoring'
export { PONTOS_CLASSIFICACAO_GRUPO }

// ── Types ────────────────────────────────────────────────────────────────────

export interface StandingRow {
  time: string
  seedOrder: number
  j: number; v: number; e: number; d: number
  gp: number; gc: number; sg: number; pts: number
}

// Minimal match shape for server-side use
export interface MatchResult {
  id: number
  grupo: string | null | undefined
  time_a: string
  time_b: string
  gols_a: number   // predicted or official goals
  gols_b: number
}

// ── Head-to-head sub-standings ───────────────────────────────────────────────

function h2hStats(
  group: StandingRow[],
  matches: MatchResult[],
): Record<string, { pts: number; sg: number; gp: number }> {
  const names = new Set(group.map(r => r.time))
  const stats: Record<string, { pts: number; sg: number; gp: number }> = {}
  for (const r of group) stats[r.time] = { pts: 0, sg: 0, gp: 0 }

  for (const m of matches) {
    if (!names.has(m.time_a) || !names.has(m.time_b)) continue
    const { gols_a: ga, gols_b: gb } = m
    stats[m.time_a].gp += ga; stats[m.time_b].gp += gb
    stats[m.time_a].sg += ga - gb; stats[m.time_b].sg += gb - ga
    if (ga > gb)      stats[m.time_a].pts += 3
    else if (ga < gb) stats[m.time_b].pts += 3
    else { stats[m.time_a].pts += 1; stats[m.time_b].pts += 1 }
  }
  return stats
}

// ── Full FIFA group-stage sort ────────────────────────────────────────────────
// 1. Overall: pts → sg → gp
// 2. Tied: h2h pts → h2h sg → h2h gp
// 3. Still tied: seedOrder (drawing of lots — deterministic, based on schedule order)

function fifaSort(rows: StandingRow[], matches: MatchResult[]): StandingRow[] {
  const sorted = [...rows].sort(
    (a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || a.seedOrder - b.seedOrder,
  )

  const result: StandingRow[] = []
  let i = 0

  while (i < sorted.length) {
    let j = i + 1
    while (
      j < sorted.length &&
      sorted[j].pts === sorted[i].pts &&
      sorted[j].sg  === sorted[i].sg  &&
      sorted[j].gp  === sorted[i].gp
    ) j++

    const group = sorted.slice(i, j)

    if (group.length === 1) {
      result.push(group[0])
    } else {
      const h2h = h2hStats(group, matches)
      const broken = [...group].sort((a, b) =>
        h2h[b.time].pts - h2h[a.time].pts ||
        h2h[b.time].sg  - h2h[a.time].sg  ||
        h2h[b.time].gp  - h2h[a.time].gp  ||
        a.seedOrder - b.seedOrder,
      )
      result.push(...broken)
    }

    i = j
  }

  return result
}

// ── Core function: compute predicted standings for all 12 groups ──────────────

/**
 * Given all group-stage games and a palpite's predictions (jogoId → {a, b}),
 * returns a map of grupo → sorted StandingRow[].
 */
export function computeGroupStandings(
  gsJogos: Array<{
    id: number
    grupo: string | null | undefined
    time_a: string
    time_b: string
    codigo_pais_a?: string | null
    codigo_pais_b?: string | null
  }>,
  predicoes: Record<number, { a: number; b: number }>,
): Record<string, StandingRow[]> {
  const byGroup: Record<string, typeof gsJogos> = {}
  for (const j of gsJogos) {
    if (!j.grupo) continue
    if (!byGroup[j.grupo]) byGroup[j.grupo] = []
    byGroup[j.grupo].push(j)
  }

  const result: Record<string, StandingRow[]> = {}

  for (const grupo of GRUPOS) {
    const jogos = byGroup[grupo] ?? []
    if (jogos.length === 0) continue

    const standings: Record<string, StandingRow> = {}
    let seed = 0

    for (const jogo of jogos) {
      if (!standings[jogo.time_a]) standings[jogo.time_a] = { time: jogo.time_a, seedOrder: seed++, j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0 }
      if (!standings[jogo.time_b]) standings[jogo.time_b] = { time: jogo.time_b, seedOrder: seed++, j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0 }

      const pred = predicoes[jogo.id]
      if (!pred) continue  // game not predicted

      const ga = pred.a; const gb = pred.b
      const ta = standings[jogo.time_a]; const tb = standings[jogo.time_b]

      ta.j++; tb.j++
      ta.gp += ga; ta.gc += gb; ta.sg += ga - gb
      tb.gp += gb; tb.gc += ga; tb.sg += gb - ga

      if (ga > gb)      { ta.v++; ta.pts += 3; tb.d++ }
      else if (ga < gb) { tb.v++; tb.pts += 3; ta.d++ }
      else              { ta.e++; ta.pts++;     tb.e++; tb.pts++ }
    }

    // Convert matches to MatchResult for fifaSort
    const matchResults: MatchResult[] = jogos.map(j => {
      const p = predicoes[j.id]
      return { id: j.id, grupo, time_a: j.time_a, time_b: j.time_b, gols_a: p?.a ?? 0, gols_b: p?.b ?? 0 }
    })

    result[grupo] = fifaSort(Object.values(standings), matchResults)
  }

  return result
}

// ── Determine which teams a palpite predicted to qualify ─────────────────────

/**
 * Returns the set of team names a palpite predicted to qualify from the
 * group stage: top 2 from each group + the 8 best 3rd-place teams.
 */
export function getPrevisaoClassificados(
  gsJogos: Parameters<typeof computeGroupStandings>[0],
  predicoes: Record<number, { a: number; b: number }>,
): Set<string> {
  const standings = computeGroupStandings(gsJogos, predicoes)
  const qualificados = new Set<string>()

  // Top 2 from each group
  for (const rows of Object.values(standings)) {
    if (rows[0]) qualificados.add(rows[0].time)
    if (rows[1]) qualificados.add(rows[1].time)
  }

  // Best 8 third-place teams (by pts → sg → gp → seedOrder)
  const thirds = Object.values(standings)
    .filter(rows => rows.length >= 3)
    .map(rows => rows[2])
  const best8 = [...thirds]
    .sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || a.seedOrder - b.seedOrder)
    .slice(0, 8)
  for (const t of best8) qualificados.add(t.time)

  return qualificados
}

// ── Calculate classification bonus for a single palpite ──────────────────────

/**
 * Compares the palpite's predicted qualifiers with the official qualifiers.
 * Returns the total bonus points (pontosPorAcerto × number of correct predictions).
 *
 * @param gsJogos          - all group-stage jogos_copa rows
 * @param predicoes        - submitted predictions for this palpite (jogoId → {a,b})
 * @param oficiais         - set of officially qualified team names
 * @param pontosPorAcerto  - points awarded per correct qualifier, admin-configurable
 *                           (configuracoes_pontuacao: fase='GS', tipo_acerto='classificacao').
 *                           Defaults to PONTOS_CLASSIFICACAO_GRUPO if not provided.
 */
export function calcularBonusClassificacao(
  gsJogos: Parameters<typeof computeGroupStandings>[0],
  predicoes: Record<number, { a: number; b: number }>,
  oficiais: Set<string>,
  pontosPorAcerto: number = PONTOS_CLASSIFICACAO_GRUPO,
): number {
  const previstos = getPrevisaoClassificados(gsJogos, predicoes)
  let acertos = 0
  for (const team of previstos) {
    if (oficiais.has(team)) acertos++
  }
  return acertos * pontosPorAcerto
}
