// v2
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getFlagUrl, getCodigoPais } from '@/utils/helpers'

// Mapa código FIFA (3 letras, campo IdCountry da API) -> nome em português,
// como usado em jogos_copa.time_a/time_b. Confirmado direto na resposta real
// da API (lista IdMemberAssociation da Copa do Mundo 2026, idSeason 285023).
const FIFA_CODE_PARA_PT: Record<string, string> = {
  USA: 'EUA', CAN: 'Canadá', MEX: 'México', JPN: 'Japão', NZL: 'Nova Zelândia',
  IRN: 'Irã', ARG: 'Argentina', UZB: 'Uzbequistão', JOR: 'Jordânia', KOR: 'Coreia do Sul',
  AUS: 'Austrália', BRA: 'Brasil', ECU: 'Equador', COL: 'Colômbia', PAR: 'Paraguai',
  URU: 'Uruguai', MAR: 'Marrocos', TUN: 'Tunísia', EGY: 'Egito', ALG: 'Argélia',
  GHA: 'Gana', CPV: 'Cabo Verde', RSA: 'África do Sul', QAT: 'Catar', ENG: 'Inglaterra',
  KSA: 'Arábia Saudita', CIV: 'Costa do Marfim', SEN: 'Senegal', FRA: 'França', CRO: 'Croácia',
  POR: 'Portugal', NOR: 'Noruega', GER: 'Alemanha', NED: 'Holanda', BEL: 'Bélgica',
  ESP: 'Espanha', SUI: 'Suíça', AUT: 'Áustria', SCO: 'Escócia', PAN: 'Panamá',
  CUW: 'Curaçao', HAI: 'Haiti', BIH: 'Bósnia e Herzegovina', COD: 'Rep. Dem. do Congo',
  CZE: 'Tchéquia', IRQ: 'Iraque', SWE: 'Suécia', TUR: 'Turquia',
}

// "Lionel MESSI" / "CRISTIANO RONALDO" -> "Lionel Messi" / "Cristiano Ronaldo"
function nomeLegivel(nomeApi: string): string {
  return nomeApi
    .split(' ')
    .map(palavra => /^[A-ZÀ-Ý'-]+$/.test(palavra) && palavra.length > 1
      ? palavra[0] + palavra.slice(1).toLowerCase()
      : palavra)
    .join(' ')
}

// IDs fixos da Copa do Mundo 2026 na API pública e gratuita da FIFA
// (https://givevoicetofootball.fifa.com — sem necessidade de chave/autenticação)
const FIFA_ID_SEASON = '285023'
const FIFA_ID_COMPETITION = '17'

// Busca o ranking de artilheiros na API oficial da FIFA e atualiza artilheiros_copa.
// Compartilhado entre o cron (este GET), a rota admin (/api/admin/artilheiros) e o
// gatilho pós-salvar-resultado (/api/admin/resultado) — uma única função para os três.
export async function atualizarArtilheiros(): Promise<
  { ok: true; count: number; atualizado_em: string } | { ok: false; error: string; status: number }
> {
  const res = await fetch(
    `https://api.fifa.com/api/v3/topseasonplayerstatistics/season/${FIFA_ID_SEASON}/topscorers?count=20&idCompetition=${FIFA_ID_COMPETITION}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  )

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `fifa.com: ${res.status} — ${text}`, status: 502 }
  }

  const data = await res.json()
  // O parametro count na query nao limita a resposta de fato (a API retorna a
  // lista inteira de jogadores do torneio, ja ordenada por Rank) — cortamos
  // aqui. A lista tambem pode ter o mesmo jogador duplicado mais de uma vez
  // (inconsistencia da propria API), entao tambem removemos duplicatas por id.
  const todos = (data.PlayerStatsList ?? []) as Record<string, unknown>[]
  const vistos = new Set<string>()
  const scorers = todos.filter(s => {
    const id = (s.PlayerInfo as Record<string, unknown>).IdPlayer as string
    if (vistos.has(id)) return false
    vistos.add(id)
    return true
  }).slice(0, 20)

  const rows = scorers.map(s => {
    const info = s.PlayerInfo as Record<string, unknown>
    const codigoFifa = info.IdCountry as string
    const nomePt = FIFA_CODE_PARA_PT[codigoFifa] ?? codigoFifa
    return {
      id:           Number(info.IdPlayer),
      jogador:      nomeLegivel((info.PlayerName as { Description: string }[])[0].Description),
      seleção:      nomePt,
      escudo_url:   getFlagUrl(getCodigoPais(nomePt), 'w40'),
      gols:         (s.GoalsScored          as number) ?? 0,
      assistencias: (s.Assists              as number) ?? 0,
      penaltis:     (s.GoalsScoredOnPenalty as number) ?? 0,
      jogos:        (s.MatchesPlayed        as number) ?? 0,
      atualizado_em: new Date().toISOString(),
    }
  })

  const admin = createAdminClient()

  // Substitui a lista inteira em vez de upsert: os IDs de jogador da FIFA são
  // diferentes dos antigos (football-data.org), então um upsert deixaria
  // registros órfãos do provedor anterior, sem nunca mais serem atualizados.
  const { error: delError } = await admin.from('artilheiros_copa').delete().gte('id', 0)
  if (delError) return { ok: false, error: delError.message, status: 500 }

  const { error } = await admin
    .from('artilheiros_copa')
    .insert(rows)

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  revalidateTag('dashboard', 'max')

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
