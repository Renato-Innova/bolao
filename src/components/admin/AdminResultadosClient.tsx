'use client'

import React, { useState, useRef } from 'react'
import { FlagImg } from '@/components/ui/FlagImg'
import { createClient } from '@/lib/supabase/client'
import { FASES, TEAMS } from '@/utils/constants'
import type { JogoCopa } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

const MESES     = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const WEEKDAYS  = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']

const KO_PHASES = [
  { code: 'R32', label: '16 Avos de Final',   hint: 'A partir da classificação da Fase de Grupos' },
  { code: 'R16', label: 'Oitavas de Final',     hint: 'A partir dos resultados das 16 Avos de Final' },
  { code: 'QF',  label: 'Quartas de Final',     hint: 'A partir dos resultados das Oitavas de Final' },
  { code: 'SF',  label: 'Semifinal',            hint: 'A partir dos resultados das Quartas de Final' },
  { code: 'TPL', label: 'Decisão do 3º Lugar',  hint: 'A partir dos perdedores da Semifinal' },
  { code: 'F',   label: 'Final',                hint: 'A partir dos vencedores da Semifinal' },
] as const

const ALL_TEAM_NAMES = Object.keys(TEAMS).sort()

// A game slot is still a placeholder when the admin hasn't filled official teams yet
function isPlaceholderTeam(name: string): boolean {
  return name.startsWith('Vencedor') || name.startsWith('Perdedor') ||
    /^\d+º Grupo/.test(name) || name.startsWith('Melhor 3º')
}

const FASE_LABEL: Record<string, string> = {
  GS: 'Fase de Grupos', R32: 'Seg. de Final', R16: 'Oitavas', QF: 'Quartas', SF: 'Semifinal', TPL: '3º Lugar', F: 'Final',
}

function fmtDay(date: string) {
  const d = new Date(date + 'T12:00:00-03:00')
  return `${d.getDate()} ${MESES[d.getMonth()]} · ${WEEKDAYS[d.getDay()]}`
}

function fmtTime(horario: string) { return horario.slice(0, 5).replace(':', 'h') }


// Group games by date, preserving chronological order
function groupByDay(games: JogoCopa[]): { date: string; label: string; games: JogoCopa[] }[] {
  const map: Record<string, JogoCopa[]> = {}
  for (const g of games) {
    if (!map[g.data]) map[g.data] = []
    map[g.data].push(g)
  }
  return Object.keys(map).sort().map(date => ({
    date,
    label: fmtDay(date),
    games: map[date].sort((a, b) => a.horario.localeCompare(b.horario)),
  }))
}

// ── PreencherModal ────────────────────────────────────────────────────────────

interface FillResult {
  updated: number
  games: Array<{ jogoId: number; timeA: string; timeB: string; codigoA: string | null; codigoB: string | null; changed: boolean }>
}

function PreencherModal({ onClose, onDone, filledPhases }: {
  onClose: () => void
  onDone: (fase: string, result: FillResult) => void
  filledPhases: Set<string>
}) {
  const [selectedFase, setSelectedFase] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FillResult | null>(null)

  async function confirmar() {
    if (!selectedFase) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/advance-bracket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: selectedFase }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao preencher.'); setLoading(false); return }
      setResult(data as FillResult)
      onDone(selectedFase, data as FillResult)
    } catch { setError('Erro de rede. Tente novamente.') }
    setLoading(false)
  }

  const phaseLabel = KO_PHASES.find(p => p.code === selectedFase)?.label

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.35)', borderRadius: 12, padding: '28px 32px', maxWidth: 480, width: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 4 }}>Preencher Mata-Mata Oficial</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.5 }}>
          Selecione a fase para preencher automaticamente com as regras FIFA.
        </div>
        {!result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {KO_PHASES.map(phase => {
              const isFilled = filledPhases.has(phase.code)
              const isSelected = selectedFase === phase.code
              return (
                <div key={phase.code} onClick={() => setSelectedFase(phase.code)}
                  style={{ padding: '12px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${isSelected ? 'rgba(74,144,217,0.6)' : isFilled ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)'}`, background: isSelected ? 'rgba(74,144,217,0.12)' : isFilled ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.03)', transition: 'all 0.15s' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#7BB8F0' : isFilled ? '#4ade80' : 'rgba(255,255,255,0.8)' }}>{phase.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{phase.hint}</div>
                  </div>
                  {isFilled && <span style={{ fontSize: 16, color: '#4ade80', flexShrink: 0 }}>✓</span>}
                </div>
              )
            })}
          </div>
        )}
        {result && (
          <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>✓ {phaseLabel} preenchida</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{result.updated} {result.updated === 1 ? 'jogo atualizado' : 'jogos atualizados'}</div>
            {result.games.filter(g => g.changed).slice(0, 6).map(g => (
              <div key={g.jogoId} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>· {g.timeA} × {g.timeB}</div>
            ))}
            {result.updated > 6 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>... e mais {result.updated - 6}</div>}
          </div>
        )}
        {error && <div style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'rgba(255,130,130,0.9)', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', padding: '9px 20px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button onClick={confirmar} disabled={!selectedFase || loading}
              style={{ background: selectedFase && !loading ? 'linear-gradient(90deg,#4A90D9,#1a5ca8)' : 'rgba(74,144,217,0.3)', color: 'white', border: 'none', padding: '9px 22px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: selectedFase && !loading ? 'pointer' : 'not-allowed', fontFamily: 'Inter,sans-serif' }}>
              {loading ? 'Preenchendo...' : 'Preencher'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── GameRow ───────────────────────────────────────────────────────────────────

interface GameRowProps {
  jogo: JogoCopa
  isKO: boolean
  onSaved: (jogoId: number, placarA: number, placarB: number, penaltiA: number | null, penaltiB: number | null) => void
}

function GameRow({ jogo, isKO, onSaved }: GameRowProps) {
  const supabase = createClient()  // used only for team editing (jogos_copa write via RLS)

  const hasSent = !!jogo.resultado

  // Track the saved score locally so it updates immediately after saving
  const [savedA,   setSavedA]   = useState(jogo.resultado?.placar_real_a ?? null)
  const [savedB,   setSavedB]   = useState(jogo.resultado?.placar_real_b ?? null)
  const [savedPenA, setSavedPenA] = useState(jogo.resultado?.placar_penalti_a ?? null)
  const [savedPenB, setSavedPenB] = useState(jogo.resultado?.placar_penalti_b ?? null)
  const isSent = hasSent || (savedA !== null && savedB !== null)

  const [editing,  setEditing]  = useState(!hasSent)
  const [placarA,   setPlacarA]   = useState(jogo.resultado?.placar_real_a?.toString() ?? '')
  const [placarB,   setPlacarB]   = useState(jogo.resultado?.placar_real_b?.toString() ?? '')
  const [penaltiA,  setPenaltiA]  = useState(jogo.resultado?.placar_penalti_a?.toString() ?? '')
  const [penaltiB,  setPenaltiB]  = useState(jogo.resultado?.placar_penalti_b?.toString() ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState('')

  // Show penalty inputs for KO games when both scores are entered and equal
  const isDraw = isKO && placarA !== '' && placarB !== '' && parseInt(placarA) === parseInt(placarB)

  // Block saving a KO draw without a valid penalty result (must have a winner)
  const penaltiBlocked = isDraw && (
    penaltiA === '' || penaltiB === '' ||
    isNaN(parseInt(penaltiA)) || isNaN(parseInt(penaltiB)) ||
    parseInt(penaltiA) === parseInt(penaltiB)  // penalties must decide a winner
  )
  const canSave = !penaltiBlocked
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Team editing (KO only)
  const [editTimes,   setEditTimes]   = useState(false)
  const [editTimeA,   setEditTimeA]   = useState(jogo.time_a)
  const [editTimeB,   setEditTimeB]   = useState(jogo.time_b)
  const [editCodigoA, setEditCodigoA] = useState(jogo.codigo_pais_a ?? '')
  const [editCodigoB, setEditCodigoB] = useState(jogo.codigo_pais_b ?? '')
  const [savingTimes, setSavingTimes] = useState(false)
  const [localTimeA,   setLocalTimeA]   = useState(jogo.time_a)
  const [localTimeB,   setLocalTimeB]   = useState(jogo.time_b)
  const [localCodigoA, setLocalCodigoA] = useState(jogo.codigo_pais_a ?? '')
  const [localCodigoB, setLocalCodigoB] = useState(jogo.codigo_pais_b ?? '')

  // Block score entry while team names are still placeholders
  const teamsUnknown = isKO && (isPlaceholderTeam(localTimeA) || isPlaceholderTeam(localTimeB))

  // Sync display state when the parent updates jogo (e.g. after auto-fill)
  React.useEffect(() => {
    setLocalTimeA(jogo.time_a)
    setLocalTimeB(jogo.time_b)
    setLocalCodigoA(jogo.codigo_pais_a ?? '')
    setLocalCodigoB(jogo.codigo_pais_b ?? '')
    setEditTimeA(jogo.time_a)
    setEditTimeB(jogo.time_b)
    setEditCodigoA(jogo.codigo_pais_a ?? '')
    setEditCodigoB(jogo.codigo_pais_b ?? '')
  }, [jogo.time_a, jogo.time_b, jogo.codigo_pais_a, jogo.codigo_pais_b])

  // Close menu on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function salvar() {
    const a = parseInt(placarA); const b = parseInt(placarB)
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return
    setSaving(true); setSaveError('')

    const penA = isDraw && penaltiA !== '' ? parseInt(penaltiA) : null
    const penB = isDraw && penaltiB !== '' ? parseInt(penaltiB) : null

    const res = await fetch('/api/admin/resultado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogoId: jogo.id, placarA: a, placarB: b, penaltiA: penA, penaltiB: penB }),
    })

    if (res.ok) {
      setSavedA(a); setSavedB(b); setSavedPenA(penA); setSavedPenB(penB)
      setEditing(false)
      onSaved(jogo.id, a, b, penA, penB)
    } else {
      const data = await res.json().catch(() => ({}))
      setSaveError(data.error ?? 'Erro ao salvar. Tente novamente.')
    }
    setSaving(false)
  }

  async function salvarTimes() {
    setSavingTimes(true)
    const codigoA = editCodigoA || TEAMS[editTimeA]?.codigo || null
    const codigoB = editCodigoB || TEAMS[editTimeB]?.codigo || null
    const { error } = await supabase
      .from('jogos_copa')
      .update({ time_a: editTimeA, time_b: editTimeB, codigo_pais_a: codigoA, codigo_pais_b: codigoB })
      .eq('id', jogo.id)
    if (!error) {
      setLocalTimeA(editTimeA); setLocalTimeB(editTimeB)
      setLocalCodigoA(codigoA ?? ''); setLocalCodigoB(codigoB ?? '')
    }
    setEditTimes(false); setSavingTimes(false)
  }

  function startEdit() {
    setPlacarA((savedA ?? 0).toString())
    setPlacarB((savedB ?? 0).toString())
    setPenaltiA(savedPenA?.toString() ?? '')
    setPenaltiB(savedPenB?.toString() ?? '')
    setEditing(true)
    setMenuOpen(false)
  }

  return (
    <div style={{
      background: isSent ? 'rgba(74,222,128,0.04)' : 'transparent',
      border: isSent ? '1px solid rgba(74,222,128,0.15)' : '1px solid transparent',
      borderRadius: isSent ? 8 : 0,
      margin: isSent ? '6px 10px' : 0,
      borderBottom: isSent ? undefined : '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>

        {/* Centro: meta + times + inputs em linha única */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {/* Meta: horário · fase · grupo */}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', whiteSpace: 'nowrap' }}>
            {fmtTime(jogo.horario)} · {FASE_LABEL[jogo.fase] ?? jogo.fase}{jogo.grupo ? ` · Gr.${jogo.grupo}` : ''}
            {isKO && <span style={{ color: 'rgba(255,200,80,0.6)', marginLeft: 6, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>inclui prorrogação</span>}
          </div>

          {/* Times + inputs */}
          {teamsUnknown ? (
            <div style={{ fontSize: 10, color: 'rgba(255,200,80,0.6)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              🔒 <span>Preencha os times primeiro</span>
            </div>
          ) : isSent && !editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {localCodigoA && <FlagImg codigo={localCodigoA} />}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{localTimeA}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, padding: '4px 12px' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: '#4ade80', minWidth: 14, textAlign: 'center' }}>{savedA}</span>
                  <span style={{ fontSize: 11, color: 'rgba(74,222,128,0.4)', fontWeight: 300 }}>–</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: '#4ade80', minWidth: 14, textAlign: 'center' }}>{savedB}</span>
                </div>
                {savedPenA != null && savedPenB != null && (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3 }}>pen {savedPenA}–{savedPenB}</span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{localTimeB}</span>
              {localCodigoB && <FlagImg codigo={localCodigoB} />}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              {/* Score inputs row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {localCodigoA && <FlagImg codigo={localCodigoA} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{localTimeA}</span>
                <input type="number" min={0} value={placarA} onChange={e => setPlacarA(e.target.value)}
                  style={{ width: 38, height: 32, textAlign: 'center', borderRadius: 6, background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.4)', color: '#4A90D9', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>×</span>
                <input type="number" min={0} value={placarB} onChange={e => setPlacarB(e.target.value)}
                  style={{ width: 38, height: 32, textAlign: 'center', borderRadius: 6, background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.4)', color: '#4A90D9', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{localTimeB}</span>
                {localCodigoB && <FlagImg codigo={localCodigoB} />}
              </div>
              {/* Penalty row */}
              {isDraw && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,200,80,0.8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Pênaltis</span>
                    <input type="number" min={0} value={penaltiA} onChange={e => setPenaltiA(e.target.value)}
                      style={{ width: 38, height: 28, textAlign: 'center', borderRadius: 5, background: 'rgba(255,200,80,0.08)', border: `1px solid ${penaltiBlocked ? 'rgba(255,80,80,0.5)' : 'rgba(255,200,80,0.35)'}`, color: '#ffc850', fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                    <span style={{ color: 'rgba(255,200,80,0.4)', fontSize: 11 }}>×</span>
                    <input type="number" min={0} value={penaltiB} onChange={e => setPenaltiB(e.target.value)}
                      style={{ width: 38, height: 28, textAlign: 'center', borderRadius: 5, background: 'rgba(255,200,80,0.08)', border: `1px solid ${penaltiBlocked ? 'rgba(255,80,80,0.5)' : 'rgba(255,200,80,0.35)'}`, color: '#ffc850', fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                  </div>
                  {penaltiBlocked && (
                    <span style={{ fontSize: 9, color: 'rgba(255,120,120,0.9)', fontWeight: 600 }}>⚠️ Preencha os pênaltis</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Direita: botão salvar / checkmark + menu */}
        {!teamsUnknown && (
          isSent && !editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ color: '#4ade80', fontSize: 16, fontWeight: 700 }}>✓</span>
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(o => !o)}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.55)', fontSize: 14, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>⋮</button>
                {menuOpen && (
                  <div style={{ position: 'absolute', top: 30, right: 0, background: '#1a2d50', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 8, padding: 4, minWidth: 160, zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                    <div onClick={startEdit}
                      style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,144,217,0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      ✏️ Editar resultado
                    </div>
                    {isKO && (
                      <div onClick={() => { setEditTimes(v => !v); setMenuOpen(false) }}
                        style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(240,192,64,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        🏳️ Editar times
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={salvar} disabled={saving || !canSave}
                style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: (saving || !canSave) ? 'not-allowed' : 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', background: canSave ? 'linear-gradient(90deg,#4A90D9,#1a5ca8)' : 'rgba(255,255,255,0.12)', color: canSave ? 'white' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', opacity: saving ? 0.7 : 1, transition: 'filter 0.15s, opacity 0.15s' }}
                onMouseEnter={e => { if (canSave && !saving) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none' }}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
              {isSent && (
                <button onClick={() => setEditing(false)}
                  style={{ padding: '6px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter,sans-serif' }}>×</button>
              )}
              {isKO && (
                <button onClick={() => setEditTimes(v => !v)}
                  style={{ padding: '6px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${editTimes ? 'rgba(240,192,64,0.4)' : 'rgba(255,255,255,0.1)'}`, background: editTimes ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.05)', color: editTimes ? '#f0c040' : 'rgba(255,255,255,0.4)', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>
                  ✏️
                </button>
              )}
            </div>
          )
        )}
      </div>

      {/* Save error */}
      {saveError && (
        <div style={{ margin: '0 14px 10px', padding: '7px 12px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 6, fontSize: 11, color: 'rgba(255,130,130,0.9)' }}>
          ⚠️ {saveError}
        </div>
      )}

      {/* Team edit panel */}
      {editTimes && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', background: 'rgba(240,192,64,0.04)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(240,192,64,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Editar times</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Time A', name: editTimeA, setName: setEditTimeA, codigo: editCodigoA, setCodigo: setEditCodigoA },
              { label: 'Time B', name: editTimeB, setName: setEditTimeB, codigo: editCodigoB, setCodigo: setEditCodigoB },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.label}</label>
                <select value={t.name} onChange={e => { t.setName(e.target.value); t.setCodigo(TEAMS[e.target.value]?.codigo ?? '') }}
                  style={{ background: '#0a1630', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }}>
                  <option value="">— selecionar —</option>
                  {ALL_TEAM_NAMES.map(n => <option key={n} value={n} style={{ background: '#0a1630' }}>{n}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 5 }}>
                  <input placeholder="Nome" value={t.name} onChange={e => t.setName(e.target.value)}
                    style={{ flex: 2, background: '#0a1630', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                  <input placeholder="Código" value={t.codigo} onChange={e => t.setCodigo(e.target.value)}
                    style={{ flex: 1, background: '#0a1630', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditTimes(false)}
              style={{ padding: '6px 16px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter,sans-serif' }}>Cancelar</button>
            <button onClick={salvarTimes} disabled={savingTimes}
              style={{ padding: '6px 18px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', background: 'rgba(240,192,64,0.2)', color: '#f0c040' }}>
              {savingTimes ? 'Salvando...' : 'Salvar times'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DayDivider ────────────────────────────────────────────────────────────────

function DayDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

// ── Accordion ─────────────────────────────────────────────────────────────────

function Accordion({ title, count, color, isOpen, onToggle, children }: {
  title: string; count: number; color: string; isOpen: boolean
  onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ background: '#0D1E3D', border: `1px solid ${isOpen ? 'rgba(74,144,217,0.25)' : 'rgba(74,144,217,0.12)'}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', userSelect: 'none' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'white', flex: 1, letterSpacing: 0.3 }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `${color}18`, color, whiteSpace: 'nowrap' }}>
          {count} {count === 1 ? 'jogo' : 'jogos'}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', transition: 'transform 0.22s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </div>
      {isOpen && <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>{children}</div>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminResultadosClient({ jogos }: { jogos: JogoCopa[] }) {
  // Sort all games chronologically once
  const sorted = [...jogos].sort((a, b) =>
    a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario)
  )

  const [jogosList, setJogosList] = useState<JogoCopa[]>(sorted)
  const [pendentesOpen, setPendentesOpen] = useState(true)
  const [enviadosOpen,  setEnviadosOpen]  = useState(false)
  const [showPreencherModal, setShowPreencherModal] = useState(false)

  // Derived lists — reactive to jogosList changes
  const pendentes = jogosList.filter(j => !j.resultado)
  const enviados  = jogosList.filter(j => !!j.resultado)

  // Which KO phases are fully filled (no placeholder team names remaining)
  const filledPhases = new Set<string>(
    KO_PHASES
      .filter(phase => {
        const phaseGames = jogosList.filter(j => j.fase === phase.code)
        return phaseGames.length > 0 &&
          phaseGames.every(j => !isPlaceholderTeam(j.time_a) && !isPlaceholderTeam(j.time_b))
      })
      .map(p => p.code)
  )

  // When a result is saved, move the game to enviados
  function handleSaved(jogoId: number, placarA: number, placarB: number, penaltiA: number | null, penaltiB: number | null) {
    setJogosList(prev => prev.map(j =>
      j.id === jogoId
        ? { ...j, resultado: { id: 0, jogo_id: jogoId, placar_real_a: placarA, placar_real_b: placarB, placar_penalti_a: penaltiA, placar_penalti_b: penaltiB, inserido_em: '', atualizado_em: '' } }
        : j
    ))
  }

  function onFillDone(fase: string, result: FillResult) {
    setJogosList(prev => prev.map(j => {
      const u = result.games.find(g => g.jogoId === j.id)
      if (!u || !u.changed) return j
      return {
        ...j,
        time_a: u.timeA, time_b: u.timeB,
        codigo_pais_a: u.codigoA ?? j.codigo_pais_a,
        codigo_pais_b: u.codigoB ?? j.codigo_pais_b,
      }
    }))
  }

  const pendenteDays = groupByDay(pendentes)
  const enviadoDays  = groupByDay(enviados)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg,#04143a,#091d50,#0a1f4e)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Admin</span>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: 'white', letterSpacing: 1 }}>Inserir Resultados</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
            {pendentes.length} pendentes · {enviados.length} enviados
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setShowPreencherModal(true)}
            style={{ fontSize: 11, color: '#f0c040', background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.3)', borderRadius: 7, padding: '7px 14px', fontFamily: 'Inter,sans-serif', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ⚡ Preencher Mata-Mata
          </button>
          <a href="/admin/configuracoes" style={{ fontSize: 11, color: '#4A90D9', background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 7, padding: '7px 14px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Configurações →
          </a>
        </div>
      </div>

      {/* PENDENTES accordion */}
      <Accordion
        title="Pendentes"
        count={pendentes.length}
        color="#f97316"
        isOpen={pendentesOpen}
        onToggle={() => setPendentesOpen(o => !o)}>
        {pendentes.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            ✅ Todos os resultados foram inseridos!
          </div>
        ) : (
          pendenteDays.map(day => (
            <React.Fragment key={day.date}>
              <DayDivider label={day.label} />
              {day.games.map(jogo => (
                <GameRow key={jogo.id} jogo={jogo} isKO={jogo.fase !== 'GS'} onSaved={handleSaved} />
              ))}
            </React.Fragment>
          ))
        )}
      </Accordion>

      {/* ENVIADOS accordion */}
      <Accordion
        title="Enviados"
        count={enviados.length}
        color="#4ade80"
        isOpen={enviadosOpen}
        onToggle={() => setEnviadosOpen(o => !o)}>
        {enviados.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Nenhum resultado inserido ainda.
          </div>
        ) : (
          enviadoDays.map(day => (
            <React.Fragment key={day.date}>
              <DayDivider label={day.label} />
              {day.games.map(jogo => (
                <GameRow key={jogo.id} jogo={jogo} isKO={jogo.fase !== 'GS'} onSaved={handleSaved} />
              ))}
            </React.Fragment>
          ))
        )}
      </Accordion>

      {/* Fill modal */}
      {showPreencherModal && (
        <PreencherModal
          onClose={() => setShowPreencherModal(false)}
          onDone={(fase, result) => { onFillDone(fase, result) }}
          filledPhases={filledPhases}
        />
      )}
    </div>
  )
}
