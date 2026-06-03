import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ── Types ────────────────────────────────────────────────────────────────────

interface StandingRow {
  pais_nome: string
  pais_codigo: string
  pts: number
  dg: number
  m: number
}

export interface BracketUpdateResult {
  jogoId: number
  numeroJogo: number | null
  timeA: string
  timeB: string
  codigoA: string | null
  codigoB: string | null
  changed: boolean
}

// ── FIFA sorting ──────────────────────────────────────────────────────────────

// Standard FIFA criteria: pts → goal diff → goals scored
function fifaSort(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.m - a.m)
}

// ── Placeholder detection ────────────────────────────────────────────────────

function isGroupPlaceholder(name: string): boolean {
  return /^\d+º Grupo [A-L]$/.test(name)
}

function isBestThird(name: string): boolean {
  return /^Melhor 3º/.test(name)
}

function isWinnerPlaceholder(name: string): boolean {
  return name.startsWith('Vencedor')
}

function isLoserPlaceholder(name: string): boolean {
  return name.startsWith('Perdedor')
}

function isAnyPlaceholder(name: string): boolean {
  return isGroupPlaceholder(name) || isBestThird(name) ||
    isWinnerPlaceholder(name) || isLoserPlaceholder(name)
}

// ── Resolvers ────────────────────────────────────────────────────────────────

function resolveGroupPosition(
  placeholder: string,
  standings: Map<string, StandingRow[]>
): { nome: string; codigo: string } | null {
  const m = placeholder.match(/^(\d+)º Grupo ([A-L])$/)
  if (!m) return null
  const pos = parseInt(m[1])
  const group = m[2]
  const sorted = standings.get(group)
  if (!sorted || sorted.length < pos) return null
  const team = sorted[pos - 1]
  return { nome: team.pais_nome, codigo: team.pais_codigo }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth — must be admin
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const admin = await createAdminClient()

  const { data: userData } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const body = await req.json() as { fase: string }
  const { fase } = body

  if (fase === 'R32') {
    return handleR32(admin)
  } else if (['R16', 'QF', 'SF', 'TPL', 'F'].includes(fase)) {
    return handleKoPhase(admin, fase)
  } else {
    return NextResponse.json({ error: 'Fase inválida.' }, { status: 400 })
  }
}

// ── R32: fill from classificacao_grupos ──────────────────────────────────────

async function handleR32(admin: Awaited<ReturnType<typeof createAdminClient>>) {
  // Load all group standings
  const { data: rows, error: standErr } = await admin
    .from('classificacao_grupos')
    .select('grupo, pais_nome, pais_codigo, pts, dg, m')

  if (standErr) return NextResponse.json({ error: standErr.message }, { status: 500 })

  // Build sorted standings map per group
  const byGroup: Record<string, StandingRow[]> = {}
  for (const r of rows ?? []) {
    if (!byGroup[r.grupo]) byGroup[r.grupo] = []
    byGroup[r.grupo].push(r as StandingRow)
  }
  const standings = new Map<string, StandingRow[]>()
  for (const [g, list] of Object.entries(byGroup)) {
    standings.set(g, fifaSort(list))
  }

  // Compute best-8 third-place teams in FIFA order
  const thirdPlace: StandingRow[] = []
  for (const sorted of standings.values()) {
    if (sorted.length >= 3) thirdPlace.push(sorted[2])
  }
  const best8 = fifaSort(thirdPlace).slice(0, 8)

  // Load all R32 games
  const { data: jogos, error: jogosErr } = await admin
    .from('jogos_copa')
    .select('id, numero_jogo, time_a, time_b, codigo_pais_a, codigo_pais_b')
    .eq('fase', 'R32')
    .order('id', { ascending: true })

  if (jogosErr) return NextResponse.json({ error: jogosErr.message }, { status: 500 })

  // Collect "Melhor 3º" slot positions so we can assign best8 in bracket order
  const best3Slots: Array<{ jogoId: number; side: 'A' | 'B' }> = []
  for (const j of jogos ?? []) {
    if (isBestThird(j.time_a)) best3Slots.push({ jogoId: j.id, side: 'A' })
    if (isBestThird(j.time_b)) best3Slots.push({ jogoId: j.id, side: 'B' })
  }

  // Build a map: jogoId+side → best3 team
  const best3Assignments = new Map<string, { nome: string; codigo: string }>()
  best3Slots.forEach((slot, i) => {
    const team = best8[i]
    if (team) best3Assignments.set(`${slot.jogoId}-${slot.side}`, { nome: team.pais_nome, codigo: team.pais_codigo })
  })

  // Resolve and update each R32 game
  const results: BracketUpdateResult[] = []

  for (const jogo of jogos ?? []) {
    let newTimeA = jogo.time_a
    let newTimeB = jogo.time_b
    let newCodigoA = jogo.codigo_pais_a
    let newCodigoB = jogo.codigo_pais_b

    // Resolve side A
    if (isGroupPlaceholder(jogo.time_a)) {
      const resolved = resolveGroupPosition(jogo.time_a, standings)
      if (resolved) { newTimeA = resolved.nome; newCodigoA = resolved.codigo }
    } else if (isBestThird(jogo.time_a)) {
      const t = best3Assignments.get(`${jogo.id}-A`)
      if (t) { newTimeA = t.nome; newCodigoA = t.codigo }
    }

    // Resolve side B
    if (isGroupPlaceholder(jogo.time_b)) {
      const resolved = resolveGroupPosition(jogo.time_b, standings)
      if (resolved) { newTimeB = resolved.nome; newCodigoB = resolved.codigo }
    } else if (isBestThird(jogo.time_b)) {
      const t = best3Assignments.get(`${jogo.id}-B`)
      if (t) { newTimeB = t.nome; newCodigoB = t.codigo }
    }

    const changed = newTimeA !== jogo.time_a || newTimeB !== jogo.time_b

    if (changed) {
      await admin.from('jogos_copa').update({
        time_a: newTimeA, time_b: newTimeB,
        codigo_pais_a: newCodigoA, codigo_pais_b: newCodigoB,
      }).eq('id', jogo.id)
    }

    results.push({ jogoId: jogo.id, numeroJogo: jogo.numero_jogo ?? null, timeA: newTimeA, timeB: newTimeB, codigoA: newCodigoA ?? null, codigoB: newCodigoB ?? null, changed })
  }

  return NextResponse.json({ updated: results.filter(r => r.changed).length, games: results })
}

// ── KO phase: fill from previous phase results ────────────────────────────────

async function handleKoPhase(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  fase: string
) {
  // Map each KO phase to the previous one where winners come from
  const prevFase: Record<string, string> = {
    R16: 'R32', QF: 'R16', SF: 'QF', TPL: 'SF', F: 'SF',
  }
  const prev = prevFase[fase]
  if (!prev) return NextResponse.json({ error: 'Fase anterior desconhecida.' }, { status: 400 })

  // Load previous-phase games with their results
  const { data: prevJogos, error: prevErr } = await admin
    .from('jogos_copa')
    .select('id, numero_jogo, fase, time_a, time_b, codigo_pais_a, codigo_pais_b, resultado:resultados(placar_real_a, placar_real_b)')
    .eq('fase', prev)

  if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 })

  // Build lookup: numero_jogo → { winner, loser }
  type TeamInfo = { nome: string; codigo: string | null }
  const winnerByNum = new Map<number, TeamInfo>()
  const loserByNum  = new Map<number, TeamInfo>()

  for (const j of prevJogos ?? []) {
    if (!j.numero_jogo || !j.resultado) continue
    const r = Array.isArray(j.resultado) ? j.resultado[0] : j.resultado
    if (!r || r.placar_real_a == null || r.placar_real_b == null) continue
    if (r.placar_real_a === r.placar_real_b) continue  // tied — can't determine without extra-time info

    const aWins = r.placar_real_a > r.placar_real_b
    const winner: TeamInfo = aWins
      ? { nome: j.time_a, codigo: j.codigo_pais_a ?? null }
      : { nome: j.time_b, codigo: j.codigo_pais_b ?? null }
    const loser: TeamInfo = aWins
      ? { nome: j.time_b, codigo: j.codigo_pais_b ?? null }
      : { nome: j.time_a, codigo: j.codigo_pais_a ?? null }

    winnerByNum.set(j.numero_jogo, winner)
    loserByNum.set(j.numero_jogo, loser)
  }

  // Load target phase games
  const { data: jogos, error: jogosErr } = await admin
    .from('jogos_copa')
    .select('id, numero_jogo, time_a, time_b, codigo_pais_a, codigo_pais_b')
    .eq('fase', fase)
    .order('id', { ascending: true })

  if (jogosErr) return NextResponse.json({ error: jogosErr.message }, { status: 500 })

  // Resolve placeholders
  function resolveSide(placeholder: string): { nome: string; codigo: string | null } | null {
    // "Vencedor R32-74" or "Perdedor SF-101"
    const mV = placeholder.match(/^Vencedor\s+[A-Z0-9]+-(\d+)$/)
    const mP = placeholder.match(/^Perdedor\s+[A-Z0-9]+-(\d+)$/)
    if (mV) return winnerByNum.get(parseInt(mV[1])) ?? null
    if (mP) return loserByNum.get(parseInt(mP[1])) ?? null
    return null
  }

  const results: BracketUpdateResult[] = []

  for (const jogo of jogos ?? []) {
    let newTimeA = jogo.time_a
    let newTimeB = jogo.time_b
    let newCodigoA = jogo.codigo_pais_a
    let newCodigoB = jogo.codigo_pais_b

    if (isAnyPlaceholder(jogo.time_a)) {
      const r = resolveSide(jogo.time_a)
      if (r) { newTimeA = r.nome; newCodigoA = r.codigo ?? undefined }
    }
    if (isAnyPlaceholder(jogo.time_b)) {
      const r = resolveSide(jogo.time_b)
      if (r) { newTimeB = r.nome; newCodigoB = r.codigo ?? undefined }
    }

    const changed = newTimeA !== jogo.time_a || newTimeB !== jogo.time_b

    if (changed) {
      await admin.from('jogos_copa').update({
        time_a: newTimeA, time_b: newTimeB,
        codigo_pais_a: newCodigoA, codigo_pais_b: newCodigoB,
      }).eq('id', jogo.id)
    }

    results.push({ jogoId: jogo.id, numeroJogo: jogo.numero_jogo ?? null, timeA: newTimeA, timeB: newTimeB, codigoA: newCodigoA ?? null, codigoB: newCodigoB ?? null, changed })
  }

  return NextResponse.json({ updated: results.filter(r => r.changed).length, games: results })
}
