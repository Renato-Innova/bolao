'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { PIX_VALOR, PIX_CHAVE } from '@/utils/constants'
import type { Palpite, JogoCopa, PalpiteJogo } from '@/types'

/* ─── helpers ─────────────────────────────────────────────── */

const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const WEEKDAYS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']

function getMatchTime(date: string, horario: string): Date {
  return new Date(`${date}T${horario.slice(0, 5)}:00-03:00`)
}
function isLocked(date: string, horario: string) {
  return new Date() >= getMatchTime(date, horario)
}
function canEdit(date: string, horario: string) {
  return new Date() < new Date(getMatchTime(date, horario).getTime() - 60 * 60 * 1000)
}

interface DayGroup {
  dayNum: number
  date: string
  label: string        // "11 de junho · Quinta-feira"
  labelShort: string   // "11 jun"
  matches: JogoCopa[]
}

function groupByDay(matches: JogoCopa[]): DayGroup[] {
  const map: Record<string, JogoCopa[]> = {}
  for (const m of matches) {
    if (!map[m.data]) map[m.data] = []
    map[m.data].push(m)
  }
  return Object.keys(map).sort().map((date, i) => {
    const d = new Date(date + 'T12:00:00')
    return {
      dayNum: i + 1,
      date,
      label: `${d.getDate()} de ${MONTHS[d.getMonth()]} · ${WEEKDAYS[d.getDay()]}`,
      labelShort: `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`,
      matches: map[date],
    }
  })
}

function abbr(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 3).join('').toUpperCase().slice(0, 3)
}

function Flag({ codigo, size = 24 }: { codigo: string; size?: number }) {
  return (
    <Image src={`https://flagcdn.com/w40/${codigo}.png`} alt={codigo}
      width={size} height={Math.round(size * 0.67)}
      style={{ borderRadius: 2 }} unoptimized draggable={false} />
  )
}

/* ─── match state ──────────────────────────────────────────── */

interface MatchState {
  scoreA: number
  scoreB: number
  submitted: boolean
  submittedAt: string | null
  saving: boolean
  error: string | null
}

function initStates(pjs: PalpiteJogo[]): Record<string, MatchState> {
  const out: Record<string, MatchState> = {}
  for (const pj of pjs) {
    out[pj.jogo_id] = {
      scoreA: pj.placar_palpite_a ?? 0,
      scoreB: pj.placar_palpite_b ?? 0,
      submitted: !!pj.submitted_at,
      submittedAt: pj.submitted_at ?? null,
      saving: false,
      error: null,
    }
  }
  return out
}

/* ─── main component ───────────────────────────────────────── */

interface Props {
  userId: string
  userName: string
  palpitesIniciais: Palpite[]
  todosJogos: JogoCopa[]
}

export function PalpitesClient({ userId, userName, palpitesIniciais, todosJogos }: Props) {
  const supabase = createClient()
  const [palpites, setPalpites] = useState<Palpite[]>(palpitesIniciais)
  const [selectedId, setSelectedId] = useState<string | null>(palpitesIniciais[0]?.id ?? null)
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [criarError, setCriarError] = useState('')
  const [showNovo, setShowNovo] = useState(false)
  const [showPix, setShowPix] = useState(false)
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({})
  const [visibleDays, setVisibleDays] = useState(1)
  const [artilheiro, setArtilheiro] = useState('')
  const [artSaving, setArtSaving] = useState(false)
  // accordion open state keyed by date string, default closed
  const [accOpen, setAccOpen] = useState<Record<string, boolean>>({})

  const selected = palpites.find(p => p.id === selectedId)
  const days = groupByDay(todosJogos)

  useEffect(() => {
    const palpite = palpites.find(p => p.id === selectedId)
    if (palpite?.palpites_jogos) {
      const states = initStates(palpite.palpites_jogos)
      setMatchStates(states)
      setArtilheiro(palpite.artilheiro ?? '')

      // Expand days up to and including the first day that has a pending game,
      // so the user lands directly on the next game to fill in.
      const dayGroups = groupByDay(todosJogos)
      let targetDay = 1
      for (let i = 0; i < dayGroups.length; i++) {
        if (dayGroups[i].matches.some(m => !states[m.id]?.submitted)) {
          targetDay = i + 1
          break
        }
      }
      setVisibleDays(targetDay)
    } else {
      setMatchStates({})
      setArtilheiro('')
      setVisibleDays(1)
    }
    setAccOpen({})
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateState(jogoId: string, patch: Partial<MatchState>) {
    setMatchStates(prev => ({ ...prev, [jogoId]: { ...prev[jogoId], ...patch } }))
  }

  function toggleAcc(date: string) {
    setAccOpen(prev => ({ ...prev, [date]: !prev[date] }))
  }

  async function criarPalpite() {
    if (!novoNome.trim()) return
    setCriando(true)
    setCriarError('')

    const { data: p, error: insertError } = await supabase
      .from('palpites')
      .insert({ usuario_id: userId, nome: novoNome.trim(), status: 'inativo', artilheiro: '' })
      .select()
      .single()

    if (insertError || !p) {
      setCriarError(insertError?.message ?? 'Erro ao criar palpite. Tente novamente.')
      setCriando(false)
      return
    }

    if (todosJogos.length > 0) {
      const rows = todosJogos.map(j => ({ palpite_id: p.id, jogo_id: j.id, pontos: 0 }))
      await supabase.from('palpites_jogos').insert(rows)
    }

    const { data: full } = await supabase
      .from('palpites')
      .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
      .eq('id', p.id)
      .single()

    if (full) {
      setPalpites(prev => [full as Palpite, ...prev])
      setSelectedId(full.id)
    }

    setNovoNome('')
    setShowNovo(false)
    setCriando(false)
  }

  async function submitMatch(jogoId: string) {
    const st = matchStates[jogoId]
    if (!st || !selectedId) return
    updateState(jogoId, { saving: true, error: null })
    const { error } = await supabase.from('palpites_jogos').upsert({
      palpite_id: selectedId,
      jogo_id: jogoId,
      placar_palpite_a: st.scoreA,
      placar_palpite_b: st.scoreB,
      submitted_at: new Date().toISOString(),
      pontos: 0,
    }, { onConflict: 'palpite_id,jogo_id' })
    if (error) {
      updateState(jogoId, { saving: false, error: 'Erro ao salvar. Tente novamente.' })
    } else {
      updateState(jogoId, { saving: false, submitted: true, submittedAt: new Date().toISOString() })
    }
  }

  function editMatch(jogoId: string) {
    updateState(jogoId, { submitted: false })
  }

  async function saveArtilheiro() {
    if (!selectedId) return
    setArtSaving(true)
    await supabase.from('palpites').update({ artilheiro }).eq('id', selectedId)
    setArtSaving(false)
  }

  const totalJogos = todosJogos.length
  const nextDay = days[visibleDays]
  const hasMore = visibleDays < days.length

  return (
    <div className="page-main palpites-main" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Meus palpites</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Selecione um palpite para editar ou crie um novo</div>
        </div>
        <button onClick={() => setShowNovo(!showNovo)}
          style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 7, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
          + Novo palpite
        </button>
      </div>

      {/* Create form */}
      {showNovo && (
        <>
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, fontWeight: 600 }}>Nome do palpite</label>
              <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Família Pereira..." maxLength={40}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 7, padding: '9px 12px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
            </div>
            <button onClick={criarPalpite} disabled={criando || !novoNome.trim()}
              style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>
              {criando ? 'Criando...' : 'Criar'}
            </button>
            <button onClick={() => { setShowNovo(false); setCriarError('') }}
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: 'none', padding: '10px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>×</button>
          </div>
          {criarError && (
            <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 12, color: 'rgba(255,130,130,0.9)' }}>
              {criarError}
            </div>
          )}
        </>
      )}

      {/* Entry cards */}
      <div className="entries-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {palpites.map(p => {
          const isSel = p.id === selectedId
          const pts = p.palpites_jogos?.reduce((s, pj) => s + (pj.pontos ?? 0), 0) ?? 0
          const preenchi = p.palpites_jogos?.filter(pj => pj.submitted_at).length ?? 0
          const pct = totalJogos > 0 ? Math.round((preenchi / totalJogos) * 100) : 0
          return (
            <div key={p.id} onClick={() => setSelectedId(p.id)}
              style={{ background: '#0D1E3D', border: `1px solid ${isSel ? '#4A90D9' : 'rgba(74,144,217,0.15)'}`, borderRadius: 10, padding: '12px 13px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: isSel ? 'linear-gradient(90deg,#4A90D9,#7BB8F0)' : 'rgba(74,144,217,0.25)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{p.nome}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{userName}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: p.status === 'ativo' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.07)', color: p.status === 'ativo' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                  {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: p.status === 'ativo' ? '#4A90D9' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
                {p.status === 'ativo' ? pts : '—'} <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>pts</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{ height: 3, background: p.status === 'ativo' ? 'linear-gradient(90deg,#4A90D9,#7BB8F0)' : 'rgba(255,255,255,0.15)', borderRadius: 2, width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{preenchi}/{totalJogos} jogos</span>
              </div>
            </div>
          )
        })}
        <div className="ec-new-card" onClick={() => setShowNovo(true)}
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 90, cursor: 'pointer' }}>
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.2)' }}>+</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>Criar novo palpite</span>
        </div>
      </div>

      {selected && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Jogos em ordem cronológica — envie cada placar individualmente
          </div>

          {/* ─── Day groups ─── */}
          {days.slice(0, visibleDays).map(group => {
            const submitted = group.matches.filter(m => matchStates[m.id]?.submitted)
            const pending   = group.matches.filter(m => !matchStates[m.id]?.submitted)
            const allDone   = pending.length === 0
            const hasSome   = submitted.length > 0
            const isOpen    = !!accOpen[group.date]

            // Colors
            const green = { border: 'rgba(74,222,128,0.25)', bg: 'rgba(74,222,128,0.04)', bgHov: 'rgba(74,222,128,0.08)', line: 'rgba(74,222,128,0.15)', chevron: 'rgba(74,222,128,0.7)' }
            const orange = { border: 'rgba(249,115,22,0.35)',  bg: 'rgba(249,115,22,0.04)',  bgHov: 'rgba(249,115,22,0.08)',  line: 'rgba(249,115,22,0.2)',  chevron: 'rgba(249,115,22,0.8)' }
            const col = allDone ? green : orange

            return (
              <div key={group.date} style={{ marginBottom: 22 }}>

                {/* ── Case 1: all pending → plain header, cards expanded ── */}
                {!hasSome && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Dia {group.dayNum}</span>
                      <span className="day-date-full" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{group.label}</span>
                      <span className="day-date-short" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', display: 'none' }}>{group.labelShort}</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{group.matches.length} jogos</span>
                    </div>
                    <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                      {group.matches.map(jogo => (
                        <MatchCard key={jogo.id} jogo={jogo}
                          state={matchStates[jogo.id] ?? { scoreA: 0, scoreB: 0, submitted: false, submittedAt: null, saving: false, error: null }}
                          onScoreChange={(side, val) => !matchStates[jogo.id]?.submitted && updateState(jogo.id, side === 'A' ? { scoreA: val } : { scoreB: val })}
                          onSubmit={() => submitMatch(jogo.id)}
                          onEdit={() => editMatch(jogo.id)} />
                      ))}
                    </div>
                  </>
                )}

                {/* ── Case 2: all submitted → single green accordion ── */}
                {allDone && hasSome && (
                  <Accordion
                    isOpen={isOpen} onToggle={() => toggleAcc(group.date)}
                    dayNum={group.dayNum} label={group.label} labelShort={group.labelShort}
                    sentCount={submitted.length} pendingCount={0} col={green}>
                    <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 2 }}>
                      {submitted.map(jogo => (
                        <MatchCard key={jogo.id} jogo={jogo}
                          state={matchStates[jogo.id]}
                          onScoreChange={(side, val) => updateState(jogo.id, side === 'A' ? { scoreA: val } : { scoreB: val })}
                          onSubmit={() => submitMatch(jogo.id)}
                          onEdit={() => editMatch(jogo.id)} />
                      ))}
                    </div>
                  </Accordion>
                )}

                {/* ── Case 3: mixed → orange accordion + pending section ── */}
                {hasSome && !allDone && (
                  <>
                    <Accordion
                      isOpen={isOpen} onToggle={() => toggleAcc(group.date)}
                      dayNum={group.dayNum} label={group.label} labelShort={group.labelShort}
                      sentCount={submitted.length} pendingCount={pending.length} col={col}>
                      <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 2 }}>
                        {submitted.map(jogo => (
                          <MatchCard key={jogo.id} jogo={jogo}
                            state={matchStates[jogo.id]}
                            onScoreChange={(side, val) => updateState(jogo.id, side === 'A' ? { scoreA: val } : { scoreB: val })}
                            onSubmit={() => submitMatch(jogo.id)}
                            onEdit={() => editMatch(jogo.id)} />
                        ))}
                      </div>
                    </Accordion>

                    {/* Pending label */}
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.7, margin: '8px 0 8px 2px' }}>
                      ⏳ Aguardando palpite
                    </div>
                    <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                      {pending.map(jogo => (
                        <MatchCard key={jogo.id} jogo={jogo}
                          state={matchStates[jogo.id] ?? { scoreA: 0, scoreB: 0, submitted: false, submittedAt: null, saving: false, error: null }}
                          onScoreChange={(side, val) => !matchStates[jogo.id]?.submitted && updateState(jogo.id, side === 'A' ? { scoreA: val } : { scoreB: val })}
                          onSubmit={() => submitMatch(jogo.id)}
                          onEdit={() => editMatch(jogo.id)} />
                      ))}
                    </div>
                  </>
                )}

              </div>
            )
          })}

          {/* Load more */}
          {hasMore && nextDay && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, margin: '4px 0 20px' }}>
              <button onClick={() => setVisibleDays(v => v + 1)}
                style={{ background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', color: '#7BB8F0', padding: '10px 28px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5, width: '100%' }}>
                Carregar próximo dia →
              </button>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                Dia {nextDay.dayNum} · {nextDay.label} · {nextDay.matches.length} jogos
              </div>
            </div>
          )}

          {/* Artilheiro */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4, marginBottom: 8 }}>
            Palpite especial
          </div>
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14, maxWidth: 380, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, whiteSpace: 'nowrap' }}>⚽ Artilheiro da Copa</span>
            <input type="text" value={artilheiro} onChange={e => setArtilheiro(e.target.value)} onBlur={saveArtilheiro}
              placeholder="Nome do jogador"
              style={{ flex: 1, border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#4A90D9', background: 'rgba(74,144,217,0.07)', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
            {artSaving && <span style={{ fontSize: 10, color: '#4A90D9' }}>●</span>}
          </div>

          {/* Desktop bottom bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              Palpite <strong style={{ color: 'white' }}>{selected.status === 'ativo' ? 'ativo' : 'inativo'}</strong>
              {selected.status === 'inativo' && <> · Ative pagando <strong style={{ color: 'white' }}>R$ {PIX_VALOR},00</strong> via PIX para participar</>}
            </div>
            {selected.status === 'inativo' && (
              <button onClick={() => setShowPix(true)}
                style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pagar e ativar via PIX
              </button>
            )}
          </div>

          {/* Mobile PIX sticky bar */}
          {selected.status === 'inativo' && (
            <div className="pix-bar">
              <div className="pix-bar-text" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                Palpite <strong style={{ color: 'white' }}>inativo</strong> · <strong style={{ color: 'white' }}>R$ {PIX_VALOR},00</strong>
              </div>
              <button onClick={() => setShowPix(true)} className="pix-bar-btn"
                style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '11px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                Pagar e ativar
              </button>
            </div>
          )}

          {/* PIX modal */}
          {showPix && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.35)', borderRadius: 12, padding: '28px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>Ativar via PIX</div>
                <div style={{ background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Chave PIX</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'white' }}>{PIX_CHAVE}</div>
                  <div style={{ fontSize: 11, color: '#4A90D9', marginTop: 6 }}>R$ {PIX_VALOR},00</div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16, lineHeight: 1.5 }}>
                  Após o pagamento envie o comprovante para que o administrador confirme e ative seu palpite.
                </div>
                <button onClick={() => setShowPix(false)}
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', padding: '8px 20px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  Fechar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Accordion ─────────────────────────────────────────────── */

interface AccCol { border: string; bg: string; line: string; chevron: string }

function Accordion({
  isOpen, onToggle, dayNum, label, labelShort,
  sentCount, pendingCount, col, children,
}: {
  isOpen: boolean
  onToggle: () => void
  dayNum: number
  label: string
  labelShort: string
  sentCount: number
  pendingCount: number
  col: AccCol
  children: React.ReactNode
}) {
  const hasPending = pendingCount > 0
  const sentLabel = `✓ ${sentCount} ${sentCount === 1 ? 'enviado' : 'enviados'}`
  const pendLabel = `⏳ ${pendingCount} ${pendingCount === 1 ? 'pendente' : 'pendentes'}`

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: col.bg,
          border: `1px solid ${col.border}`,
          borderRadius: 8, padding: '9px 14px',
          cursor: 'pointer', userSelect: 'none',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Dia {dayNum}</span>
        <span className="day-date-full" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="day-date-short" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', display: 'none' }}>{labelShort}</span>
        <div style={{ flex: 1, height: 1, background: col.line }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{sentLabel}</span>
        {hasPending && <span style={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{pendLabel}</span>}
        <span style={{ fontSize: 11, color: col.chevron, transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>▼</span>
      </div>

      {/* Body */}
      {isOpen && (
        <div style={{ paddingTop: 8 }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ─── MatchCard ─────────────────────────────────────────────── */

interface MatchCardProps {
  jogo: JogoCopa
  state: MatchState
  onScoreChange: (side: 'A' | 'B', val: number) => void
  onSubmit: () => void
  onEdit: () => void
}

function MatchCard({ jogo, state, onScoreChange, onSubmit, onEdit }: MatchCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const locked  = isLocked(jogo.data, jogo.horario)
  const editable = canEdit(jogo.data, jogo.horario)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const mm = `${jogo.data.slice(8, 10)} ${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(jogo.data.slice(5, 7)) - 1]} · ${jogo.horario.slice(0, 5).replace(':', 'h')} · ${jogo.cidade}`

  const borderColor = locked
    ? 'rgba(74,144,217,0.15)'
    : state.submitted
    ? 'rgba(74,222,128,0.25)'
    : 'rgba(74,144,217,0.3)'

  const scoreColor  = state.submitted ? '#4ade80' : '#4A90D9'
  const scoreBorder = state.submitted ? '2px solid rgba(74,222,128,0.7)' : '2px solid transparent'

  function ScoreControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button className="sc-btn"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={locked}
          style={{ width: 24, height: 24, border: '1px solid rgba(74,144,217,0.35)', borderRadius: 5, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0, padding: 0 }}>
          −
        </button>
        <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: scoreColor, borderRadius: 6, border: scoreBorder, transition: 'border-color 0.3s, color 0.3s', userSelect: 'none' }}>
          {value}
        </div>
        <button className="sc-btn"
          onClick={() => onChange(value + 1)}
          disabled={locked}
          style={{ width: 24, height: 24, border: '1px solid rgba(74,144,217,0.35)', borderRadius: 5, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0, padding: 0 }}>
          +
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#0D1E3D', border: `1px solid ${borderColor}`, borderRadius: 10, padding: '12px 14px', position: 'relative', opacity: locked ? 0.4 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>{mm}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {state.submitted && <span style={{ color: '#4ade80', fontSize: 14, fontWeight: 700 }}>✓</span>}
          {state.submitted && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.25)', fontSize: 13, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ⋮
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', top: 28, right: 0, background: '#1a2d50', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 8, padding: 4, minWidth: 155, zIndex: 10 }}>
                  {editable ? (
                    <div onClick={() => { onEdit(); setMenuOpen(false) }}
                      style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,144,217,0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      ✏️ Editar placar
                    </div>
                  ) : (
                    <div style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)', borderRadius: 6, cursor: 'not-allowed', whiteSpace: 'nowrap' }}
                      title="Prazo encerrado — jogo começa em menos de 1 hora">
                      ✏️ Editar placar
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Teams + scores */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Flag codigo={jogo.codigo_pais_a} size={24} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{abbr(jogo.time_a)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ScoreControl value={state.scoreA} onChange={v => onScoreChange('A', v)} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', padding: '0 2px', fontWeight: 300 }}>×</span>
          <ScoreControl value={state.scoreB} onChange={v => onScoreChange('B', v)} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Flag codigo={jogo.codigo_pais_b} size={24} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{abbr(jogo.time_b)}</span>
        </div>
      </div>

      {state.error && <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,100,100,0.9)', textAlign: 'center' }}>{state.error}</div>}

      {locked ? (
        <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.25)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 }}>🔒 Jogo em andamento</div>
      ) : (
        <div style={{ marginTop: 10, display: state.submitted ? 'none' : 'block' }}>
          <button onClick={onSubmit} disabled={state.saving}
            style={{ width: '100%', background: 'rgba(74,144,217,0.14)', border: '1px solid rgba(74,144,217,0.3)', color: '#7BB8F0', padding: 6, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {state.saving ? '...' : 'Enviar placar'}
          </button>
        </div>
      )}
    </div>
  )
}
