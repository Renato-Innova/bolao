/**
 * bracketSlots.ts
 *
 * Server-side service that computes and persists the per-palpite bracket
 * inference into the bracket_slots table.
 *
 * Run with the Supabase service-role (admin) client so it can bypass RLS
 * and write on behalf of any user.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ─── Phase order ────────────────────────────────────────────────────────────

export const PHASE_ORDER = ['GS', 'R32', 'R16', 'QF', 'SF', 'TPL', 'F'] as const
export type PhaseCode = typeof PHASE_ORDER[number]

export function getDownstreamPhases(phase: string): string[] {
  // TPL (disputa de 3º lugar) e F (Final) são irmãos alimentados pelos dois
  // jogos de SF (perdedores → TPL, vencedores → F) — nenhum depende do
  // resultado do outro. Sem esse caso especial, editar o TPL derrubava o
  // palpite da Final só por vir depois na PHASE_ORDER, sem relação real.
  if (phase === 'TPL') return []
  const idx = PHASE_ORDER.indexOf(phase as PhaseCode)
  if (idx === -1) return []
  return [...PHASE_ORDER.slice(idx + 1)]
}

// ─── Internal types ──────────────────────────────────────────────────────────

interface TeamInfo {
  nome: string
  codigo: string
}

interface ResolvedSlot {
  time_a: string | null
  time_b: string | null
  codigo_a: string | null
  codigo_b: string | null
}

// ─── Group standings computation ─────────────────────────────────────────────

interface GsRow {
  id: number
  grupo: string | null
  time_a: string
  time_b: string
  codigo_pais_a: string | null
  codigo_pais_b: string | null
}

interface TeamStanding {
  nome: string
  codigo: string
  pts: number
  sg: number   // goal difference
  gp: number   // goals scored
  j: number    // games played
}

function computeGroupStandings(
  gsJogos: GsRow[],
  submittedMap: Map<number, { scoreA: number; scoreB: number }>
): Map<string, TeamStanding[]> {
  const groups = new Map<string, Map<string, TeamStanding>>()

  for (const jogo of gsJogos) {
    if (!jogo.grupo) continue
    if (!groups.has(jogo.grupo)) groups.set(jogo.grupo, new Map())
    const group = groups.get(jogo.grupo)!

    if (!group.has(jogo.time_a)) {
      group.set(jogo.time_a, { nome: jogo.time_a, codigo: jogo.codigo_pais_a ?? '', pts: 0, sg: 0, gp: 0, j: 0 })
    }
    if (!group.has(jogo.time_b)) {
      group.set(jogo.time_b, { nome: jogo.time_b, codigo: jogo.codigo_pais_b ?? '', pts: 0, sg: 0, gp: 0, j: 0 })
    }

    const sub = submittedMap.get(jogo.id)
    if (!sub) continue

    const { scoreA, scoreB } = sub
    const ta = group.get(jogo.time_a)!
    const tb = group.get(jogo.time_b)!

    ta.j++; tb.j++
    ta.gp += scoreA; ta.sg += scoreA - scoreB
    tb.gp += scoreB; tb.sg += scoreB - scoreA

    if (scoreA > scoreB)      { ta.pts += 3 }
    else if (scoreB > scoreA) { tb.pts += 3 }
    else                      { ta.pts += 1; tb.pts += 1 }
  }

  const result = new Map<string, TeamStanding[]>()
  for (const [grupo, teams] of groups) {
    const sorted = [...teams.values()].sort(
      (a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp
    )
    // Only include complete groups (all 4 teams played 3 games each)
    if (sorted.every(t => t.j === 3)) {
      result.set(grupo, sorted)
    }
  }

  return result
}

// ─── Placeholder resolution ──────────────────────────────────────────────────

function resolveGroupPlaceholder(
  placeholder: string,
  standings: Map<string, TeamStanding[]>
): TeamInfo | null {
  // "Nº Grupo X"  e.g. "1º Grupo A", "2º Grupo C"
  const groupMatch = placeholder.match(/^(\d+)º Grupo ([A-L])$/)
  if (groupMatch) {
    const pos   = parseInt(groupMatch[1]) - 1  // 0-indexed
    const grupo = groupMatch[2]
    const teams = standings.get(grupo)
    if (teams && teams.length > pos) return { nome: teams[pos].nome, codigo: teams[pos].codigo }
    return null
  }

  // "Melhor 3º (A/B/C/D/F)"  — best third-place team among the listed groups
  const bestThirdMatch = placeholder.match(/^Melhor 3º \(([A-L/]+)\)$/)
  if (bestThirdMatch) {
    const groupCodes = bestThirdMatch[1].split('/').map(g => g.trim())
    const thirds: TeamStanding[] = []

    for (const g of groupCodes) {
      const teams = standings.get(g)
      if (teams && teams.length >= 3) thirds.push(teams[2])  // index 2 = 3rd place
    }

    if (thirds.length === 0) return null
    thirds.sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp)
    return { nome: thirds[0].nome, codigo: thirds[0].codigo }
  }

  return null
}

function resolveKoPlaceholder(
  placeholder: string,
  jogoByNumero: Map<number, number>,        // numero_jogo → jogo_id
  predictedWinners: Map<number, TeamInfo | null>,  // jogo_id → winner
  predictedLosers: Map<number, TeamInfo | null>    // jogo_id → loser (for TPL)
): TeamInfo | null {
  const vMatch = placeholder.match(/^Vencedor Jogo (\d+)$/)
  if (vMatch) {
    const jogoId = jogoByNumero.get(parseInt(vMatch[1]))
    if (jogoId == null) return null
    return predictedWinners.get(jogoId) ?? null
  }

  const pMatch = placeholder.match(/^Perdedor Jogo (\d+)$/)
  if (pMatch) {
    const jogoId = jogoByNumero.get(parseInt(pMatch[1]))
    if (jogoId == null) return null
    return predictedLosers.get(jogoId) ?? null
  }

  return null
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function calculateBracketSlots(
  palpiteId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: SupabaseClient<any>
): Promise<void> {

  // 1. Fetch submitted palpite predictions
  const { data: palpiteJogos, error: pjErr } = await supabaseAdmin
    .from('palpites_jogos')
    .select('jogo_id, placar_palpite_a, placar_palpite_b')
    .eq('palpite_id', palpiteId)
    .not('submitted_at', 'is', null)

  if (pjErr || !palpiteJogos) return

  // Build submission map: jogo_id → { scoreA, scoreB }
  const submittedMap = new Map<number, { scoreA: number; scoreB: number }>()
  for (const pj of palpiteJogos) {
    submittedMap.set(pj.jogo_id, {
      scoreA: pj.placar_palpite_a ?? 0,
      scoreB: pj.placar_palpite_b ?? 0,
    })
  }

  // 2. Fetch all games ordered by numero_jogo
  const { data: allJogos, error: jErr } = await supabaseAdmin
    .from('jogos_copa')
    .select('id, numero_jogo, fase, grupo, time_a, time_b, codigo_pais_a, codigo_pais_b')
    .order('numero_jogo', { ascending: true })

  if (jErr || !allJogos) return

  const gsJogos  = allJogos.filter(j => j.fase === 'GS')  as GsRow[]
  const koJogos  = allJogos.filter(j => j.fase !== 'GS')

  // 3. Build numero_jogo → id map
  const jogoByNumero = new Map<number, number>()
  for (const j of allJogos) {
    if (j.numero_jogo != null) jogoByNumero.set(j.numero_jogo, j.id)
  }

  // 4. Compute group standings from submitted GS predictions
  const standings = computeGroupStandings(gsJogos, submittedMap)

  // 5. Walk KO games phase-by-phase and resolve teams
  const resolvedSlots   = new Map<number, ResolvedSlot>()          // jogo_id → slot
  const predictedWinners = new Map<number, TeamInfo | null>()       // jogo_id → winner
  const predictedLosers  = new Map<number, TeamInfo | null>()       // jogo_id → loser

  const phaseOrder: string[] = ['R32', 'R16', 'QF', 'SF', 'TPL', 'F']

  for (const phase of phaseOrder) {
    const phaseJogos = koJogos
      .filter(j => j.fase === phase)
      .sort((a, b) => (a.numero_jogo ?? 0) - (b.numero_jogo ?? 0))

    for (const jogo of phaseJogos) {
      // Resolve team A
      let teamA: TeamInfo | null = null
      if (jogo.time_a) {
        if (phase === 'R32') {
          teamA = resolveGroupPlaceholder(jogo.time_a, standings)
        } else {
          teamA = resolveKoPlaceholder(jogo.time_a, jogoByNumero, predictedWinners, predictedLosers)
        }
      }

      // Resolve team B
      let teamB: TeamInfo | null = null
      if (jogo.time_b) {
        if (phase === 'R32') {
          teamB = resolveGroupPlaceholder(jogo.time_b, standings)
        } else {
          teamB = resolveKoPlaceholder(jogo.time_b, jogoByNumero, predictedWinners, predictedLosers)
        }
      }

      resolvedSlots.set(jogo.id, {
        time_a: teamA?.nome ?? null,
        time_b: teamB?.nome ?? null,
        codigo_a: teamA?.codigo ?? null,
        codigo_b: teamB?.codigo ?? null,
      })

      // Determine predicted winner/loser for downstream resolution
      const sub = submittedMap.get(jogo.id)
      if (sub && teamA && teamB) {
        if (sub.scoreA > sub.scoreB) {
          predictedWinners.set(jogo.id, teamA)
          predictedLosers.set(jogo.id, teamB)
        } else if (sub.scoreB > sub.scoreA) {
          predictedWinners.set(jogo.id, teamB)
          predictedLosers.set(jogo.id, teamA)
        } else {
          // Draw in KO = ambiguous (user should pick a winner but didn't)
          predictedWinners.set(jogo.id, null)
          predictedLosers.set(jogo.id, null)
        }
      }
    }
  }

  // 6. Upsert all resolved slots into bracket_slots
  if (resolvedSlots.size === 0) return

  const rows = [...resolvedSlots.entries()].map(([jogoId, slot]) => ({
    palpite_id: palpiteId,
    jogo_id:    jogoId,
    time_a:     slot.time_a,
    time_b:     slot.time_b,
    codigo_a:   slot.codigo_a,
    codigo_b:   slot.codigo_b,
    is_valid:   true,
    updated_at: new Date().toISOString(),
  }))

  await supabaseAdmin
    .from('bracket_slots')
    .upsert(rows, { onConflict: 'palpite_id,jogo_id' })
}
