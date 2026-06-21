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
  '#c084fc', '#86efac', '#34d399', '#fca5a5',
  '#93c5fd', '#fcd34d', '#a3e635', '#f472b6',
  '#5eead4', '#fdba74', '#c4b5fd', '#67e8f9',
]

const NAME_COLORS = [
  '#1a5ca8', '#2d7a3a', '#7c3aed', '#b45309',
  '#be185d', '#0e7490', '#7f1d1d', '#065f46',
]
function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

/* Formata '2026-06-12' → '12/jun' */
function fmtData(iso: string): string {
  const [, m, d] = iso.split('-')
  const meses = ['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${parseInt(d)}/${meses[parseInt(m)]}`
}

/* Carrega imagens para os tipos upload e camisa */
async function loadImages(series: ChartSeries[]): Promise<Map<number, HTMLImageElement>> {
  const map = new Map<number, HTMLImageElement>()
  await Promise.all(
    series.map(s => {
      if (!s.avatar_type || !s.avatar_value) return null
      if (s.avatar_type !== 'upload' && s.avatar_type !== 'camisa') return null
      const src = s.avatar_type === 'camisa'
        ? `/avatar/Camiseta_${s.avatar_value}.png`
        : s.avatar_value
      return new Promise<void>(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload  = () => { map.set(s.palpite_id, img); resolve() }
        img.onerror = () => resolve()
        img.src = src
      })
    }).filter(Boolean)
  )
  return map
}

export function RankingEvolutionChart({ series: allSeries, datas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasW, setCanvasW] = useState(560)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [imgMap, setImgMap] = useState<Map<number, HTMLImageElement>>(new Map())
  const [isMobile, setIsMobile] = useState(false)

  /* responsividade — largura + breakpoint mobile */
  useEffect(() => {
    function update() {
      if (containerRef.current) setCanvasW(containerRef.current.clientWidth)
      setIsMobile(window.innerWidth < 768)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  /* no mobile, reduz para os 10 melhores (do dia mais recente) + você, pra não poluir */
  const series = (() => {
    if (!isMobile || allSeries.length <= 10) return allSeries
    const last = datas[datas.length - 1]
    const ordenado = [...allSeries].sort((a, b) => {
      const va = a.historico.find(h => h.data === last)?.total_pontos ?? 0
      const vb = b.historico.find(h => h.data === last)?.total_pontos ?? 0
      return vb - va
    })
    const top10 = ordenado.slice(0, 10)
    const eu = allSeries.filter(s => s.isMe && !top10.some(t => t.palpite_id === s.palpite_id))
    return [...top10, ...eu]
  })()

  /* carrega avatares (upload/camisa) uma vez */
  useEffect(() => {
    loadImages(allSeries).then(setImgMap)
  }, [allSeries])

  /* atribui cor a cada série */
  const seriesWithColor = series.map((s, i) => ({
    ...s,
    cor: s.isMe ? '#4A90D9' : LINE_COLORS[i % LINE_COLORS.length],
  }))

  const N = seriesWithColor.length
  const nDays = datas.length

  /* valor acumulado por dia, com gaps preenchidos pelo último valor conhecido */
  const valoresPorDia = seriesWithColor.map(s => {
    let last = 0
    return datas.map(d => {
      const h = s.historico.find(h => h.data === d)
      if (h) last = h.total_pontos
      return last
    })
  })

  /* posição (1 = melhor) por dia — desempate por pontos desc, depois palpite_id asc */
  const posicaoPorDia: number[][] = seriesWithColor.map(() => [])
  datas.forEach((_, i) => {
    const ranked = seriesWithColor
      .map((s, idx) => ({ idx, v: valoresPorDia[idx][i], id: s.palpite_id }))
      .sort((a, b) => b.v - a.v || a.id - b.id)
    ranked.forEach((r, pos) => { posicaoPorDia[r.idx][i] = pos + 1 })
  })

  const PAD_L = isMobile ? 20 : 26
  const PAD_R = isMobile ? 28 : 40
  const AR    = isMobile ? 8 : 9

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nDays < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W   = canvasW
    const H   = Math.max(180, Math.min(480, N * (isMobile ? 22 : 26) + 60))
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'
    ctx.scale(dpr, dpr)

    const PAD  = { t: 16, r: PAD_R, b: 30, l: PAD_L }
    const cw   = W - PAD.l - PAD.r
    const ch   = H - PAD.t - PAD.b

    function xOf(i: number) { return PAD.l + (i / (nDays - 1)) * cw }
    function yOf(pos: number) { return N > 1 ? PAD.t + ((pos - 1) / (N - 1)) * ch : PAD.t + ch / 2 }

    ctx.clearRect(0, 0, W, H)

    /* grid horizontal + número da posição à esquerda */
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    ctx.font = `${isMobile ? 8 : 9}px Inter`
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let p = 1; p <= N; p++) {
      const y = yOf(p)
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cw, y); ctx.stroke()
      ctx.fillText(String(p), PAD.l - 6, y)
    }

    /* x labels */
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    ctx.font = `${isMobile ? 8 : 9}px Inter`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const maxLabels = Math.floor(cw / (isMobile ? 36 : 44))
    const step = Math.max(1, Math.ceil(nDays / maxLabels))
    datas.forEach((d, i) => {
      if (i % step === 0 || i === nDays - 1)
        ctx.fillText(fmtData(d), xOf(i), H - PAD.b + 16)
    })

    /* desenha linhas — não-hover primeiro, hover por cima */
    const order = [...seriesWithColor.keys()].sort((a, b) => {
      const aHover = seriesWithColor[a].palpite_id === hoveredId ? 1 : 0
      const bHover = seriesWithColor[b].palpite_id === hoveredId ? 1 : 0
      return aHover - bHover
    })

    order.forEach(idx => {
      const s = seriesWithColor[idx]
      const isHover = hoveredId === s.palpite_id
      const dim = hoveredId !== null && !isHover

      ctx.beginPath()
      posicaoPorDia[idx].forEach((pos, i) => {
        const x = xOf(i), y = yOf(pos)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = dim ? s.cor + '20' : s.cor
      ctx.lineWidth   = isHover ? 3.5 : (s.isMe ? 2.2 : 1.4)
      ctx.stroke()
    })

    /* avatares no último dia */
    order.forEach(idx => {
      const s = seriesWithColor[idx]
      const isHover = hoveredId === s.palpite_id
      const dim = hoveredId !== null && !isHover
      const x = xOf(nDays - 1)
      const y = yOf(posicaoPorDia[idx][nDays - 1])
      const r = isHover ? AR + 2 : AR
      const img = imgMap.get(s.palpite_id) ?? null

      ctx.save()
      ctx.globalAlpha = dim ? 0.30 : 1
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = img || s.avatar_type === 'emoji'
        ? 'rgba(13,30,61,0.9)'
        : (s.avatar_type ? 'rgba(74,144,217,0.10)' : nameToColor(s.nome) + 'cc')
      ctx.fill()
      ctx.strokeStyle = s.cor
      ctx.lineWidth = isHover || s.isMe ? 2 : 1
      ctx.stroke()

      if (img) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, r - 1, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(img, x - r + 1, y - r + 1, (r - 1) * 2, (r - 1) * 2)
        ctx.restore()
      } else if (s.avatar_type === 'emoji' && s.avatar_value) {
        ctx.font = `${Math.round(r * 1.1)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.avatar_value, x, y + 1)
      } else {
        ctx.fillStyle = '#fff'
        ctx.font = `700 ${Math.round(r * 0.75)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(initials(s.nome), x, y)
      }
      ctx.restore()
    })

  }, [canvasW, series, datas, hoveredId, imgMap, N, nDays, posicaoPorDia, seriesWithColor, isMobile, PAD_L, PAD_R, AR])

  /* testa linhas (proximidade no x mais próximo) + avatares (último ponto) a partir de coordenadas relativas ao canvas */
  function hitTest(mx: number, my: number) {
    const H  = canvasRef.current!.getBoundingClientRect().height
    const cw = canvasW - PAD_L - PAD_R
    const ch = H - 16 - 30

    function xOf(i: number) { return PAD_L + (i / (nDays - 1)) * cw }
    function yOf(pos: number) { return N > 1 ? 16 + ((pos - 1) / (N - 1)) * ch : 16 + ch / 2 }

    const idx = Math.round(((mx - PAD_L) / cw) * (nDays - 1))
    const dayIdx = Math.max(0, Math.min(nDays - 1, idx))

    let bestId: number | null = null
    let bestDist = 14

    seriesWithColor.forEach((s, sIdx) => {
      const y = yOf(posicaoPorDia[sIdx][dayIdx])
      const d = Math.abs(my - y)
      if (d < bestDist) { bestDist = d; bestId = s.palpite_id }
    })

    /* checa avatares no último ponto com prioridade */
    seriesWithColor.forEach((s, sIdx) => {
      const x = xOf(nDays - 1)
      const y = yOf(posicaoPorDia[sIdx][nDays - 1])
      const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2)
      if (dist < AR + 3) bestId = s.palpite_id
    })

    return bestId
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || nDays < 2) return
    const rect = canvas.getBoundingClientRect()
    setHoveredId(hitTest(e.clientX - rect.left, e.clientY - rect.top))
  }

  function handleTouch(e: React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || nDays < 2) return
    const rect = canvas.getBoundingClientRect()
    const t = e.touches[0]
    if (!t) return
    setHoveredId(hitTest(t.clientX - rect.left, t.clientY - rect.top))
  }

  if (nDays < 2) return null

  const selecionado = seriesWithColor.find(s => s.palpite_id === hoveredId) ?? null
  const ultimoValor = selecionado ? valoresPorDia[seriesWithColor.indexOf(selecionado)][nDays - 1] : null

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minHeight: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Evolução diária da pontuação para os líderes + você
        </div>
        {selecionado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: selecionado.cor, flexShrink: 0 }} />
            {selecionado.nome}
            <span style={{ color: selecionado.cor, fontWeight: 800 }}>{ultimoValor} pts</span>
          </div>
        )}
      </div>

      {/* canvas */}
      <canvas
        ref={canvasRef}
        style={{ cursor: hoveredId !== null ? 'pointer' : 'crosshair', display: 'block', width: '100%', touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredId(null)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setHoveredId(null)}
      />
    </div>
  )
}
