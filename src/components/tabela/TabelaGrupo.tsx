import { FlagImg } from '@/components/ui/FlagImg'
import type { GrupoStanding } from '@/types'

interface Props {
  grupo: GrupoStanding
}

export function TabelaGrupo({ grupo }: Props) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: 'linear-gradient(90deg, rgba(74,144,217,0.18), rgba(74,144,217,0.05))',
          borderBottom: '1px solid rgba(74,144,217,0.15)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-bebas text-xl leading-none"
            style={{ color: '#4A90D9' }}
          >
            GRUPO {grupo.grupo}
          </span>
        </div>
        <div className="flex gap-3 text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <span className="w-6 text-center">J</span>
          <span className="w-6 text-center">V</span>
          <span className="w-6 text-center">SG</span>
          <span className="w-6 text-center">GP</span>
          <span className="w-8 text-center font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>PTS</span>
        </div>
      </div>

      {/* Rows */}
      {grupo.times.map((time, idx) => {
        const classifica = idx < 2
        return (
          <div
            key={time.time}
            className="flex items-center px-4 py-2.5"
            style={{
              borderBottom: idx < grupo.times.length - 1 ? '1px solid rgba(74,144,217,0.07)' : 'none',
              background: classifica ? 'rgba(74,144,217,0.04)' : 'transparent',
            }}
          >
            {/* Position */}
            <span
              className="text-xs font-bold w-4 mr-3"
              style={{ color: classifica ? '#4A90D9' : 'rgba(255,255,255,0.25)' }}
            >
              {idx + 1}
            </span>

            {/* Qualifying indicator */}
            {classifica && (
              <div
                className="w-0.5 h-5 mr-2 rounded-full"
                style={{ background: '#4A90D9' }}
              />
            )}
            {!classifica && <div className="w-0.5 mr-2" />}

            {/* Flag + Team */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FlagImg codigo={time.codigo_pais} size={18} />
              <span
                className="text-sm font-medium truncate"
                style={{ color: classifica ? '#fff' : 'rgba(255,255,255,0.7)' }}
              >
                {time.time}
              </span>
            </div>

            {/* Stats */}
            <div className="flex gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span className="w-6 text-center">{time.jogos}</span>
              <span className="w-6 text-center">{time.vitorias}</span>
              <span
                className="w-6 text-center"
                style={{
                  color:
                    time.saldo_gols > 0
                      ? 'rgba(255,255,255,0.6)'
                      : time.saldo_gols < 0
                      ? 'rgba(255,100,100,0.7)'
                      : 'rgba(255,255,255,0.35)',
                }}
              >
                {time.saldo_gols > 0 ? `+${time.saldo_gols}` : time.saldo_gols}
              </span>
              <span className="w-6 text-center">{time.gols_pro}</span>
              <span
                className="w-8 text-center font-bold text-sm"
                style={{ color: classifica ? '#4A90D9' : 'rgba(255,255,255,0.6)' }}
              >
                {time.pontos}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
