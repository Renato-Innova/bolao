'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface JogoHoje {
  id: number
  time_a: string
  time_b: string
  codigo_pais_a: string
  codigo_pais_b: string
  horario: string
  fase: string
  grupo: string | null
  resultado: {
    placar_real_a: number
    placar_real_b: number
    placar_penalti_a?: number | null
    placar_penalti_b?: number | null
  } | null
  total: number
  winA: number
  draw: number
  winB: number
}

interface Props {
  jogos: JogoHoje[]
  jogosRealizados: number
  totalJogos: number
  faseAtual: string
}

function Flag({ codigo, size = 18 }: { codigo: string; size?: number }) {
  if (!codigo) return null
  return (
    <img
      src={`https://flagcdn.com/w40/${codigo}.png`}
      width={size}
      height={Math.round(size * 0.67)}
      alt=""
      style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
    />
  )
}

function pct(n: number, total: number) {
  if (!total) return 0
  return Math.round((n / total) * 100)
}

export function JogosDiaCard({ jogos, jogosRealizados, totalJogos, faseAtual }: Props) {
  const [idx, setIdx]     = useState(0)
  const touchStart        = useRef<number | null>(null)
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  const total = jogos.length

  const next = useCallback(() => setIdx(i => (i + 1) % Math.max(total, 1)), [total])
  const prev = useCallback(() => setIdx(i => (i - 1 + Math.max(total, 1)) % Math.max(total, 1)), [total])

  // auto-flip
  useEffect(() => {
    if (total <= 1) return
    intervalRef.current = setInterval(next, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [next, total])

  function resetTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (total > 1) intervalRef.current = setInterval(next, 5000)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current === null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(dx) < 30) return
    resetTimer()
    if (dx < 0) next(); else prev()
  }

  const progressPct = totalJogos ? Math.round((jogosRealizados / totalJogos) * 100) : 0

  const card: React.CSSProperties = {
    background: '#0D1E3D',
    border: '1px solid rgba(74,144,217,0.15)',
    borderRadius: 10,
    padding: '14px 16px',
    position: 'relative',
    overflow: 'hidden',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }

  const jogo = total > 0 ? jogos[idx] : null
  const encerrado = !!jogo?.resultado

  // dominant outcome
  let dominante: 'winA' | 'winB' | 'draw' | null = null
  if (jogo && jogo.total > 0) {
    const vals = { winA: jogo.winA, draw: jogo.draw, winB: jogo.winB }
    dominante = (Object.keys(vals) as Array<keyof typeof vals>).reduce((a, b) =>
      vals[a] >= vals[b] ? a : b
    )
  }

  return (
    <div style={card} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)' }} />

      {/* Progress section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Jogos realizados
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            <strong style={{ color: 'white', fontSize: 13 }}>{jogosRealizados}</strong>
            <span style={{ color: 'rgba(255,255,255,0.40)' }}> / {totalJogos ?? 104}</span>
          </span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #4A90D9, #7BB8F0)', borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{faseAtual}</div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(74,144,217,0.12)' }} />

      {/* Game slide */}
      {total === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Nenhum jogo hoje</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Phase + time label */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {jogo!.grupo ? `Grupo ${jogo!.grupo}` : jogo!.fase}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)' }}>{jogo!.horario?.slice(0, 5)}</span>
          </div>

          {/* Teams + result row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 6 }}>
            {/* Time A */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Flag codigo={jogo!.codigo_pais_a} size={18} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{jogo!.time_a}</span>
            </div>

            {/* Score or vs */}
            <div style={{ textAlign: 'center', minWidth: 52 }}>
              {encerrado ? (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#4A90D9', letterSpacing: 1, lineHeight: 1 }}>
                    {jogo!.resultado!.placar_real_a} × {jogo!.resultado!.placar_real_b}
                  </div>
                  {jogo!.resultado!.placar_penalti_a != null && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                      pên {jogo!.resultado!.placar_penalti_a}–{jogo!.resultado!.placar_penalti_b}
                    </div>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>encerrado</div>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', fontWeight: 600 }}>vs</span>
              )}
            </div>

            {/* Time B */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'white', lineHeight: 1.2, textAlign: 'right' }}>{jogo!.time_b}</span>
              <Flag codigo={jogo!.codigo_pais_b} size={18} />
            </div>
          </div>

          {/* Palpite breakdown */}
          {jogo!.total > 0 ? (
            <div>
              <div style={{ display: 'flex', gap: 3, height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                {jogo!.winA > 0 && (
                  <div style={{ flex: jogo!.winA, background: dominante === 'winA' ? '#4A90D9' : 'rgba(74,144,217,0.40)', transition: 'flex 0.4s' }} />
                )}
                {jogo!.draw > 0 && (
                  <div style={{ flex: jogo!.draw, background: dominante === 'draw' ? '#F59E0B' : 'rgba(245,158,11,0.40)', transition: 'flex 0.4s' }} />
                )}
                {jogo!.winB > 0 && (
                  <div style={{ flex: jogo!.winB, background: dominante === 'winB' ? '#7BB8F0' : 'rgba(123,184,240,0.40)', transition: 'flex 0.4s' }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ color: dominante === 'winA' ? '#7BB8F0' : undefined, fontWeight: dominante === 'winA' ? 700 : 400 }}>
                  {pct(jogo!.winA, jogo!.total)}% vitória
                </span>
                <span style={{ color: dominante === 'draw' ? '#F59E0B' : undefined, fontWeight: dominante === 'draw' ? 700 : 400 }}>
                  {pct(jogo!.draw, jogo!.total)}% empate
                </span>
                <span style={{ color: dominante === 'winB' ? '#4A90D9' : undefined, fontWeight: dominante === 'winB' ? 700 : 400 }}>
                  {pct(jogo!.winB, jogo!.total)}% vitória
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', textAlign: 'center' }}>Sem palpites registrados</div>
          )}
        </div>
      )}

      {/* Dots navigation */}
      {total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingTop: 2 }}>
          {jogos.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); resetTimer() }}
              style={{
                width: i === idx ? 14 : 6, height: 6,
                borderRadius: 3, border: 'none', cursor: 'pointer',
                background: i === idx ? '#4A90D9' : 'rgba(255,255,255,0.20)',
                padding: 0, transition: 'all 0.25s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
