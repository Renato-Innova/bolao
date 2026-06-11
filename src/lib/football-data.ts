/**
 * Cliente para football-data.org API v4
 * Usado exclusivamente para artilharia por jogador (Copa 2026)
 * Chave: FOOTBALL_DATA_KEY (server-side only)
 */

const BASE = 'https://api.football-data.org/v4'

function authHeaders() {
  return { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY ?? '' }
}

export interface FDScorer {
  player: {
    id:          number
    name:        string
    nationality: string
  }
  team: {
    id:        number
    name:      string
    shortName: string
    crest:     string
  }
  goals:     number
  assists:   number
  penalties: number
}

/**
 * Retorna os maiores artilheiros da Copa 2026.
 * Cache de 1 hora via Next.js fetch revalidate.
 */
export async function getWCScorers(limit = 15): Promise<FDScorer[]> {
  try {
    const res = await fetch(
      `${BASE}/competitions/WC/scorers?season=2026&limit=${limit}`,
      {
        headers: authHeaders(),
        next:    { revalidate: 3600 }, // 1 hora
      }
    )
    if (!res.ok) {
      console.error('[football-data] scorers error:', res.status, res.statusText)
      return []
    }
    const data = await res.json()
    return data.scorers ?? []
  } catch (err) {
    console.error('[football-data] scorers fetch failed:', err)
    return []
  }
}
