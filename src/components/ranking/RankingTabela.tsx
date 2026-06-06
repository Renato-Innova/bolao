import type { RankingEntry } from '@/types'

interface Props {
  entries: RankingEntry[]
  currentUserId?: string
}

export function RankingTabela({ entries, currentUserId }: Props) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {/* Table header */}
      <div
        className="grid grid-cols-12 gap-2 px-4 py-3 text-xs uppercase tracking-widest"
        style={{
          background: 'rgba(74,144,217,0.08)',
          borderBottom: '1px solid rgba(74,144,217,0.15)',
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        <div className="col-span-1">#</div>
        <div className="col-span-5">Palpite</div>
        <div className="col-span-3">Participante</div>
        <div className="col-span-3 text-right">Pontos</div>
      </div>

      {entries.map((entry, idx) => {
        const isMe = entry.usuario_id === currentUserId
        return (
          <div
            key={entry.palpite_id}
            className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
            style={{
              borderBottom: idx < entries.length - 1 ? '1px solid rgba(74,144,217,0.07)' : 'none',
              background: isMe
                ? 'rgba(74,144,217,0.08)'
                : idx % 2 === 0
                ? 'transparent'
                : 'rgba(255,255,255,0.01)',
              border: isMe ? '1px solid rgba(74,144,217,0.3)' : undefined,
            }}
          >
            {/* Position */}
            <div className="col-span-1">
              <span
                className="text-sm font-bold"
                style={{
                  color: entry.posicao === 1 ? '#FFD700'
                    : entry.posicao === 2 ? '#C0C0C0'
                    : entry.posicao === 3 ? '#CD7F32'
                    : isMe ? '#4A90D9'
                    : 'rgba(255,255,255,0.25)',
                }}
              >
                {entry.posicao}
              </span>
            </div>

            {/* Entry name */}
            <div className="col-span-5 flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">{entry.nome}</span>
              {isMe && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(74,144,217,0.2)', color: '#7BB8F0' }}
                >
                  você
                </span>
              )}
            </div>

            {/* User */}
            <div className="col-span-3">
              <span className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {entry.usuario_nome}
              </span>
            </div>

            {/* Points */}
            <div className="col-span-3 text-right">
              <span
                className="text-sm font-bold"
                style={{ color: isMe ? '#4A90D9' : 'rgba(255,255,255,0.8)' }}
              >
                {entry.total_pontos} pts
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
