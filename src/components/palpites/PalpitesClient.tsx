'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { PIX_VALOR, PIX_CHAVE, GRUPOS } from '@/utils/constants'
import type { Palpite, JogoCopa, PalpiteJogo } from '@/types'

/* ─── helpers ──────────────────────────────────────────────── */

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
  label: string
  labelShort: string
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

/* ─── match state ───────────────────────────────────────────── */

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

/* ─── main component ─────────────────────────────────────────── */

interface Props {
  userId: string
  userName: string
  palpitesIniciais: Palpite[]
  todosJogos: JogoCopa[]
}

const VISIBLE = 3

export function PalpitesClient({ userId, userName, palpitesIniciais, todosJogos }: Props) {
  const supabase = createClient()

  /* core */
  const [palpites, setPalpites] = useState<Palpite[]>(palpitesIniciais)
  const [selectedId, setSelectedId] = useState<string | null>(palpitesIniciais[0]?.id ?? null)

  /* create */
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [criarError, setCriarError] = useState('')
  const [showNovo, setShowNovo] = useState(false)

  /* pix */
  const [showPix, setShowPix] = useState(false)

  /* delete menu */
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const cardMenuRef = useRef<HTMLDivElement>(null)

  /* match editing */
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({})
  const [visibleDays, setVisibleDays] = useState(1)
  const [artilheiro, setArtilheiro] = useState('')
  const [artSaving, setArtSaving] = useState(false)
  const [accOpen, setAccOpen] = useState<Record<string, boolean>>({})

  /* tabs */
  const [activeTab, setActiveTab] = useState(0)

  /* carousel */
  const [carOffset, setCarOffset] = useState(0)   // desktop: first visible index
  const [mobileIdx, setMobileIdx] = useState(0)   // mobile: current index
  const mobileOuterRef = useRef<HTMLDivElement>(null)
  const mobileTrackRef = useRef<HTMLDivElement>(null)
  const touchStartXRef = useRef(0)

  /* derived */
  const selected = palpites.find(p => p.id === selectedId)
  const days = groupByDay(todosJogos)
  const carItems = [...palpites, 'new' as const]
  const totalCards = carItems.length
  const selIdx = palpites.findIndex(p => p.id === selectedId)
  const mataMataEnabled = todosJogos.length >= 48 && todosJogos.every(j => j.resultado != null)
  const totalJogos = todosJogos.length
  const nextDay = days[visibleDays]
  const hasMore = visibleDays < days.length

  /* ─── effects ─────────────────────────────────────────────── */

  useEffect(() => {
    setActiveTab(0)
    const palpite = palpites.find(p => p.id === selectedId)
    if (palpite?.palpites_jogos) {
      const states = initStates(palpite.palpites_jogos)
      setMatchStates(states)
      setArtilheiro(palpite.artilheiro ?? '')
      const dayGroups = groupByDay(todosJogos)
      let targetDay = 1
      for (let i = 0; i < dayGroups.length; i++) {
        if (dayGroups[i].matches.some(m => !states[m.id]?.submitted)) { targetDay = i + 1; break }
      }
      setVisibleDays(targetDay)
    } else {
      setMatchStates({})
      setArtilheiro('')
      setVisibleDays(1)
    }
    setAccOpen({})
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync carousel position when selection changes
  useEffect(() => {
    const idx = palpites.findIndex(p => p.id === selectedId)
    if (idx < 0) return
    if (idx < carOffset) setCarOffset(idx)
    else if (idx >= carOffset + VISIBLE) setCarOffset(Math.max(0, idx - VISIBLE + 1))
    setMobileIdx(idx)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply mobile carousel transform
  useEffect(() => {
    const outer = mobileOuterRef.current
    const track = mobileTrackRef.current
    if (!outer || !track) return
    // card = outer - 20px wide, gap = 10px → step = outer - 20 + 10 = outer - 10
    const step = outer.offsetWidth - 10
    track.style.transform = `translateX(-${mobileIdx * step}px)`
  }, [mobileIdx])

  // Click-outside for card delete menu
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) setCardMenuOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ─── carousel handlers ────────────────────────────────────── */

  function selectCard(idx: number) {
    if (idx >= palpites.length) { setShowNovo(true); return }
    const p = palpites[idx]
    if (!p) return
    setSelectedId(p.id)
    if (idx < carOffset) setCarOffset(idx)
    else if (idx >= carOffset + VISIBLE) setCarOffset(Math.max(0, idx - VISIBLE + 1))
    setMobileIdx(idx)
  }

  function onTouchStart(e: React.TouchEvent) { touchStartXRef.current = e.touches[0].clientX }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartXRef.current
    if (Math.abs(dx) > 40) {
      const newIdx = Math.max(0, Math.min(mobileIdx + (dx < 0 ? 1 : -1), carItems.length - 1))
      setMobileIdx(newIdx)
      if (newIdx < palpites.length) setSelectedId(palpites[newIdx].id)
    }
  }

  /* ─── other handlers ───────────────────────────────────────── */

  function updateState(jogoId: string, patch: Partial<MatchState>) {
    setMatchStates(prev => ({ ...prev, [jogoId]: { ...prev[jogoId], ...patch } }))
  }

  function toggleAcc(date: string) {
    setAccOpen(prev => ({ ...prev, [date]: !prev[date] }))
  }

  async function deletePalpite(id: string) {
    setDeleting(true)
    const res = await fetch(`/api/palpites/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) return
    setConfirmDelete(null)
    setCardMenuOpen(null)
    setPalpites(prev => {
      const next = prev.filter(p => p.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  async function criarPalpite() {
    if (!novoNome.trim()) return
    setCriando(true); setCriarError('')
    const { data: p, error: insertError } = await supabase
      .from('palpites')
      .insert({ usuario_id: userId, nome: novoNome.trim(), status: 'inativo', artilheiro: '' })
      .select().single()
    if (insertError || !p) {
      setCriarError(insertError?.message ?? 'Erro ao criar palpite. Tente novamente.')
      setCriando(false); return
    }
    if (todosJogos.length > 0) {
      const rows = todosJogos.map(j => ({ palpite_id: p.id, jogo_id: j.id, pontos: 0 }))
      await supabase.from('palpites_jogos').insert(rows)
    }
    const { data: full } = await supabase
      .from('palpites')
      .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
      .eq('id', p.id).single()
    if (full) { setPalpites(prev => [full as Palpite, ...prev]); setSelectedId(full.id) }
    setNovoNome(''); setShowNovo(false); setCriando(false)
  }

  async function submitMatch(jogoId: string) {
    const st = matchStates[jogoId]
    if (!st || !selectedId) return
    updateState(jogoId, { saving: true, error: null })
    const { error } = await supabase.from('palpites_jogos').upsert({
      palpite_id: selectedId, jogo_id: jogoId,
      placar_palpite_a: st.scoreA, placar_palpite_b: st.scoreB,
      submitted_at: new Date().toISOString(), pontos: 0,
    }, { onConflict: 'palpite_id,jogo_id' })
    if (error) updateState(jogoId, { saving: false, error: 'Erro ao salvar. Tente novamente.' })
    else updateState(jogoId, { saving: false, submitted: true, submittedAt: new Date().toISOString() })
  }

  function editMatch(jogoId: string) { updateState(jogoId, { submitted: false }) }

  async function saveArtilheiro() {
    if (!selectedId) return
    setArtSaving(true)
    await supabase.from('palpites').update({ artilheiro }).eq('id', selectedId)
    setArtSaving(false)
  }

  /* ─── card renderer (shared desktop + mobile) ────────────── */

  function renderCard(p: Palpite, keyPrefix: string, extraStyle?: React.CSSProperties) {
    const isSel = p.id === selectedId
    const isInativo = p.status === 'inativo'
    const isMenuOpen = cardMenuOpen === p.id
    const isConfirming = confirmDelete === p.id
    const pts = p.palpites_jogos?.reduce((s, pj) => s + (pj.pontos ?? 0), 0) ?? 0
    const preenchi = p.palpites_jogos?.filter(pj => pj.submitted_at).length ?? 0
    const pct = totalJogos > 0 ? Math.round((preenchi / totalJogos) * 100) : 0

    return (
      <div key={`${keyPrefix}${p.id}`}
        onClick={() => { if (!isMenuOpen && !isConfirming) setSelectedId(p.id) }}
        style={{
          background: '#0D1E3D', border: `1px solid ${isSel ? '#4A90D9' : 'rgba(74,144,217,0.15)'}`,
          borderRadius: 10, padding: '13px 15px', cursor: 'pointer',
          position: 'relative', overflow: 'visible',
          opacity: isSel ? 1 : 0.65, transition: 'opacity 0.2s, border-color 0.2s',
          flex: extraStyle ? undefined : 1, minWidth: extraStyle ? undefined : 0,
          ...extraStyle,
        }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: '10px 10px 0 0', background: isSel ? 'linear-gradient(90deg,#4A90D9,#7BB8F0)' : 'rgba(74,144,217,0.2)', transition: 'background 0.2s' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{userName}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: isInativo ? 'rgba(255,255,255,0.07)' : 'rgba(74,222,128,0.15)', color: isInativo ? 'rgba(255,255,255,0.4)' : '#4ade80' }}>
              {isInativo ? 'Inativo' : 'Ativo'}
            </span>
            {isInativo && (
              <div ref={isMenuOpen ? cardMenuRef : null} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button onClick={() => { setCardMenuOpen(isMenuOpen ? null : p.id); setConfirmDelete(null) }}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 14, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>
                  ⋮
                </button>
                {isMenuOpen && (
                  <div style={{ position: 'absolute', top: 26, right: 0, background: '#1a2d50', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 8, padding: 4, minWidth: 150, zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                    {isConfirming ? (
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 8, lineHeight: 1.4 }}>Excluir este palpite?<br/><span style={{ color: 'rgba(255,255,255,0.4)' }}>Esta ação não pode ser desfeita.</span></div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => deletePalpite(p.id)} disabled={deleting}
                            style={{ flex: 1, background: 'rgba(255,80,80,0.2)', border: '1px solid rgba(255,80,80,0.4)', color: 'rgba(255,130,130,0.9)', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                            {deleting ? '...' : 'Excluir'}
                          </button>
                          <button onClick={() => { setConfirmDelete(null); setCardMenuOpen(null) }}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setConfirmDelete(p.id)}
                        style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,130,130,0.85)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        🗑 Excluir palpite
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: isInativo ? 'rgba(255,255,255,0.2)' : '#4A90D9', lineHeight: 1 }}>
          {isInativo ? '—' : pts} <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>pts</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{ height: 3, background: isInativo ? 'rgba(255,255,255,0.15)' : 'linear-gradient(90deg,#4A90D9,#7BB8F0)', borderRadius: 2, width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{preenchi}/{totalJogos} jogos</span>
        </div>
      </div>
    )
  }

  function renderNewCard(keyPrefix: string, extraStyle?: React.CSSProperties) {
    return (
      <div key={`${keyPrefix}new`} onClick={() => setShowNovo(true)}
        style={{
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 5,
          minHeight: 90, cursor: 'pointer', opacity: 0.7,
          flex: extraStyle ? undefined : 1, minWidth: extraStyle ? undefined : 0,
          ...extraStyle,
        }}>
        <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.2)' }}>+</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>Criar novo palpite</span>
      </div>
    )
  }

  const activeDot = selIdx >= 0 ? selIdx : palpites.length

  /* ─── render ─────────────────────────────────────────────── */

  return (
    <div className="page-main palpites-main" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Meus palpites</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Navegue entre seus palpites ou crie um novo</div>
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

      {/* ── DESKTOP CAROUSEL ─────────────────────────────────── */}
      <div className="car-desktop" style={{ position: 'relative', padding: '0 18px', marginBottom: 6 }}>
        <button onClick={() => setCarOffset(o => Math.max(0, o - 1))}
          style={{ display: carOffset === 0 ? 'none' : 'flex', position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 4, zIndex: 5, width: 28, height: 28, borderRadius: '50%', background: 'rgba(13,30,61,0.92)', border: '1px solid rgba(74,144,217,0.3)', color: '#7BB8F0', fontSize: 15, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', padding: 0, lineHeight: 1 }}>‹</button>

        <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
          {carItems.map((item, idx) => {
            if (idx < carOffset || idx >= carOffset + VISIBLE) return null
            return item === 'new' ? renderNewCard('d-') : renderCard(item, 'd-')
          })}
          {Array.from({ length: Math.max(0, carOffset + VISIBLE - totalCards) }).map((_, i) => (
            <div key={`fill-${i}`} style={{ flex: 1, minWidth: 0 }} />
          ))}
        </div>

        <button onClick={() => setCarOffset(o => Math.min(o + 1, Math.max(0, totalCards - VISIBLE)))}
          style={{ display: carOffset + VISIBLE >= totalCards ? 'none' : 'flex', position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 4, zIndex: 5, width: 28, height: 28, borderRadius: '50%', background: 'rgba(13,30,61,0.92)', border: '1px solid rgba(74,144,217,0.3)', color: '#7BB8F0', fontSize: 15, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', padding: 0, lineHeight: 1 }}>›</button>
      </div>

      {/* ── MOBILE CAROUSEL ──────────────────────────────────── */}
      <div className="car-mobile" ref={mobileOuterRef} style={{ overflow: 'hidden', marginBottom: 4 }}>
        <div ref={mobileTrackRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          style={{ display: 'flex', gap: 10, transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)', willChange: 'transform' }}>
          {carItems.map(item =>
            item === 'new'
              ? renderNewCard('m-', { flexShrink: 0, width: 'calc(100% - 20px)' })
              : renderCard(item, 'm-', { flexShrink: 0, width: 'calc(100% - 20px)' })
          )}
        </div>
      </div>

      {/* ── DOTS ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, margin: '8px 0 16px' }}>
        {carItems.map((_, idx) => (
          <div key={idx} onClick={() => selectCard(idx)} style={{
            width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
            background: idx === activeDot ? '#4A90D9' : 'rgba(255,255,255,0.15)',
            transform: idx === activeDot ? 'scale(1.3)' : 'scale(1)',
            transition: 'background 0.2s, transform 0.2s',
          }} />
        ))}
      </div>

      {/* ── TABS + CONTENT ────────────────────────────────────── */}
      {selected && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 18, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
            {(['Fase de Grupos', 'Mata-Mata', 'Tabela do Palpite'] as const).map((label, i) => {
              const locked = i === 1 && !mataMataEnabled
              const active = activeTab === i
              return (
                <div key={i} onClick={() => !locked && setActiveTab(i)} style={{
                  padding: '10px 20px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  color: locked ? 'rgba(255,255,255,0.2)' : active ? 'white' : 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase', letterSpacing: 0.5, userSelect: 'none',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  borderBottom: `2px solid ${active && !locked ? '#4A90D9' : 'transparent'}`,
                  marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
                }}>
                  {label}{locked && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }}>🔒</span>}
                </div>
              )
            })}
          </div>

          {/* Tab 1: Fase de Grupos */}
          {activeTab === 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                Jogos em ordem cronológica — envie cada placar individualmente
              </div>

              {days.slice(0, visibleDays).map(group => {
                const submitted = group.matches.filter(m => matchStates[m.id]?.submitted)
                const pending   = group.matches.filter(m => !matchStates[m.id]?.submitted)
                const allDone   = pending.length === 0
                const hasSome   = submitted.length > 0
                const isOpen    = !!accOpen[group.date]
                const green  = { border: 'rgba(74,222,128,0.25)', bg: 'rgba(74,222,128,0.04)', line: 'rgba(74,222,128,0.15)', chevron: 'rgba(74,222,128,0.7)' }
                const orange = { border: 'rgba(249,115,22,0.35)',  bg: 'rgba(249,115,22,0.04)',  line: 'rgba(249,115,22,0.2)',  chevron: 'rgba(249,115,22,0.8)' }
                const col = allDone ? green : orange
                return (
                  <div key={group.date} style={{ marginBottom: 22 }}>
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
                              onSubmit={() => submitMatch(jogo.id)} onEdit={() => editMatch(jogo.id)} />
                          ))}
                        </div>
                      </>
                    )}
                    {allDone && hasSome && (
                      <Accordion isOpen={isOpen} onToggle={() => toggleAcc(group.date)} dayNum={group.dayNum} label={group.label} labelShort={group.labelShort} sentCount={submitted.length} pendingCount={0} col={green}>
                        <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 2 }}>
                          {submitted.map(jogo => (
                            <MatchCard key={jogo.id} jogo={jogo} state={matchStates[jogo.id]}
                              onScoreChange={(side, val) => updateState(jogo.id, side === 'A' ? { scoreA: val } : { scoreB: val })}
                              onSubmit={() => submitMatch(jogo.id)} onEdit={() => editMatch(jogo.id)} />
                          ))}
                        </div>
                      </Accordion>
                    )}
                    {hasSome && !allDone && (
                      <>
                        <Accordion isOpen={isOpen} onToggle={() => toggleAcc(group.date)} dayNum={group.dayNum} label={group.label} labelShort={group.labelShort} sentCount={submitted.length} pendingCount={pending.length} col={col}>
                          <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 2 }}>
                            {submitted.map(jogo => (
                              <MatchCard key={jogo.id} jogo={jogo} state={matchStates[jogo.id]}
                                onScoreChange={(side, val) => updateState(jogo.id, side === 'A' ? { scoreA: val } : { scoreB: val })}
                                onSubmit={() => submitMatch(jogo.id)} onEdit={() => editMatch(jogo.id)} />
                            ))}
                          </div>
                        </Accordion>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.7, margin: '8px 0 8px 2px' }}>⏳ Aguardando palpite</div>
                        <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                          {pending.map(jogo => (
                            <MatchCard key={jogo.id} jogo={jogo}
                              state={matchStates[jogo.id] ?? { scoreA: 0, scoreB: 0, submitted: false, submittedAt: null, saving: false, error: null }}
                              onScoreChange={(side, val) => !matchStates[jogo.id]?.submitted && updateState(jogo.id, side === 'A' ? { scoreA: val } : { scoreB: val })}
                              onSubmit={() => submitMatch(jogo.id)} onEdit={() => editMatch(jogo.id)} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

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
            </>
          )}

          {/* Tab 2: Mata-Mata (locked) */}
          {activeTab === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>🏆</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>Mata-Mata disponível após a fase de grupos</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', maxWidth: 320, lineHeight: 1.5 }}>
                Os jogos do mata-mata serão liberados assim que todos os 48 jogos da fase de grupos forem concluídos.
              </div>
            </div>
          )}

          {/* Tab 3: Tabela do Palpite */}
          {activeTab === 2 && <TabelaDoPalpite palpite={selected} todosJogos={todosJogos} />}

          {/* Artilheiro */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8 }}>
            Palpite especial
          </div>
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14, maxWidth: 380, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500, whiteSpace: 'nowrap' }}>⚽ Artilheiro da Copa</span>
            <input type="text" value={artilheiro} onChange={e => setArtilheiro(e.target.value)} onBlur={saveArtilheiro} placeholder="Nome do jogador"
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

          {/* Mobile PIX bar */}
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

/* ─── TabelaDoPalpite ────────────────────────────────────── */

function TabelaDoPalpite({ palpite, todosJogos }: { palpite: Palpite; todosJogos: JogoCopa[] }) {
  const submittedMap: Record<string, PalpiteJogo> = {}
  for (const pj of palpite.palpites_jogos ?? []) {
    if (pj.submitted_at) submittedMap[pj.jogo_id] = pj
  }

  const grupoJogos: Record<string, JogoCopa[]> = {}
  for (const j of todosJogos) {
    if (!j.grupo) continue
    if (!grupoJogos[j.grupo]) grupoJogos[j.grupo] = []
    grupoJogos[j.grupo].push(j)
  }

  type Row = { time: string; codigo: string; j:number; v:number; e:number; d:number; gp:number; gc:number; sg:number; pts:number }

  const grupos = GRUPOS.map(g => {
    const jogos = grupoJogos[g] ?? []
    const standings: Record<string, Row> = {}

    for (const jogo of jogos) {
      if (!standings[jogo.time_a]) standings[jogo.time_a] = { time: jogo.time_a, codigo: jogo.codigo_pais_a, j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0 }
      if (!standings[jogo.time_b]) standings[jogo.time_b] = { time: jogo.time_b, codigo: jogo.codigo_pais_b, j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0 }

      const pj = submittedMap[jogo.id]
      if (!pj) continue

      const ga = pj.placar_palpite_a ?? 0
      const gb = pj.placar_palpite_b ?? 0
      const ta = standings[jogo.time_a]
      const tb = standings[jogo.time_b]

      ta.j++; tb.j++
      ta.gp += ga; ta.gc += gb; ta.sg += ga - gb
      tb.gp += gb; tb.gc += ga; tb.sg += gb - ga

      if (ga > gb) { ta.v++; ta.pts += 3; tb.d++ }
      else if (ga < gb) { tb.v++; tb.pts += 3; ta.d++ }
      else { ta.e++; ta.pts++; tb.e++; tb.pts++ }
    }

    const times = Object.values(standings).sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp)
    return { grupo: g, times }
  }).filter(g => g.times.length > 0)

  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 14, fontWeight: 500 }}>
        Classificação calculada a partir dos seus palpites · Critérios FIFA
      </div>

      <div className="tabela-palpite-grid">
        {grupos.map(({ grupo, times }) => (
          <div key={grupo} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(74,144,217,0.08)', borderBottom: '1px solid rgba(74,144,217,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: '#4A90D9', letterSpacing: 1 }}>{grupo}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Grupo {grupo}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 6px 5px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', width: '50%' }}>Seleção</th>
                  {['J','V','E','D','SG','Pts'].map(h => (
                    <th key={h} style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((row, idx) => {
                  const qualify = idx < 2
                  const maybe   = idx === 2
                  const out     = idx === 3
                  const sgStr   = row.sg > 0 ? `+${row.sg}` : String(row.sg)
                  const rowBg   = qualify ? 'rgba(74,144,217,0.06)' : maybe ? 'rgba(251,191,36,0.04)' : 'transparent'
                  const leftBorder = qualify ? '2px solid #4A90D9' : maybe ? '2px solid rgba(251,191,36,0.7)' : '2px solid transparent'
                  const ptsColor = maybe ? '#fbbf24' : qualify ? '#4A90D9' : 'rgba(255,255,255,0.45)'
                  return (
                    <tr key={row.time} style={{ opacity: out ? 0.45 : 1 }}>
                      <td style={{ background: rowBg, borderLeft: leftBorder, padding: '6px 6px 6px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', width: 12, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                          <Image src={`https://flagcdn.com/w40/${row.codigo}.png`} alt={row.time} width={16} height={11} style={{ borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} unoptimized />
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.time}</span>
                        </div>
                      </td>
                      {[row.j, row.v, row.e, row.d, sgStr].map((val, ci) => (
                        <td key={ci} style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: '6px 6px', background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{val}</td>
                      ))}
                      <td style={{ fontSize: 11, fontWeight: 800, color: ptsColor, textAlign: 'center', padding: '6px 6px', background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{row.pts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: '#4A90D9',             label: 'Classificado' },
          { color: '#fbbf24',             label: 'Depende dos 3ºs' },
          { color: 'rgba(255,255,255,0.2)', label: 'Eliminado' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Accordion ──────────────────────────────────────────── */

interface AccCol { border: string; bg: string; line: string; chevron: string }

function Accordion({ isOpen, onToggle, dayNum, label, labelShort, sentCount, pendingCount, col, children }: {
  isOpen: boolean; onToggle: () => void; dayNum: number; label: string; labelShort: string;
  sentCount: number; pendingCount: number; col: AccCol; children: React.ReactNode
}) {
  const hasPending = pendingCount > 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 10, background: col.bg, border: `1px solid ${col.border}`, borderRadius: 8, padding: '9px 14px', cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Dia {dayNum}</span>
        <span className="day-date-full" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="day-date-short" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', display: 'none' }}>{labelShort}</span>
        <div style={{ flex: 1, height: 1, background: col.line }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>✓ {sentCount} {sentCount === 1 ? 'enviado' : 'enviados'}</span>
        {hasPending && <span style={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>⏳ {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}</span>}
        <span style={{ fontSize: 11, color: col.chevron, transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>▼</span>
      </div>
      {isOpen && <div style={{ paddingTop: 8 }}>{children}</div>}
    </div>
  )
}

/* ─── MatchCard ──────────────────────────────────────────── */

interface MatchCardProps {
  jogo: JogoCopa; state: MatchState
  onScoreChange: (side: 'A' | 'B', val: number) => void
  onSubmit: () => void; onEdit: () => void
}

function MatchCard({ jogo, state, onScoreChange, onSubmit, onEdit }: MatchCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const locked   = isLocked(jogo.data, jogo.horario)
  const editable = canEdit(jogo.data, jogo.horario)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const mm = `${jogo.data.slice(8, 10)} ${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(jogo.data.slice(5, 7)) - 1]} · ${jogo.horario.slice(0, 5).replace(':', 'h')} · ${jogo.cidade}`
  const borderColor = locked ? 'rgba(74,144,217,0.15)' : state.submitted ? 'rgba(74,222,128,0.25)' : 'rgba(74,144,217,0.3)'
  const scoreColor  = state.submitted ? '#4ade80' : '#4A90D9'
  const scoreBorder = state.submitted ? '2px solid rgba(74,222,128,0.7)' : '2px solid transparent'

  function ScoreControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button className="sc-btn" onClick={() => onChange(Math.max(0, value - 1))} disabled={locked}
          style={{ width: 24, height: 24, border: '1px solid rgba(74,144,217,0.35)', borderRadius: 5, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0, padding: 0 }}>−</button>
        <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: scoreColor, borderRadius: 6, border: scoreBorder, transition: 'border-color 0.3s, color 0.3s', userSelect: 'none' }}>{value}</div>
        <button className="sc-btn" onClick={() => onChange(value + 1)} disabled={locked}
          style={{ width: 24, height: 24, border: '1px solid rgba(74,144,217,0.35)', borderRadius: 5, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0, padding: 0 }}>+</button>
      </div>
    )
  }

  return (
    <div style={{ background: '#0D1E3D', border: `1px solid ${borderColor}`, borderRadius: 10, padding: '12px 14px', position: 'relative', opacity: locked ? 0.4 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>{mm}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {state.submitted && <span style={{ color: '#4ade80', fontSize: 14, fontWeight: 700 }}>✓</span>}
          {state.submitted && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.25)', fontSize: 13, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⋮</button>
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
                      title="Prazo encerrado — jogo começa em menos de 1 hora">✏️ Editar placar</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
