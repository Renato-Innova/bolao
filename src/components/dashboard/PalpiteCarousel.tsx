'use client'

import { useEffect, useRef, useState } from 'react'

export interface PalpiteSlide {
  palpite_id: number
  nome: string
  total_pontos: number
  posicao: number
  total: number   // total de palpites no ranking (para exibir "de X")
  status: string  // 'ativo' | 'inativo'
}

interface Props {
  slides: PalpiteSlide[]
}

export function PalpiteCarousel({ slides }: Props) {
  const [current, setCurrent]   = useState(0)
  const [exiting, setExiting]   = useState<number | null>(null)
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartY             = useRef<number | null>(null)

  const total = slides.length

  function goTo(next: number) {
    if (next === current || total <= 1) return
    setExiting(current)
    setTimeout(() => {
      setCurrent(next)
      setExiting(null)
    }, 550)
  }

  function advance() {
    goTo((current + 1) % total)
  }

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (total > 1) timerRef.current = setInterval(advance, 5000)
  }

  useEffect(() => {
    resetTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total])

  if (total === 0) {
    return (
      <div style={styles.card}>
        <div style={styles.bar} />
        <div style={{ padding: '16px 18px', height: 110, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={styles.nome}>Nenhum palpite</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Crie um palpite para participar</div>
        </div>
      </div>
    )
  }

  const slide = slides[current]
  const isAtivo = slide.status === 'ativo'

  return (
    <div
      style={styles.card}
      onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
      onTouchEnd={e => {
        if (touchStartY.current === null) return
        const dy = touchStartY.current - e.changedTouches[0].clientY
        if (Math.abs(dy) > 28) {
          resetTimer()
          goTo(dy > 0
            ? (current + 1) % total
            : (current - 1 + total) % total
          )
        }
        touchStartY.current = null
      }}
    >
      <div style={styles.bar} />

      {/* viewport com overflow hidden para animação */}
      <div style={styles.viewport}>

        {/* slide a sair — sobe para cima */}
        {exiting !== null && (
          <div key={`exit-${exiting}`} style={{ ...styles.slide, ...styles.slideExiting }}>
            <SlideContent slide={slides[exiting]} />
          </div>
        )}

        {/* slide ativo — vem de baixo */}
        <div
          key={`active-${current}`}
          style={{
            ...styles.slide,
            ...(exiting !== null ? styles.slideEntering : styles.slideActive),
          }}
        >
          <SlideContent slide={slide} />
        </div>

      </div>

      {/* status badge */}
      {!isAtivo && (
        <div style={styles.inativoBadge}>inativo</div>
      )}

      {/* dots */}
      {total > 1 && (
        <div style={styles.dots}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { resetTimer(); goTo(i) }}
              style={{ ...styles.dot, ...(i === current ? styles.dotOn : {}) }}
              aria-label={`Palpite ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SlideContent({ slide }: { slide: PalpiteSlide }) {
  return (
    <div style={styles.slideInner}>
      {/* nome do palpite */}
      <div style={styles.nome}>
        <span style={{
          display: 'inline-block', width: 6, height: 6,
          borderRadius: '50%', flexShrink: 0,
          background: slide.status === 'ativo' ? '#4ade80' : 'rgba(255,255,255,0.30)',
          marginRight: 7,
        }} />
        {slide.nome}
      </div>

      {/* métricas lado a lado */}
      <div style={styles.metrics}>
        <div>
          <div style={styles.lbl}>Sua Pontuação</div>
          <div style={styles.valBlue}>{slide.total_pontos}</div>
          <div style={styles.sub}>pts no bolão</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.lbl}>Sua Posição</div>
          <div style={{ ...styles.valBlue, color: slide.status === 'ativo' ? '#FFD700' : 'rgba(255,255,255,0.45)' }}>
            {slide.status === 'ativo' ? `#${slide.posicao}°` : '—'}
          </div>
          <div style={styles.sub}>de {slide.total}</div>
        </div>
      </div>
    </div>
  )
}

/* ── estilos ─────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#0D1E3D',
    border: '1px solid rgba(74,144,217,0.15)',
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden',
    height: 120,
  },
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)',
    zIndex: 2,
  },
  viewport: {
    position: 'absolute', inset: 0,
    overflow: 'hidden',
  },
  slide: {
    position: 'absolute', inset: 0,
    transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1), opacity 0.55s',
  },
  slideActive: {
    transform: 'translateY(0)',
    opacity: 1,
  },
  slideEntering: {
    transform: 'translateY(100%)',
    opacity: 0,
    animation: 'slideUp 0.55s cubic-bezier(0.4,0,0.2,1) forwards',
  },
  slideExiting: {
    transform: 'translateY(-100%)',
    opacity: 0,
  },
  slideInner: {
    padding: '14px 16px 10px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 4,
  },
  nome: {
    fontSize: 10, fontWeight: 700,
    color: '#7BB8F0',
    textTransform: 'uppercase', letterSpacing: 0.8,
    display: 'flex', alignItems: 'center',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    marginBottom: 5,
  },
  metrics: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lbl: {
    fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.7,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 3,
  },
  valBlue: {
    fontSize: 22, fontWeight: 800,
    color: '#4A90D9',
    lineHeight: 1,
  },
  sub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    marginTop: 2,
  },
  inativoBadge: {
    position: 'absolute', top: 8, right: 10,
    fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.35)',
    padding: '2px 7px', borderRadius: 10,
    zIndex: 3,
  },
  dots: {
    position: 'absolute', bottom: 7, left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', gap: 5, zIndex: 3,
  },
  dot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'rgba(255,255,255,0.20)',
    border: 'none', cursor: 'pointer', padding: 0,
    transition: 'background 0.3s',
  },
  dotOn: {
    background: '#4A90D9',
  },
}
