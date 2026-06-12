'use client'

import { useEffect, useRef, useState } from 'react'

export interface ChartSeries {
  palpite_id: number
  nome: string
  isMe: boolean
  avatar_type?: string | null
  avatar_value?: string | null
  // array of { data: 'YYYY-MM-DD', total_pontos: number } sorted ascending
  historico: { data: string; total_pontos: number }[]
}

interface Props {
  series: ChartSeries[]
  // all unique dates sorted ascending
  datas: string[]
}

/* Paleta de cores para as linhas (exceto "você") */
const LINE_COLORS = [
  '#7BB8F0', '#f97316', '#a78bfa', '#4ade80',
  '#f43f5e', '#facc15', '#38bdf8', '#fb923c',
  '#c084fc', '#86efac',
]

/* Formata '2026-06-12' → '12/jun' */
function fmtData(iso: string): string {
  const [, m, d] = iso.split('-')
  const meses = ['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${parseInt(d)}/${meses[parseInt(m)]}`
}

export function RankingEvolutionChart({ series, datas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [canvasW, setCanvasW] = useState(560)

  /* responsividade */
  useEffect(() => {
    function update() {
      if (containerRef.current) setCanvasW(containerRef.current.clientWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  /* atribui cor a cada série */
  const seriesWithColor = series.map((s, i) => ({
    ...s,
    cor: s.isMe ? '#4A90D9' : LINE_COLORS[i % LINE_COLORS.length],
  }))

  const eu = seriesWithColor.find(s => s.isMe)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || datas.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W   = canvasW
    const H   = 220
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'
    ctx.scale(dpr, dpr)

    const PAD  = { t: 28, r: 58, b: 38, l: 48 }
    const cw   = W - PAD.l - PAD.r
    const ch   = H - PAD.t - PAD.b
    const nDays = datas.length

    /* max pontos */
    const allPts = seriesWithColor.flatMap(s => s.historico.map(h => h.total_pontos))
    const maxPts = Math.max(...allPts, 100)
    const ceil   = Math.ceil(maxPts / 100) * 100

    function xOf(i: number) { return PAD.l + (i / (nDays - 1)) * cw }
    function yOf(v: number) { return PAD.t + ch - (v / ceil) * ch }

    /* ── background ── */
    ctx.clearRect(0, 0, W, H)

    /* ── grid + eixo esquerdo + eixo direito ── */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    const steps = 4
    for (let k = 0; k <= steps; k++) {
      const v = (ceil / steps) * k
      const y = yOf(v)
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cw, y); ctx.stroke()
      const label = String(Math.round(v))
      ctx.fillStyle = 'rgba(255,255,255,0.30)'
      ctx.font = '9px Inter'
      /* esquerda */
      ctx.textAlign = 'right'
      ctx.fillText(label, PAD.l - 6, y + 3)
      /* direita */
      ctx.textAlign = 'left'
      ctx.fillText(label, PAD.l + cw + 8, y + 3)
    }

    /* ── x labels ── */
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    ctx.font = '9px Inter'
    ctx.textAlign = 'center'
    const maxLabels = Math.floor(cw / 44)
    const step = Math.max(1, Math.ceil(nDays / maxLabels))
    datas.forEach((d, i) => {
      if (i % step === 0 || i === nDays - 1)
        ctx.fillText(fmtData(d), xOf(i), H - PAD.b + 13)
    })

    /* ── hover linha vertical ── */
    if (hoverIdx !== null) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(xOf(hoverIdx), PAD.t)
      ctx.lineTo(xOf(hoverIdx), PAD.t + ch)
      ctx.stroke()
      ctx.setLineDash([])
    }

    /* ── linhas (não-eu primeiro, depois eu por cima) ── */
    const drawOrder = [...seriesWithColor.filter(s => !s.isMe), ...seriesWithColor.filter(s => s.isMe)]

    drawOrder.forEach(s => {
      const pts = datas.map(d => {
        const h = s.historico.find(h => h.data === d)
        return h ? h.total_pontos : null
      })

      /* preenche gaps com último valor conhecido */
      let last = 0
      const filled = pts.map(v => { if (v !== null) last = v; return last })

      if (s.isMe) {
        /* área */
        ctx.beginPath()
        filled.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)))
        ctx.lineTo(xOf(nDays - 1), yOf(0))
        ctx.lineTo(xOf(0), yOf(0))
        ctx.closePath()
        const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + ch)
        grad.addColorStop(0, s.cor + '30')
        grad.addColorStop(1, s.cor + '00')
        ctx.fillStyle = grad
        ctx.fill()
      }

      ctx.beginPath()
      filled.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)))
      ctx.strokeStyle = s.isMe ? s.cor : s.cor + '70'
      ctx.lineWidth   = s.isMe ? 2.5 : 1.5
      ctx.stroke()

      /* ponto no hover ou no último */
      if (hoverIdx !== null) {
        const x = xOf(hoverIdx), y = yOf(filled[hoverIdx])
        ctx.beginPath(); ctx.arc(x, y, s.isMe ? 5 : 3.5, 0, Math.PI * 2)
        ctx.fillStyle = s.cor; ctx.fill()
        if (s.isMe) { ctx.strokeStyle = '#0D1E3D'; ctx.lineWidth = 2; ctx.stroke() }
      } else {
        const lx = xOf(nDays - 1), ly = yOf(filled[nDays - 1])
        ctx.beginPath(); ctx.arc(lx, ly, s.isMe ? 4 : 3, 0, Math.PI * 2)
        ctx.fillStyle = s.cor; ctx.fill()
        if (s.isMe) { ctx.strokeStyle = '#0D1E3D'; ctx.lineWidth = 2; ctx.stroke() }
      }
    })

    /* ── tooltip ── */
    if (hoverIdx !== null) {
      const sorted = [...seriesWithColor].sort((a, b) => {
        const ap = a.historico.find(h => h.data === datas[hoverIdx!])?.total_pontos ?? 0
        const bp = b.historico.find(h => h.data === datas[hoverIdx!])?.total_pontos ?? 0
        return bp - ap
      })

      const rows   = sorted.length
      const bw     = 130
      const bh     = rows * 17 + 26
      let bx       = xOf(hoverIdx) + 12
      if (bx + bw > W - 4) bx = xOf(hoverIdx) - bw - 12
      const by = PAD.t + 4

      /* caixa */
      ctx.beginPath()
      ctx.moveTo(bx + 6, by)
      ctx.lineTo(bx + bw - 6, by)
      ctx.arcTo(bx + bw, by, bx + bw, by + 6, 6)
      ctx.lineTo(bx + bw, by + bh - 6)
      ctx.arcTo(bx + bw, by + bh, bx + bw - 6, by + bh, 6)
      ctx.lineTo(bx + 6, by + bh)
      ctx.arcTo(bx, by + bh, bx, by + bh - 6, 6)
      ctx.lineTo(bx, by + 6)
      ctx.arcTo(bx, by, bx + 6, by, 6)
      ctx.closePath()
      ctx.fillStyle = '#071529'
      ctx.fill()
      ctx.strokeStyle = 'rgba(74,144,217,0.45)'
      ctx.lineWidth = 1
      ctx.stroke()

      /* data */
      ctx.fillStyle = 'rgba(255,255,255,0.50)'
      ctx.font = '700 9px Inter'
      ctx.textAlign = 'left'
      ctx.fillText(fmtData(datas[hoverIdx]), bx + 9, by + 14)

      sorted.forEach((s, i) => {
        const ptVal = (() => {
          let last = 0
          for (let k = 0; k <= hoverIdx!; k++) {
            const h = s.historico.find(h => h.data === datas[k])
            if (h) last = h.total_pontos
          }
          return last
        })()

        const ty = by + 26 + i * 17
        ctx.beginPath(); ctx.arc(bx + 10, ty - 3, 3, 0, Math.PI * 2)
        ctx.fillStyle = s.cor; ctx.fill()
        ctx.fillStyle = s.isMe ? 'white' : 'rgba(255,255,255,0.65)'
        ctx.font = s.isMe ? '700 9px Inter' : '400 9px Inter'
        ctx.textAlign = 'left'
        ctx.fillText(s.nome.slice(0, 12), bx + 18, ty)
        ctx.fillStyle = s.cor
        ctx.font = '700 9px Inter'
        ctx.textAlign = 'right'
        ctx.fillText(ptVal + ' pts', bx + bw - 7, ty)
      })
    }

  }, [canvasW, hoverIdx, series, datas, seriesWithColor])

  /* mouse */
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || datas.length < 2) return
    const rect  = canvas.getBoundingClientRect()
    const mx    = e.clientX - rect.left
    const PAD_L = 48
    const PAD_R = 58
    const cw    = canvasW - PAD_L - PAD_R
    const idx   = Math.round(((mx - PAD_L) / cw) * (datas.length - 1))
    setHoverIdx(Math.max(0, Math.min(datas.length - 1, idx)))
  }

  if (datas.length < 2) return null

  return (
    <div
      ref={containerRef}
      style={{
        background: '#0D1E3D',
        border: '1px solid rgba(74,144,217,0.15)',
        borderRadius: 10,
        padding: '14px 16px 14px',
        marginBottom: 16,
      }}
    >
      {/* cabeçalho */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Evolução diária da pontuação para os líderes + você
        </div>
      </div>

      {/* canvas */}
      <canvas
        ref={canvasRef}
        style={{ cursor: 'crosshair', display: 'block', width: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      />

      {/* legenda centralizada */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center', marginTop: 10 }}>
        {seriesWithColor.map(s => (
          <div key={s.palpite_id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.cor, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: s.isMe ? 'white' : 'rgba(255,255,255,0.50)', fontWeight: s.isMe ? 700 : 400 }}>
              {s.nome}{s.isMe ? ' (você)' : ''}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}
