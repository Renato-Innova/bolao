// v2
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Busca o ranking de artilheiros na football-data.org e atualiza artilheiros_copa.
// Compartilhado entre o cron (este GET) e a rota admin (/api/admin/artilheiros).
export async function atualizarArtilheiros(): Promise<
  { ok: true; count: number; atualizado_em: string } | { ok: false; error: string; status: number }
> {
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/scorers?limit=20',
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY! } },
  )

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `football-data: ${res.status} — ${text}`, status: 502 }
  }

  const data = await res.json()
  const scorers = data.scorers ?? []

  const rows = scorers.map((s: Record<string, unknown>) => {
    const player = s.player as Record<string, unknown>
    const team   = s.team   as Record<string, unknown>
    return {
      id:           player.id as number,
      jogador:      player.name as string,
      seleção:      (team.shortName ?? team.name) as string,
      escudo_url:   team.crest as string ?? null,
      gols:         (s.goals         as number) ?? 0,
      assistencias: (s.assists        as number) ?? 0,
      penaltis:     (s.penalties      as number) ?? 0,
      jogos:        (s.playedMatches  as number) ?? 0,
      atualizado_em: new Date().toISOString(),
    }
  })

  const admin = createAdminClient()
  const { error } = await admin
    .from('artilheiros_copa')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  return { ok: true, count: rows.length, atualizado_em: new Date().toISOString() }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await atualizarArtilheiros()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
