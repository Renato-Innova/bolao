import { TEAMS } from './constants'

export function getFlagUrl(codigo: string, size: 'w20' | 'w40' | 'w80' = 'w40'): string {
  return `https://flagcdn.com/${size}/${codigo}.png`
}

export function getCodigoPais(nomeTime: string): string {
  return TEAMS[nomeTime]?.codigo ?? 'un'
}

export function calcularPontos(
  palpiteA: number,
  palpiteB: number,
  realA: number,
  realB: number,
  pontosExato: number,
  pontosVencedor: number
): number {
  if (palpiteA === realA && palpiteB === realB) return pontosExato
  const palpiteVencedor = palpiteA > palpiteB ? 'A' : palpiteA < palpiteB ? 'B' : 'E'
  const realVencedor = realA > realB ? 'A' : realA < realB ? 'B' : 'E'
  if (palpiteVencedor === realVencedor) return pontosVencedor
  return 0
}

export function formatarPlacar(a?: number | null, b?: number | null): string {
  if (a == null || b == null) return '- x -'
  return `${a} x ${b}`
}
