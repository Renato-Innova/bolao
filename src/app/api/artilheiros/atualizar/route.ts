import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/scorers?limit=20',
    { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY! } },
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `football-data: ${res.status}`, detail: text }, { status: 502 })
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

  const { error } = await supabase
    .from('artilheiros_copa')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: rows.length, atualizado_em: new Date().toISOString() })
}
