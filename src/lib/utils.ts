export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

export function formatDateTime(dateStr: string, timeStr: string): string {
  return `${formatDate(dateStr)} às ${formatTime(timeStr)}`
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getVencedor(a: number, b: number): 'A' | 'B' | 'E' {
  if (a > b) return 'A'
  if (b > a) return 'B'
  return 'E'
}
