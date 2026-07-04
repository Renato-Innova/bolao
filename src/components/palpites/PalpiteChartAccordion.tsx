'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

export interface DayValue { data: string; value: number }

interface Props {
  ownNome: string
  ownPontos: DayValue[]
  ownExatos: DayValue[]
  topNome?: string | null
  topPontos?: DayValue[]
  topExatos?: DayValue[]
  isTop1?: boolean
}

/* '2026-06-12' → '12/jun' */
function fmtDia(iso: string): string {
  const [, m, d] = iso.split('-')
  const meses = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${parseInt(d)}/${meses[parseInt(m)]}`
}

function toMap(s: DayValue[]) {
  return new Map(s.map(d => [d.data, d.value]))
}

function toggleStyle(active: boolean, activeColor: string): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
    background: active ? `${activeColor}26` : 'rgba(255,255,255,0.05)',
    border: `1px solid ${active ? `${activeColor}80` : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 20, padding: '3px 8px', fontSize: 9, fontWeight: 700,
    color: active ? activeColor : 'rgba(255,255,255,0.55)', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
  }
}

/* viewBox virtual — o SVG estica horizontalmente para 100% da largura do card
   (preserveAspectRatio="none"); a altura é sempre fixa em px (CHART_H), então só
   o eixo X sofre distorção não-uniforme — por isso nenhum <text> vai dentro do
   SVG, tudo em overlay HTML (rótulos de data embaixo, eixo de pontos ao lado) */
const VB_W = 300
const VB_H = 80
const PAD_X = 4
const PAD_Y = 6
const CHART_H = 70
// espaçamento vertical entre dots empilhados quando há mais de 1 acerto exato no mesmo dia
const DOT_STACK_GAP = 7

const COR_PONTOS = '#4A90D9'
const COR_TOP = '#facc15'
const COR_EXATOS = '#4ade80'

export function PalpiteChartAccordion({ ownNome, ownPontos, ownExatos, topNome, topPontos = [], topExatos = [], isTop1 }: Props) {
  const [open, setOpen] = useState(false)
  const [showExatos, setShowExatos] = useState(false)
  const [compareTop, setCompareTop] = useState(false)

  const showCompareBtn = !!topNome && !isTop1
  const comparando = compareTop && showCompareBtn

  const ownPontosMap = toMap(ownPontos)
  const topPontosMap = toMap(topPontos)
  const ownExatosMap = toMap(ownExatos)
  const topExatosMap = toMap(topExatos)

  const datasSet = new Set<string>(ownPontos.map(d => d.data))
  if (comparando) topPontos.forEach(d => datasSet.add(d.data))
  if (showExatos) {
    ownExatos.forEach(d => datasSet.add(d.data))
    if (comparando) topExatos.forEach(d => datasSet.add(d.data))
  }
  const datas = Array.from(datasSet).sort()
  const n = datas.length

  const ownPontosVals = datas.map(d => ownPontosMap.get(d) ?? 0)
  const topPontosVals = datas.map(d => topPontosMap.get(d) ?? 0)
  const ownExatosVals = datas.map(d => ownExatosMap.get(d) ?? 0)
  const topExatosVals = datas.map(d => topExatosMap.get(d) ?? 0)

  // Eixo de pontos (visível, à direita) — sempre a escala principal do gráfico
  const maxPontos = Math.max(1, ...ownPontosVals, ...(comparando ? topPontosVals : []))
  // Eixo de acertos exatos (oculto) — escala própria só para posicionar os
  // pontinhos com boa amplitude visual, sem precisar mostrar esse eixo ao usuário
  const maxExatos = Math.max(1, ...ownExatosVals, ...(comparando ? topExatosVals : []))

  function xOf(i: number) { return n > 1 ? PAD_X + (i / (n - 1)) * (VB_W - PAD_X * 2) : VB_W / 2 }
  function yOfPontos(v: number) { return VB_H - PAD_Y - (v / maxPontos) * (VB_H - PAD_Y * 2) }
  function yOfExatos(v: number) { return VB_H - PAD_Y - (v / maxExatos) * (VB_H - PAD_Y * 2) }

  const ownLine = ownPontosVals.map((v, i) => `${xOf(i)},${yOfPontos(v)}`).join(' ')
  const topLine = topPontosVals.map((v, i) => `${xOf(i)},${yOfPontos(v)}`).join(' ')

  const labelIdx = n > 1 ? [0, Math.round((n - 1) / 2), n - 1] : [0]

  // Ticks do eixo de pontos, à direita — 3 marcas leves (0, meio, máximo)
  const pontosTicks = [maxPontos, maxPontos / 2, 0]

  return (
    // Sem stopPropagation aqui de propósito — clicar em qualquer parte do
    // card (incluindo o gráfico) deve ativá-lo, igual ao resto do card.
    <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>📊</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Gráfico
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          {/* controles — tudo numa única linha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <button onClick={() => setShowExatos(v => !v)} style={toggleStyle(showExatos, COR_EXATOS)} title="Marcar os dias de placar exato">
              🎯 Exatos
            </button>
            {showCompareBtn && (
              <button onClick={() => setCompareTop(v => !v)} style={toggleStyle(compareTop, COR_TOP)} title={`Comparar com TOP 1 (${topNome})`}>
                🏆 TOP 1
              </button>
            )}
            {isTop1 && (
              <span style={{ fontSize: 9, color: COR_TOP, fontWeight: 700, whiteSpace: 'nowrap' }}>🏆 Você é o TOP 1!</span>
            )}
          </div>

          {/* chart */}
          {n === 0 ? (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '16px 0' }}>
              Ainda não há dados suficientes
            </p>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                {/* área do gráfico */}
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" style={{ width: '100%', height: CHART_H, display: 'block' }}>
                    {/* grid leve — alinhado aos ticks do eixo de pontos */}
                    {pontosTicks.map(t => (
                      <line key={t} x1={PAD_X} y1={yOfPontos(t)} x2={VB_W - PAD_X} y2={yOfPontos(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                    ))}

                    {/* linha de pontos — sempre visível, não é afetada pelo toggle de Exatos */}
                    {comparando && (
                      <polyline points={topLine} fill="none" stroke={COR_TOP} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    )}
                    <polyline points={ownLine} fill="none" stroke={COR_PONTOS} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />

                    {ownPontosVals.map((v, i) => (
                      <circle key={datas[i]} cx={xOf(i)} cy={yOfPontos(v)} r={2} fill={COR_PONTOS}>
                        <title>{`${fmtDia(datas[i])}: ${v} pts`}</title>
                      </circle>
                    ))}
                    {comparando && topPontosVals.map((v, i) => (
                      <circle key={`t-${datas[i]}`} cx={xOf(i)} cy={yOfPontos(v)} r={2} fill={COR_TOP}>
                        <title>{`${fmtDia(datas[i])} · ${topNome}: ${v} pts`}</title>
                      </circle>
                    ))}

                    {/* Exatos — overlay em escala própria (oculta), só marca o dia em que o
                        acerto aconteceu (quando o acumulado sobe). Se naquele dia houve mais
                        de 1 acerto, empilha um dot por acerto (um embaixo do outro). */}
                    {showExatos && ownExatosVals.map((v, i) => {
                      const ganho = v - (ownExatosVals[i - 1] ?? 0)
                      if (ganho <= 0) return null
                      const baseY = yOfExatos(v)
                      return Array.from({ length: ganho }, (_, k) => (
                        <circle key={`e-${datas[i]}-${k}`} cx={xOf(i)} cy={baseY + k * DOT_STACK_GAP} r={3} fill={COR_EXATOS} stroke="#0D1E3D" strokeWidth={1}>
                          <title>{`${fmtDia(datas[i])}: placar exato`}</title>
                        </circle>
                      ))
                    })}
                    {showExatos && comparando && topExatosVals.map((v, i) => {
                      const ganho = v - (topExatosVals[i - 1] ?? 0)
                      if (ganho <= 0) return null
                      const baseY = yOfExatos(v)
                      return Array.from({ length: ganho }, (_, k) => (
                        <circle key={`te-${datas[i]}-${k}`} cx={xOf(i)} cy={baseY + k * DOT_STACK_GAP} r={3} fill="none" stroke={COR_TOP} strokeWidth={1.5}>
                          <title>{`${fmtDia(datas[i])} · ${topNome}: placar exato`}</title>
                        </circle>
                      ))
                    })}
                  </svg>

                  {/* rótulos de data */}
                  <div style={{ position: 'relative', height: 10 }}>
                    {labelIdx.map(i => (
                      <span key={i} style={{
                        position: 'absolute', fontSize: 7, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap',
                        left: `${(xOf(i) / VB_W) * 100}%`,
                        transform: i === 0 ? 'translateX(0)' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                      }}>
                        {fmtDia(datas[i])}
                      </span>
                    ))}
                  </div>
                </div>

                {/* eixo de pontos — visível, à direita */}
                <div style={{ position: 'relative', width: 24, flexShrink: 0, height: CHART_H }}>
                  {pontosTicks.map(t => (
                    <span key={t} style={{
                      position: 'absolute', top: `${(yOfPontos(t) / VB_H) * 100}%`, transform: 'translateY(-50%)',
                      fontSize: 7, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap',
                    }}>
                      {Math.round(t)}
                    </span>
                  ))}
                </div>
              </div>

              {/* legend — embaixo do gráfico; pontos sempre aparece, exatos/TOP 1 só quando o toggle está ativo */}
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.5)', flexWrap: 'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 2, background: COR_PONTOS, marginRight: 4, verticalAlign: 'middle' }} />{ownNome}</span>
                {comparando && (
                  <span><span style={{ display: 'inline-block', width: 8, height: 2, background: COR_TOP, marginRight: 4, verticalAlign: 'middle' }} />{topNome}</span>
                )}
                {showExatos && (
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COR_EXATOS, marginRight: 4, verticalAlign: 'middle' }} />Acertos exatos</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
