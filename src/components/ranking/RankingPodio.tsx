import type { RankingEntry } from '@/types'

interface Props {
  top3: RankingEntry[]
}

const HEIGHTS = ['h-24', 'h-32', 'h-20']
const ORDER = [1, 0, 2] // display order: 2nd, 1st, 3rd

export function RankingPodio({ top3 }: Props) {
  const COLORS = ['#C0C0C0', '#FFD700', '#CD7F32']

  return (
    <div className="flex items-end justify-center gap-4 mb-8 px-4">
      {ORDER.map(idx => {
        const entry = top3[idx]
        if (!entry) return null
        const color = COLORS[idx]
        const isFirst = idx === 0
        return (
          <div key={entry.palpite_id} className="flex flex-col items-center flex-1 max-w-[160px]">
            {isFirst && (
              <div className="text-2xl mb-1">👑</div>
            )}
            <div className="text-center mb-3">
              <div className="font-bold text-white text-sm leading-tight">{entry.nome}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{entry.usuario_nome}</div>
              <div className="text-xl font-bold mt-1" style={{ color: '#4A90D9' }}>{entry.total_pontos}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>pts</div>
            </div>
            <div
              className={`w-full rounded-t-lg flex items-start justify-center pt-3 ${HEIGHTS[idx]}`}
              style={{
                background: `linear-gradient(180deg, ${color}20, ${color}10)`,
                border: `1px solid ${color}40`,
                borderBottom: 'none',
              }}
            >
              <span
                className="font-bebas text-4xl"
                style={{ color }}
              >
                {idx + 1}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
