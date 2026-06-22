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

// ── Auth helper ───────────────────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createAdminClient>

async function checkAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Não autenticado.'

  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!data?.is_admin) return 'Sem permissão.'

  return null
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authError = await checkAdmin()
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === 'Não autenticado.' ? 401 : 403 })
  }

  // Escritas em jogos_copa usam o client admin (service role) em vez do client
  // da sessão do usuário — a checagem de admin já foi feita acima, e isso
  // evita depender de uma policy de RLS para impedir escrita por não-admins.
  const admin = createAdminClient()

  const { fase } = await req.json() as { fase: string }

  if (fase === 'R32') return handleR32(admin)
  if (['R16', 'QF', 'SF', 'TPL', 'F'].includes(fase)) return handleKoPhase(admin, fase)
  return NextResponse.json({ error: 'Fase inválida.' }, { status: 400 })
}

// ── R32: fill from classificacao_grupos ──────────────────────────────────────

async function handleR32(supabase: SupabaseClient) {
  const { data: rows, error: standErr } = await supabase
    .from('classificacao_grupos')
    .select('grupo, pais_nome, pais_codigo, pts, dg, m')

  if (standErr) return NextResponse.json({ error: standErr.message }, { status: 500 })

  // Build sorted standings per group
  const byGroup: Record<string, StandingRow[]> = {}
  for (const r of rows ?? []) {
    if (!byGroup[r.grupo]) byGroup[r.grupo] = []
    byGroup[r.grupo].push(r as StandingRow)
  }
  const standings = new Map<string, StandingRow[]>()
  for (const [g, list] of Object.entries(byGroup)) {
    standings.set(g, fifaSort(list))
  }

  // Compute best-8 third-place teams
  const thirdPlace: StandingRow[] = []
  for (const sorted of standings.values()) {
    if (sorted.length >= 3) thirdPlace.push(sorted[2])
  }
  const best8 = fifaSort(thirdPlace).slice(0, 8)

  // Load all R32 games
  const { data: jogos, error: jogosErr } = await supabase
    .from('jogos_copa')
    .select('id, numero_jogo, time_a, time_b, codigo_pais_a, codigo_pais_b')
    .eq('fase', 'R32')
    .order('id', { ascending: true })

  if (jogosErr) return NextResponse.json({ error: jogosErr.message }, { status: 500 })

  // Assign best-8 third-place teams to their slots in bracket order
  const best3Slots: Array<{ jogoId: number; side: 'A' | 'B' }> = []
  for (const j of jogos ?? []) {
    if (isBestThird(j.time_a)) best3Slots.push({ jogoId: j.id, side: 'A' })
    if (isBestThird(j.time_b)) best3Slots.push({ jogoId: j.id, side: 'B' })
  }
  const best3Map = new Map<string, { nome: string; codigo: string }>()
  best3Slots.forEach((slot, i) => {
    const team = best8[i]
    if (team) best3Map.set(`${slot.jogoId}-${slot.side}`, { nome: team.pais_nome, codigo: team.pais_codigo })
  })

  const results: BracketUpdateResult[] = []

  for (const jogo of jogos ?? []) {
    let newTimeA = jogo.time_a, newTimeB = jogo.time_b
    let newCodigoA = jogo.codigo_pais_a, newCodigoB = jogo.codigo_pais_b

    if (isGroupPlaceholder(jogo.time_a)) {
      const r = resolveGroupPosition(jogo.time_a, standings)
      if (r) { newTimeA = r.nome; newCodigoA = r.codigo }
    } else if (isBestThird(jogo.time_a)) {
      const t = best3Map.get(`${jogo.id}-A`)
      if (t) { newTimeA = t.nome; newCodigoA = t.codigo }
    }

    if (isGroupPlaceholder(jogo.time_b)) {
      const r = resolveGroupPosition(jogo.time_b, standings)
      if (r) { newTimeB = r.nome; newCodigoB = r.codigo }
    } else if (isBestThird(jogo.time_b)) {
      const t = best3Map.get(`${jogo.id}-B`)
      if (t) { newTimeB = t.nome; newCodigoB = t.codigo }
    }

    const changed = newTimeA !== jogo.time_a || newTimeB !== jogo.time_b

    if (changed) {
      const { error: updateErr } = await supabase
        .from('jogos_copa')
        .update({ time_a: newTimeA, time_b: newTimeB, codigo_pais_a: newCodigoA, codigo_pais_b: newCodigoB })
        .eq('id', jogo.id)

      if (updateErr) {
        return NextResponse.json({ error: `Erro ao atualizar jogo ${jogo.id}: ${updateErr.message}` }, { status: 500 })
      }
    }

    results.push({
      jogoId: jogo.id, numeroJogo: jogo.numero_jogo ?? null,
      timeA: newTimeA, timeB: newTimeB,
      codigoA: newCodigoA ?? null, codigoB: newCodigoB ?? null,
      changed,
    })
  }

  return NextResponse.json({ updated: results.filter(r => r.changed).length, games: results })
}

// ── KO phase: fill from previous phase results (R16, QF, SF, TPL, F) ─────────

async function handleKoPhase(supabase: SupabaseClient, fase: string) {
  const prevFase: Record<string, string> = {
    R16: 'R32', QF: 'R16', SF: 'QF', TPL: 'SF', F: 'SF',
  }
  const prev = prevFase[fase]
  if (!prev) return NextResponse.json({ error: 'Fase anterior desconhecida.' }, { status: 400 })

  // Load previous-phase games with their results
  const { data: prevJogos, error: prevErr } = await supabase
    .from('jogos_copa')
    .select('id, numero_jogo, fase, time_a, time_b, codigo_pais_a, codigo_pais_b, resultado:resultados(placar_real_a, placar_real_b, placar_penalti_a, placar_penalti_b)')
    .eq('fase', prev)

  if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 })

  type TeamInfo = { nome: string; codigo: string | null }
  const winnerByNum = new Map<number, TeamInfo>()
  const loserByNum  = new Map<number, TeamInfo>()

  for (const j of prevJogos ?? []) {
    // Skip only if no result at all — don't require numero_jogo
    const r = Array.isArray(j.resultado) ? j.resultado[0] : j.resultado
    if (!r || r.placar_real_a == null || r.placar_real_b == null) continue

    // Determine winner: 90-min score, then penalties on draw
    let aWins: boolean
    if (r.placar_real_a > r.placar_real_b) {
      aWins = true
    } else if (r.placar_real_b > r.placar_real_a) {
      aWins = false
    } else {
      const pa = r.placar_penalti_a ?? null
      const pb = r.placar_penalti_b ?? null
      if (pa == null || pb == null || pa === pb) continue
      aWins = pa > pb
    }

    const winner: TeamInfo = aWins
      ? { nome: j.time_a, codigo: j.codigo_pais_a ?? null }
      : { nome: j.time_b, codigo: j.codigo_pais_b ?? null }
    const loser: TeamInfo = aWins
      ? { nome: j.time_b, codigo: j.codigo_pais_b ?? null }
      : { nome: j.time_a, codigo: j.codigo_pais_a ?? null }

    // Index by BOTH numero_jogo and id — placeholder may reference either
    if (j.numero_jogo) {
      winnerByNum.set(j.numero_jogo, winner)
      loserByNum.set(j.numero_jogo, loser)
    }
    winnerByNum.set(j.id, winner)
    loserByNum.set(j.id, loser)
  }

  const { data: jogos, error: jogosErr } = await supabase
    .from('jogos_copa')
    .select('id, numero_jogo, time_a, time_b, codigo_pais_a, codigo_pais_b')
    .eq('fase', fase)
    .order('id', { ascending: true })

  if (jogosErr) return NextResponse.json({ error: jogosErr.message }, { status: 500 })

  function resolveSide(placeholder: string): TeamInfo | null {
    // Extract trailing number from any "Vencedor ..." / "Perdedor ..." format:
    //   "Vencedor Jogo 74"   → 74
    //   "Vencedor R32-74"    → 74
    //   "Perdedor Jogo 101"  → 101
    const mV = placeholder.match(/^Vencedor\s+.*?(\d+)$/)
    const mP = placeholder.match(/^Perdedor\s+.*?(\d+)$/)
    if (mV) return winnerByNum.get(parseInt(mV[1])) ?? null
    if (mP) return loserByNum.get(parseInt(mP[1])) ?? null
    return null
  }

  const results: BracketUpdateResult[] = []

  for (const jogo of jogos ?? []) {
    let newTimeA = jogo.time_a, newTimeB = jogo.time_b
    let newCodigoA = jogo.codigo_pais_a, newCodigoB = jogo.codigo_pais_b

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
      const { error: updateErr } = await supabase
        .from('jogos_copa')
        .update({ time_a: newTimeA, time_b: newTimeB, codigo_pais_a: newCodigoA, codigo_pais_b: newCodigoB })
        .eq('id', jogo.id)

      if (updateErr) {
        return NextResponse.json({ error: `Erro ao atualizar jogo ${jogo.id}: ${updateErr.message}` }, { status: 500 })
      }
    }

    results.push({
      jogoId: jogo.id, numeroJogo: jogo.numero_jogo ?? null,
      timeA: newTimeA, timeB: newTimeB,
      codigoA: newCodigoA ?? null, codigoB: newCodigoB ?? null,
      changed,
    })
  }

  return NextResponse.json({ updated: results.filter(r => r.changed).length, games: results })
}
