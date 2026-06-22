'use client'

import { useEffect, useRef, useState } from 'react'

export interface ChartSeries {
  palpite_id: number
  nome: string
  isMe: boolean
  avatar_type?: string | null
  avatar_value?: string | null
  // posição oficial atual (getRanking() — já desempata por acertos exatos). Fallback para o último dia.
  posicaoOficial?: number
  // array de pontos por dia. `posicao`, quando presente, vem de ranking_historico_completo
  // (ou do ranking ao vivo p/ hoje) e já reflete o desempate por acertos exatos.
  historico: { data: string; total_pontos: number; posicao?: number }[]
}

interface Props {
  series: ChartSeries[]
  // all unique dates sorted ascending
  datas: string[]
}

type Visao = 'top15' | 'top25' | 'meio' | 'ultimos25'

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

const ROW_H_DESKTOP = 22
const ROW_H_MOBILE  = 18
const PAD_TOP = 16
const PAD_BOTTOM = 30

export function RankingEvolutionChart({ series: allSeries, datas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [canvasW, setCanvasW] = useState(560)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [pinnedId, setPinnedId] = useState<number | null>(null)
  const [imgMap, setImgMap] = useState<Map<number, HTMLImageElement>>(new Map())
  const [isMobile, setIsMobile] = useState(false)
  const [visao, setVisao] = useState<Visao>('top15')

  useEffect(() => {
    function update() {
      if (boxRef.current) setCanvasW(boxRef.current.clientWidth)
      setIsMobile(window.innerWidth < 768)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    loadImages(allSeries).then(setImgMap)
  }, [allSeries])

  /* ordena por posição oficial atual (líder primeiro) */
  const ordenado = [...allSeries].sort((a, b) => (a.posicaoOficial ?? 999) - (b.posicaoOficial ?? 999))

  const ROW_H = isMobile ? ROW_H_MOBILE : ROW_H_DESKTOP
  const nDays = datas.length

  const total = ordenado.length
  const top15Count     = Math.min(15, total)
  const top25Count     = Math.min(25, total)
  const meioCount      = Math.min(25, total)
  const ultimos25Count = Math.min(25, total)
  // janela "Meio" centralizada: início = floor((total-25)/2)+1
  const meioInicio = Math.max(1, Math.floor((total - meioCount) / 2) + 1)

  const series = visao === 'top15' ? ordenado.slice(0, top15Count)
    : visao === 'top25' ? ordenado.slice(0, top25Count)
    : visao === 'meio'  ? ordenado.slice(meioInicio - 1, meioInicio - 1 + meioCount)
    : ordenado.slice(-ultimos25Count)

  const seriesWithColor = series.map((s, i) => ({
    ...s,
    cor: s.isMe ? '#4A90D9' : LINE_COLORS[i % LINE_COLORS.length],
  }))
  const N = seriesWithColor.length

  /* valor acumulado por dia, com gaps preenchidos pelo último valor conhecido */
  const valoresPorDia = seriesWithColor.map(s => {
    let last = 0
    return datas.map(d => {
      const h = s.historico.find(h => h.data === d)
      if (h) last = h.total_pontos
      return last
    })
  })

  /* posição (1 = melhor, dentro do subconjunto exibido) por dia */
  const lastDayIdx = datas.length - 1
  const posicaoPorDia: number[][] = seriesWithColor.map(() => [])
  datas.forEach((data, i) => {
    const isLast = i === lastDayIdx
    const posicoesSalvas = seriesWithColor.map(s => {
      const h = s.historico.find(h => h.data === data)
      return h?.posicao ?? (isLast ? s.posicaoOficial : undefined)
    })
    const diaCompleto = posicoesSalvas.every(p => p != null)

    const ranked = seriesWithColor
      .map((s, idx) => ({ idx, v: valoresPorDia[idx][i], id: s.palpite_id, salva: posicoesSalvas[idx] }))
      .sort((a, b) => {
        if (diaCompleto) return (a.salva as number) - (b.salva as number)
        return b.v - a.v || a.id - b.id
      })
    ranked.forEach((r, pos) => { posicaoPorDia[r.idx][i] = pos + 1 })
  })

  // Altura do conteúdo do gráfico atual (cresce com N)
  const contentH = Math.max(140, N * ROW_H + PAD_TOP + PAD_BOTTOM)
  const boxH = contentH

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nDays < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = canvasW
    const H = contentH
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    const AR = isMobile ? 8 : 9
    const PAD = { t: PAD_TOP, r: isMobile ? 28 : 36, b: PAD_BOTTOM, l: isMobile ? 22 : 28 }
    const cw = W - PAD.l - PAD.r
    const ch = H - PAD.t - PAD.b

    function xOf(i: number) { return PAD.l + (i / (nDays - 1)) * cw }
    function yOf(pos: number) { return N > 1 ? PAD.t + ((pos - 1) / (N - 1)) * ch : PAD.t + ch / 2 }

    ctx.clearRect(0, 0, W, H)

    /* grid + número da posição real no ranking geral à esquerda
       (linhas continuam plotadas pela posição relativa ao subconjunto, mas o
       rótulo mostra o número real — ex: "Últimos 25" mostra 34-58, não 1-25) */
    const labelOffset = visao === 'ultimos25' ? ordenado.length - N
      : visao === 'meio' ? meioInicio - 1
      : 0
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.font = `${isMobile ? 8 : 9}px Inter`
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let p = 1; p <= N; p++) {
      const y = yOf(p)
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cw, y); ctx.stroke()
      ctx.fillText(String(p + labelOffset), PAD.l - 6, y)
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

    const activeId = pinnedId ?? hoveredId

    /* desenha linhas — destaca quem está "fixado/hover" e sempre realça "você" */
    const order = [...seriesWithColor.keys()].sort((a, b) => {
      const aTop = (seriesWithColor[a].palpite_id === activeId || seriesWithColor[a].isMe) ? 1 : 0
      const bTop = (seriesWithColor[b].palpite_id === activeId || seriesWithColor[b].isMe) ? 1 : 0
      return aTop - bTop
    })

    order.forEach(idx => {
      const s = seriesWithColor[idx]
      const isActive = activeId === s.palpite_id || (activeId === null && s.isMe)
      const dim = activeId !== null && !isActive && !s.isMe

      ctx.beginPath()
      posicaoPorDia[idx].forEach((pos, i) => {
        const x = xOf(i), y = yOf(pos)
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = dim ? s.cor + '20' : s.cor
      ctx.lineWidth   = isActive ? 3.5 : (s.isMe ? 2.2 : 1.4)
      ctx.stroke()
    })

    /* avatares no último dia */
    order.forEach(idx => {
      const s = seriesWithColor[idx]
      const isActive = activeId === s.palpite_id || (activeId === null && s.isMe)
      const dim = activeId !== null && !isActive && !s.isMe
      const x = xOf(nDays - 1)
      const y = yOf(posicaoPorDia[idx][nDays - 1])
      const r = isActive ? AR + 2 : AR
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
      ctx.lineWidth = isActive || s.isMe ? 2 : 1
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

  }, [canvasW, series, datas, hoveredId, pinnedId, imgMap, N, nDays, posicaoPorDia, seriesWithColor, isMobile, contentH, visao, ordenado.length, meioInicio])

  function hitTest(mx: number, my: number) {
    const PAD = { t: PAD_TOP, r: isMobile ? 28 : 36, b: PAD_BOTTOM, l: isMobile ? 22 : 28 }
    const cw = canvasW - PAD.l - PAD.r
    const ch = contentH - PAD.t - PAD.b
    const AR = isMobile ? 8 : 9

    function xOf(i: number) { return PAD.l + (i / (nDays - 1)) * cw }
    function yOf(pos: number) { return N > 1 ? PAD.t + ((pos - 1) / (N - 1)) * ch : PAD.t + ch / 2 }

    const idx = Math.round(((mx - PAD.l) / cw) * (nDays - 1))
    const dayIdx = Math.max(0, Math.min(nDays - 1, idx))

    let bestId: number | null = null
    let bestDist = 14

    seriesWithColor.forEach((s, sIdx) => {
      const y = yOf(posicaoPorDia[sIdx][dayIdx])
      const d = Math.abs(my - y)
      if (d < bestDist) { bestDist = d; bestId = s.palpite_id }
    })

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

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || nDays < 2) return
    const rect = canvas.getBoundingClientRect()
    const id = hitTest(e.clientX - rect.left, e.clientY - rect.top)
    setPinnedId(prev => (id !== null && prev === id) ? null : id)
  }

  function handleTouch(e: React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || nDays < 2) return
    const rect = canvas.getBoundingClientRect()
    const t = e.touches[0]
    if (!t) return
    const id = hitTest(t.clientX - rect.left, t.clientY - rect.top)
    setPinnedId(prev => (id !== null && prev === id) ? null : id)
  }

  if (nDays < 2) return null

  const activeId = pinnedId ?? hoveredId
  const selecionado = seriesWithColor.find(s => s.palpite_id === activeId) ?? null
  const ultimoValor = selecionado ? valoresPorDia[seriesWithColor.indexOf(selecionado)][nDays - 1] : null

  const VISOES: { key: Visao; label: string }[] = [
    { key: 'top15',     label: 'Top 15' },
    { key: 'top25',     label: 'Top 25' },
    { key: 'meio',      label: 'Meio' },
    { key: 'ultimos25', label: 'Últimos 25' },
  ]

  return (
    <div
      style={{
        background: '#0D1E3D',
        border: '1px solid rgba(74,144,217,0.15)',
        borderRadius: 10,
        padding: '14px 16px 14px',
        marginBottom: 16,
      }}
    >
      {/* cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minHeight: 16, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Evolução diária da pontuação
        </div>
        {selecionado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: selecionado.cor, flexShrink: 0 }} />
            {selecionado.nome}
            <span style={{ color: selecionado.cor, fontWeight: 800 }}>{ultimoValor} pts</span>
          </div>
        )}
      </div>

      {/* toggle de visão */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {VISOES.map(v => (
          <button
            key={v.key}
            onClick={() => { setVisao(v.key); setPinnedId(null) }}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              border: `1px solid ${visao === v.key ? '#4A90D9' : 'rgba(255,255,255,0.15)'}`,
              background: visao === v.key ? '#4A90D9' : 'rgba(255,255,255,0.05)',
              color: visao === v.key ? 'white' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer', fontFamily: 'Inter,sans-serif',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* caixa do gráfico */}
      <div
        ref={boxRef}
        style={{
          position: 'relative', width: '100%', height: boxH,
          overflowY: 'hidden',
          transition: 'height 0.25s ease',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ cursor: 'pointer', display: 'block', width: '100%', touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredId(null)}
          onClick={handleClick}
          onTouchStart={handleTouch}
        />
      </div>
    </div>
  )
}
