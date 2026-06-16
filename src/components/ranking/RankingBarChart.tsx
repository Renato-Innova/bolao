'use client'

import { useEffect, useRef } from 'react'
import type { RankingEntry } from '@/types'

interface Props {
  ranking: RankingEntry[]
  myIds:   number[]
}

const PALETA: Record<number, [string, string]> = {
  1:  ['#FFD700', '#7B5800'],
  2:  ['#FF6B6B', '#7A1515'],
  3:  ['#FF8C42', '#6B2D0A'],
  4:  ['#F59E0B', '#6B3B00'],
  5:  ['#84CC16', '#2D5A00'],
  6:  ['#10B981', '#044A30'],
  7:  ['#06B6D4', '#034A5A'],
  8:  ['#3B82F6', '#0F2F7A'],
  9:  ['#8B5CF6', '#3B1580'],
  10: ['#EC4899', '#6B0F3A'],
  11: ['#4A90D9', '#1a3a6a'],
}

const NAME_COLORS = [
  '#1a5ca8', '#2d7a3a', '#7c3aed', '#b45309',
  '#be185d', '#0e7490', '#7f1d1d', '#065f46',
]
function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]
}

function getColors(posicao: number, isMe: boolean): [string, string] {
  if (isMe && posicao > 10) return PALETA[11]
  return PALETA[Math.min(posicao, 11)] ?? PALETA[11]
}

function centerOrder(entries: RankingEntry[]): RankingEntry[] {
  const first = entries.find(e => e.posicao === 1)
  const left  = entries.filter(e => e.posicao % 2 !== 0 && e.posicao !== 1).reverse()
  const right = entries.filter(e => e.posicao % 2 === 0)
  return first ? [...left, first, ...right] : [...left, ...right]
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function inits(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

/* Desenha avatar no canvas — imagem, emoji ou iniciais */
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  entry: RankingEntry,
  cTop: string,
  isFirst: boolean, isMe: boolean,
  img: HTMLImageElement | null,
) {
  const WHITE = '#ffffff'

  // fundo + borda do círculo
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = img || entry.avatar_type === 'emoji'
    ? 'rgba(13,30,61,0.85)'
    : (entry.avatar_type ? 'rgba(74,144,217,0.10)' : nameToColor(entry.nome) + 'cc')
  ctx.fill()
  ctx.strokeStyle = cTop + '66'
  ctx.lineWidth = isFirst || isMe ? 2 : 1
  ctx.stroke()
  ctx.restore()

  if (img) {
    // imagem recortada em círculo
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, cx - r + 1, cy - r + 1, (r - 1) * 2, (r - 1) * 2)
    ctx.restore()
  } else if (entry.avatar_type === 'emoji' && entry.avatar_value) {
    ctx.save()
    ctx.font = `${Math.round(r * 1.1)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(entry.avatar_value, cx, cy + 1)
    ctx.restore()
  } else {
    // iniciais
    ctx.save()
    ctx.fillStyle = WHITE
    ctx.font = `700 ${Math.round(r * 0.75)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(inits(entry.nome), cx, cy)
    ctx.restore()
  }
}

function draw(
  canvas: HTMLCanvasElement,
  ordered: RankingEntry[],
  myIds: number[],
  maxPts: number,
  isMobile: boolean,
  imgMap: Map<number, HTMLImageElement>,
) {
  const dpr  = window.devicePixelRatio || 1
  const cssW = canvas.parentElement!.clientWidth
  const cssH = isMobile ? 250 : 290
  canvas.style.width  = cssW + 'px'
  canvas.style.height = cssH + 'px'
  canvas.width  = cssW * dpr
  canvas.height = cssH * dpr

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const NAVY  = '#0D1E3D'
  const WHITE = '#ffffff'
  const MUTED = 'rgba(255,255,255,0.35)'
  const AR    = isMobile ? 11 : 14
  const FS    = isMobile ? 9  : 10

  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, cssW, cssH)

  const PL = 8, PR = 8
  const PT = AR * 2 + 20
  const PB = 14
  const CW = cssW - PL - PR
  const CH = cssH - PT - PB
  const N   = ordered.length
  const gap = CW / N
  const bw  = gap * 0.64

  // linhas guia horizontais sutis (sem labels no eixo Y)
  const step = Math.ceil(maxPts / 5 / 10) * 10
  for (let v = step; v <= maxPts; v += step) {
    const yy = PT + CH - (v / maxPts) * CH
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.moveTo(PL, yy); ctx.lineTo(cssW - PR, yy)
    ctx.stroke()
  }

  // base
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 1
  ctx.moveTo(PL, PT + CH); ctx.lineTo(cssW - PR, PT + CH)
  ctx.stroke()

  ordered.forEach((e, i) => {
    const isFirst = e.posicao === 1
    const isMe    = myIds.includes(e.palpite_id)
    const [cTop, cBot] = getColors(e.posicao, isMe)
    const bh = (e.total_pontos / maxPts) * CH
    const bx = PL + i * gap + gap / 2 - bw / 2
    const by = PT + CH - bh
    const cx = bx + bw / 2
    const baseY   = PT + CH
    const avatarY = by - AR - 5

    // sombra + barra
    ctx.save()
    ctx.shadowColor   = cTop + '44'
    ctx.shadowBlur    = 6
    ctx.shadowOffsetY = 2
    const grad = ctx.createLinearGradient(0, by, 0, by + bh)
    grad.addColorStop(0, cTop)
    grad.addColorStop(1, cBot + '55')
    rrect(ctx, bx, by, bw, bh, 3)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()

    // borda
    rrect(ctx, bx, by, bw, bh, 3)
    ctx.strokeStyle = cTop + '88'
    ctx.lineWidth   = isFirst || isMe ? 1.5 : 0.8
    ctx.stroke()

    // pontuação no topo interno
    ctx.fillStyle = WHITE
    ctx.font = `700 ${isMobile ? FS + 2 : FS + 6}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(String(e.total_pontos), cx, by + 5)

    // nome rotacionado 90° na base
    ctx.save()
    ctx.translate(cx, baseY - 5)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `${isFirst || isMe ? '700' : '600'} ${FS}px sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const label = e.nome.length > 20 ? e.nome.slice(0, 19) + '…' : e.nome
    ctx.fillText(label, 0, 0)
    ctx.restore()

    // avatar
    drawAvatar(ctx, cx, avatarY, AR, e, cTop, isFirst, isMe, imgMap.get(e.palpite_id) ?? null)

    // coroa #1
    if (isFirst) {
      ctx.font = `${Math.round(AR * 1.0)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText('👑', cx, avatarY - AR)
    }

    // posição acima do avatar
    ctx.fillStyle = cTop
    ctx.font = `700 ${FS + 1}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('#' + e.posicao, cx, avatarY - AR - 2)
  })
}

/* Carrega imagens para os tipos upload e camisa */
async function loadImages(entries: RankingEntry[]): Promise<Map<number, HTMLImageElement>> {
  const map = new Map<number, HTMLImageElement>()
  await Promise.all(
    entries.map(e => {
      if (!e.avatar_type || !e.avatar_value) return null
      if (e.avatar_type !== 'upload' && e.avatar_type !== 'camisa') return null

      const src = e.avatar_type === 'camisa'
        ? `/avatar/Camiseta_${e.avatar_value}.png`
        : e.avatar_value

      return new Promise<void>(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload  = () => { map.set(e.palpite_id, img); resolve() }
        img.onerror = () => resolve()
        img.src = src
      })
    }).filter(Boolean)
  )
  return map
}

export function RankingBarChart({ ranking, myIds }: Props) {
  const desktopRef = useRef<HTMLCanvasElement>(null)
  const mobileRef  = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ranking.length) return

    const top10   = ranking.slice(0, 10)
    const myExtra = ranking.filter(e => myIds.includes(e.palpite_id) && e.posicao > 10)
    const entries = [...new Map([...top10, ...myExtra].map(e => [e.palpite_id, e])).values()]
    const ordered = [...entries].sort((a, b) => a.total_pontos - b.total_pontos)
    const maxPts  = Math.max(...entries.map(e => e.total_pontos), 10) + 12

    loadImages(entries).then(imgMap => {
      if (desktopRef.current) draw(desktopRef.current, ordered, myIds, maxPts, false, imgMap)
      if (mobileRef.current)  draw(mobileRef.current,  ordered, myIds, maxPts, true,  imgMap)
    })
  }, [ranking, myIds])

  return (
    <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
        Ranking - TOP 10
      </div>

      {/* desktop/tablet */}
      <div className="car-desktop" style={{ width: '100%' }}>
        <canvas ref={desktopRef} style={{ display: 'block', borderRadius: 8 }} />
      </div>

      {/* mobile */}
      <div className="car-mobile" style={{ width: '100%' }}>
        <canvas ref={mobileRef} style={{ display: 'block', borderRadius: 8 }} />
      </div>
    </div>
  )
}
