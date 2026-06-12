import type { RankingEntry } from '@/types'
import { PalpiteAvatar } from '@/components/ui/PalpiteAvatar'

interface Props {
  entries: RankingEntry[]
  currentUserId?: string
  maxPontos?: number
}

export function RankingTabela({ entries, currentUserId, maxPontos }: Props) {
  const maxPts = maxPontos ?? (entries[0]?.total_pontos ?? 0)
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
        const pct  = maxPts > 0 ? Math.round((entry.total_pontos / maxPts) * 100) : 0
        return (
          <div
            key={entry.palpite_id}
            className="grid grid-cols-12 gap-2 px-4 items-center"
            style={{
              paddingTop: 10, paddingBottom: 12,
              borderBottom: idx < entries.length - 1 ? '1px solid rgba(74,144,217,0.07)' : 'none',
              background: isMe
                ? 'rgba(74,144,217,0.08)'
                : idx % 2 === 0
                ? 'transparent'
                : 'rgba(255,255,255,0.01)',
              border: isMe ? '1px solid rgba(74,144,217,0.3)' : undefined,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Position + position change */}
            <div className="col-span-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
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
              {entry.variacao_posicao !== 0 && (
                <span style={{ fontSize: 8, fontWeight: 700, color: entry.variacao_posicao > 0 ? '#4ade80' : 'rgba(255,100,100,0.85)', lineHeight: 1 }}>
                  {entry.variacao_posicao > 0 ? `▲${entry.variacao_posicao}` : `▼${Math.abs(entry.variacao_posicao)}`}
                </span>
              )}
            </div>

            {/* Entry name */}
            <div className="col-span-5 flex items-center gap-2">
              <PalpiteAvatar nome={entry.nome} avatarType={entry.avatar_type} avatarValue={entry.avatar_value} size={26} />
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

            {/* Points + point variation */}
            <div className="col-span-3 text-right">
              <span
                className="text-sm font-bold"
                style={{ color: isMe ? '#4A90D9' : 'rgba(255,255,255,0.8)' }}
              >
                {entry.total_pontos} pts
              </span>
              {entry.variacao !== 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: entry.variacao > 0 ? '#4ade80' : 'rgba(255,100,100,0.85)' }}>
                  {entry.variacao > 0 ? `▲ +${entry.variacao} pts` : `▼ ${entry.variacao} pts`}
                </div>
              )}
            </div>

            {/* barra de desempenho — borda inferior da linha */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 }}>
              <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(74,222,128,0.55), rgba(74,222,128,0.15))', width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
