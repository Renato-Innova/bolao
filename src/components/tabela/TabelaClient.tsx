'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { GRUPOS } from '@/utils/constants'
import type { ClassificacaoGrupo, JogoCopa } from '@/types'

/* ─── shared helpers ─────────────────────────────────────── */

const MESES   = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const WEEKDAYS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']

function Flag({ codigo, size = 18 }: { codigo: string; size?: number }) {
  return (
    <Image src={`https://flagcdn.com/w40/${codigo}.png`} alt={codigo}
      width={size} height={Math.round(size * 0.67)}
      style={{ borderRadius: 2, flexShrink: 0 }} unoptimized draggable={false} />
  )
}

function fmtDate(date: string) {
  const d = new Date(date + 'T12:00:00')
  return `${d.getDate()} ${MESES[d.getMonth()]} · ${WEEKDAYS[d.getDay()]}`
}

function fmtTime(horario: string) {
  return horario.slice(0, 5).replace(':', 'h')
}

function isPlaceholder(name: string) {
  return /^\d+º Grupo [A-L]$/.test(name) || /^Melhor 3º/.test(name) ||
    name.startsWith('Vencedor') || name.startsWith('Perdedor')
}

const FASE_LABEL: Record<string, string> = {
  GS: 'Fase de Grupos', R32: 'Seg. de Final', R16: 'Oitavas de Final',
  QF: 'Quartas de Final', SF: 'Semifinal', TPL: '3º Lugar', F: 'Final',
}

/* ─── JOGOS tab ───────────────────────────────────────────── */

interface DayGroup {
  date: string
  label: string
  games: JogoCopa[]
}

function groupByDay(games: JogoCopa[]): DayGroup[] {
  const map: Record<string, JogoCopa[]> = {}
  for (const g of games) {
    if (!map[g.data]) map[g.data] = []
    map[g.data].push(g)
  }
  return Object.keys(map).sort().map(date => ({
    date,
    label: fmtDate(date),
    games: map[date].sort((a, b) => a.horario.localeCompare(b.horario)),
  }))
}

function GameRow({ jogo }: { jogo: JogoCopa }) {
  const hasResult  = !!jogo.resultado
  const scoreA     = hasResult ? jogo.resultado!.placar_real_a : null
  const scoreB     = hasResult ? jogo.resultado!.placar_real_b : null
  const winA       = hasResult && scoreA! > scoreB!
  const winB       = hasResult && scoreB! > scoreA!
  const hasTeamA   = !!(jogo.time_a && !isPlaceholder(jogo.time_a))
  const hasTeamB   = !!(jogo.time_b && !isPlaceholder(jogo.time_b))

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', gap: 12,
      padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      opacity: hasResult ? 1 : 0.85,
    }}>
      {/* Team A */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}>
        <span style={{
          fontSize: 12, fontWeight: winA ? 700 : 500,
          color: winA ? 'white' : hasTeamA ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
          fontStyle: hasTeamA ? 'normal' : 'italic',
          textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{hasTeamA ? jogo.time_a : 'A definir'}</span>
        {hasTeamA && jogo.codigo_pais_a
          ? <Flag codigo={jogo.codigo_pais_a} />
          : <div style={{ width: 18, height: 12, borderRadius: 2, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        }
      </div>

      {/* Score / time */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, minWidth: 72 }}>
        {hasResult ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: winA ? 'white' : 'rgba(255,255,255,0.6)', minWidth: 16, textAlign: 'center' }}>{scoreA}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontWeight: 300 }}>–</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: winB ? 'white' : 'rgba(255,255,255,0.6)', minWidth: 16, textAlign: 'center' }}>{scoreB}</span>
          </div>
        ) : (
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4A90D9', letterSpacing: 0.5 }}>
            {fmtTime(jogo.horario)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
            {FASE_LABEL[jogo.fase] ?? jogo.fase}
            {jogo.grupo ? ` · Gr. ${jogo.grupo}` : ''}
          </span>
        </div>
        {jogo.cidade && (
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)', whiteSpace: 'nowrap' }}>{jogo.cidade}</span>
        )}
      </div>

      {/* Team B */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {hasTeamB && jogo.codigo_pais_b
          ? <Flag codigo={jogo.codigo_pais_b} />
          : <div style={{ width: 18, height: 12, borderRadius: 2, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        }
        <span style={{
          fontSize: 12, fontWeight: winB ? 700 : 500,
          color: winB ? 'white' : hasTeamB ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
          fontStyle: hasTeamB ? 'normal' : 'italic',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{hasTeamB ? jogo.time_b : 'A definir'}</span>
      </div>
    </div>
  )
}

function JogosTab({ todosJogos }: { todosJogos: JogoCopa[] }) {
  // Determine the default open day: first day that has any game without result
  const days = groupByDay(todosJogos)
  const defaultOpenDate = days.find(d => d.games.some(g => !g.resultado))?.date ?? null

  const [accOpen, setAccOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    if (defaultOpenDate) init[defaultOpenDate] = true
    return init
  })

  function toggleAcc(date: string) {
    setAccOpen(prev => ({ ...prev, [date]: !prev[date] }))
  }

  function expandAll() {
    const all: Record<string, boolean> = {}
    days.forEach(d => { all[d.date] = true })
    setAccOpen(all)
  }

  function collapseAll() { setAccOpen({}) }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
        <button onClick={expandAll}
          style={{ background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', color: '#7BB8F0', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
          Expandir todos
        </button>
        <button onClick={collapseAll}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
          Recolher todos
        </button>
      </div>

      {/* Day accordions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {days.map(day => {
          const isOpen   = !!accOpen[day.date]
          const played   = day.games.filter(g => g.resultado).length
          const total    = day.games.length
          const allDone  = played === total
          const hasNext  = day.date === defaultOpenDate

          // Color hint: all done → green; has next game → blue; future → muted
          const accentColor = allDone
            ? 'rgba(74,222,128,0.8)'
            : hasNext
              ? '#4A90D9'
              : 'rgba(255,255,255,0.3)'

          return (
            <div key={day.date} style={{ background: '#0D1E3D', border: `1px solid ${hasNext && !allDone ? 'rgba(74,144,217,0.35)' : 'rgba(74,144,217,0.12)'}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Accordion header */}
              <div onClick={() => toggleAcc(day.date)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', userSelect: 'none', background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, flexShrink: 0 }}>
                  {allDone ? '✓' : hasNext ? '▶' : '○'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>{day.label}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: 10, color: allDone ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                  {played}/{total} jogos
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', transition: 'transform 0.22s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>▼</span>
              </div>

              {/* Games */}
              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {day.games.map(jogo => <GameRow key={jogo.id} jogo={jogo} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── CLASSIFICAÇÃO tab ───────────────────────────────────── */

// Compute the set of pais_nome values for the best 8 third-place teams across
// all groups, using FIFA criteria: pts → goal diff → goals scored.
function computeBest8ThirdPlace(classificacao: ClassificacaoGrupo[]): Set<string> {
  const grupoMap: Record<string, ClassificacaoGrupo[]> = {}
  for (const row of classificacao) {
    if (!grupoMap[row.grupo]) grupoMap[row.grupo] = []
    grupoMap[row.grupo].push(row)
  }
  const thirds: ClassificacaoGrupo[] = []
  for (const rows of Object.values(grupoMap)) {
    if (rows.length >= 3) thirds.push(rows[2]) // already sorted by server (pts desc)
  }
  // Re-sort by FIFA criteria across groups
  const best8 = [...thirds]
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.m - a.m)
    .slice(0, 8)
  return new Set(best8.map(t => t.pais_nome))
}

function ClassificacaoTab({ classificacao }: { classificacao: ClassificacaoGrupo[] }) {
  // Build group map preserving sorted order from server
  const grupoMap: Record<string, ClassificacaoGrupo[]> = {}
  for (const row of classificacao) {
    if (!grupoMap[row.grupo]) grupoMap[row.grupo] = []
    grupoMap[row.grupo].push(row)
  }
  const grupos = GRUPOS.map(g => ({ grupo: g, times: grupoMap[g] ?? [] })).filter(g => g.times.length > 0)

  // Identify which 3rd-place teams qualify via best-8 rule
  const best8Names = computeBest8ThirdPlace(classificacao)

  if (grupos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
        Os jogos serão carregados em breve.
      </div>
    )
  }

  return (
    <div>
      <div className="grupos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {grupos.map(({ grupo, times }) => (
          <div key={grupo} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Group header */}
            <div style={{ background: 'linear-gradient(90deg, #0a1f4e, #091a42)', padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(74,144,217,0.2)' }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: 'white', letterSpacing: 1 }}>Grupo {grupo}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fase de Grupos</span>
            </div>
            {/* Table */}
            <div className="mobile-scroll">
              <div className="mobile-scroll-inner">
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '5px 10px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>#</span><span style={{ textAlign: 'left' }}>Seleção</span><span>J</span><span>V</span><span>SG</span><span>GP</span><span>Pts</span>
                </div>
                {times.map((t, idx) => {
                  const q      = idx < 2 || (idx === 2 && best8Names.has(t.pais_nome))
                  const sgPos  = t.dg > 0
                  const sgNeg  = t.dg < 0
                  return (
                    <div key={t.pais_nome} style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '6px 10px', alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.85)', textAlign: 'center', borderBottom: idx < times.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: q ? 'rgba(74,144,217,0.07)' : 'transparent' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: q ? '#4A90D9' : 'rgba(255,255,255,0.25)' }}>{idx + 1}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left' }}>
                        <Flag codigo={t.pais_codigo} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'white' }}>{t.pais_nome}</span>
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t.j}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t.c}</span>
                      <span style={{ fontSize: 10, color: sgPos ? 'rgba(255,255,255,0.6)' : sgNeg ? 'rgba(255,100,100,0.75)' : 'rgba(255,255,255,0.5)' }}>
                        {sgPos ? `+${t.dg}` : t.dg}
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t.m}</span>
                      <span style={{ fontWeight: 700, color: '#4A90D9', fontSize: 11 }}>{t.pts}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="legend-row" style={{ marginTop: 14, padding: '10px 16px', background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(74,144,217,0.5)' }} />
            Classifica para o mata-mata (1º, 2º e melhores 3ºs colocados)
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Critérios FIFA: Pts → SG → GP → Confronto direto</span>
      </div>
    </div>
  )
}

/* ─── CHAVE tab ───────────────────────────────────────────── */

const CHAVE_COLS = [
  { code: 'R32', label: 'Seg. de Final', dates: '29 Jun – 03 Jul' },
  { code: 'R16', label: 'Oitavas',       dates: '04 Jul – 07 Jul' },
  { code: 'QF',  label: 'Quartas',       dates: '09 Jul – 11 Jul' },
  { code: 'SF',  label: 'Semifinal',     dates: '14 Jul – 15 Jul' },
  { code: 'FIN', label: 'Final',         dates: '18 Jul – 19 Jul' },
] as const

function ChaveTab({ jogosKO }: { jogosKO: JogoCopa[] }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Mobile pill navigation: up to 2 columns visible at once
  const [pillPair, setPillPair] = useState<[number, number | null]>([0, 1])

  // Apply mobile transform when pillPair changes
  useEffect(() => {
    const outer = outerRef.current
    const track = trackRef.current
    if (!outer || !track) return
    if (window.innerWidth >= 1024) { track.style.transform = 'none'; return }
    const colW = (outer.offsetWidth - 8) / 2
    const step = colW + 8
    track.style.transform = `translateX(-${pillPair[0] * step}px)`
  })

  function selectPill(idx: number) {
    setPillPair(([l, r]) => {
      if (l === idx || r === idx) return [l, r]
      if (r === null) return idx > l ? [l, idx] : [idx, l]
      return [Math.min(r, idx), Math.max(r, idx)]
    })
  }

  const colsByCode = Object.fromEntries(
    CHAVE_COLS.map(c => {
      const codes = c.code === 'FIN' ? ['TPL', 'F'] : [c.code]
      return [c.code, jogosKO
        .filter(j => codes.includes(j.fase))
        .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))]
    })
  )

  function MatchCard({ jogo, isFinal }: { jogo: JogoCopa; isFinal?: boolean }) {
    const [, mm, dd] = jogo.data.split('-')
    const meta    = `J${jogo.numero_jogo} · ${parseInt(dd)} ${MESES[parseInt(mm) - 1]} ${fmtTime(jogo.horario)}`
    const isTPL   = jogo.fase === 'TPL'
    const hasRes  = !!jogo.resultado
    const scoreA  = hasRes ? jogo.resultado!.placar_real_a : null
    const scoreB  = hasRes ? jogo.resultado!.placar_real_b : null
    const winA    = hasRes && scoreA! > scoreB!
    const winB    = hasRes && scoreB! > scoreA!
    const hasTeamA = !!(jogo.time_a && !isPlaceholder(jogo.time_a))
    const hasTeamB = !!(jogo.time_b && !isPlaceholder(jogo.time_b))

    function TeamRow({ side }: { side: 'A' | 'B' }) {
      const hasTeam = side === 'A' ? hasTeamA : hasTeamB
      const codigo  = side === 'A' ? jogo.codigo_pais_a : jogo.codigo_pais_b
      const name    = side === 'A'
        ? (hasTeamA ? jogo.time_a : 'A definir')
        : (hasTeamB ? jogo.time_b : 'A definir')
      const score   = hasRes ? (side === 'A' ? scoreA : scoreB) : null
      const isWin   = side === 'A' ? winA : winB

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 4, background: isWin ? 'rgba(74,144,217,0.1)' : 'transparent', borderLeft: isWin ? '2px solid #4A90D9' : '2px solid transparent', marginLeft: isWin ? -2 : 0 }}>
          {hasTeam && codigo
            ? <Image src={`https://flagcdn.com/w40/${codigo}.png`} alt={name} width={16} height={11} style={{ borderRadius: 2, flexShrink: 0 }} unoptimized />
            : <div style={{ width: 16, height: 11, borderRadius: 2, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>?</div>
          }
          <span style={{ flex: 1, fontSize: 10, fontWeight: hasTeam ? 600 : 400, color: hasTeam ? 'white' : 'rgba(255,255,255,0.3)', fontStyle: hasTeam ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, minWidth: 12, textAlign: 'right', color: isWin ? '#4A90D9' : hasRes ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
            {score ?? '–'}
          </span>
        </div>
      )
    }

    return (
      <div style={{
        background: hasRes ? 'rgba(74,144,217,0.05)' : 'rgba(255,255,255,0.03)',
        border: isFinal ? '1px solid rgba(74,144,217,0.5)' : hasRes ? '1px solid rgba(74,144,217,0.18)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8, padding: '8px 10px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>{meta}</span>
          {isTPL && <span style={{ fontSize: 8, fontWeight: 700, color: '#4A90D9', background: 'rgba(74,144,217,0.18)', padding: '1px 5px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>3º Lugar</span>}
        </div>
        <TeamRow side="A" />
        <div style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.15)', fontWeight: 700, letterSpacing: 1, padding: '1px 0' }}>vs</div>
        <TeamRow side="B" />
      </div>
    )
  }

  const hasAnyKO = CHAVE_COLS.some(c => (colsByCode[c.code] ?? []).length > 0)

  if (!hasAnyKO) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        A chave do mata-mata será exibida após o encerramento da fase de grupos.
      </div>
    )
  }

  return (
    <div>
      {/* Mobile pills */}
      <div className="chave-pills-bar" style={{ display: 'none', gap: 5, overflowX: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'], paddingBottom: 12, marginBottom: 8 }}>
        {CHAVE_COLS.map((c, i) => (
          <button key={c.code} onClick={() => selectPill(i)}
            style={{ padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0, background: (pillPair[0] === i || pillPair[1] === i) ? '#4A90D9' : 'rgba(255,255,255,0.06)', color: (pillPair[0] === i || pillPair[1] === i) ? 'white' : 'rgba(255,255,255,0.5)', borderColor: (pillPair[0] === i || pillPair[1] === i) ? '#4A90D9' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Bracket columns */}
      <div ref={outerRef} className="chave-outer" style={{ overflowX: 'auto' }}>
        <div ref={trackRef} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 'max-content', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
          {CHAVE_COLS.map((col, ci) => (
            <React.Fragment key={col.code}>
              <div className="chave-col" data-col={ci}
                style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
                {/* Column header */}
                <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 4 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 0.5, color: col.code === 'FIN' ? '#4A90D9' : 'white' }}>{col.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{col.dates}</div>
                </div>
                {col.code === 'FIN' && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#4A90D9', textTransform: 'uppercase', letterSpacing: 0.7, textAlign: 'center' }}>🏆 Grande Final</div>
                )}
                {(colsByCode[col.code] ?? []).map(jogo => (
                  <MatchCard key={jogo.id} jogo={jogo} isFinal={jogo.fase === 'F'} />
                ))}
                {col.code === 'FIN' && (colsByCode[col.code] ?? []).some(j => j.fase === 'F' && j.resultado) && (
                  <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.7 }}>— Campeão Mundial —</div>
                )}
              </div>
              {ci < CHAVE_COLS.length - 1 && (
                <div className="chave-arrow" style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 44, color: 'rgba(74,144,217,0.3)', fontSize: 14, userSelect: 'none' }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Main TabelaClient ───────────────────────────────────── */

type Tab = 'JOGOS' | 'CLASSIFICACAO' | 'CHAVE'

interface Props {
  todosJogos: JogoCopa[]
  jogosKO: JogoCopa[]
  classificacao: ClassificacaoGrupo[]
}

export function TabelaClient({ todosJogos, jogosKO, classificacao }: Props) {
  const [tab, setTab] = useState<Tab>('CLASSIFICACAO')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'JOGOS',        label: 'Jogos'         },
    { key: 'CLASSIFICACAO', label: 'Classificação' },
    { key: 'CHAVE',        label: 'Mata-Mata'      },
  ]

  return (
    <div className="page-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 3 }}>Tabela oficial</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          Classificação e jogos atualizados em tempo real · Critérios FIFA
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 22px', fontSize: 12, fontWeight: 700,
            color: tab === t.key ? 'white' : 'rgba(255,255,255,0.4)',
            background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === t.key ? '#4A90D9' : 'transparent'}`,
            marginBottom: -1, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
            textTransform: 'uppercase', letterSpacing: 0.6, transition: 'color 0.15s, border-color 0.15s',
            whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'JOGOS'         && <JogosTab todosJogos={todosJogos} />}
      {tab === 'CLASSIFICACAO' && <ClassificacaoTab classificacao={classificacao} />}
      {tab === 'CHAVE'         && <ChaveTab jogosKO={jogosKO} />}
    </div>
  )
}
