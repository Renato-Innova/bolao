'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { FASES, TEAMS } from '@/utils/constants'
import type { JogoCopa } from '@/types'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

const KO_PHASES = [
  { code: 'R32', label: 'Segundas de Final',   hint: 'A partir da classificação da Fase de Grupos' },
  { code: 'R16', label: 'Oitavas de Final',     hint: 'A partir dos resultados das Segundas de Final' },
  { code: 'QF',  label: 'Quartas de Final',     hint: 'A partir dos resultados das Oitavas de Final' },
  { code: 'SF',  label: 'Semifinal',            hint: 'A partir dos resultados das Quartas de Final' },
  { code: 'TPL', label: 'Decisão do 3º Lugar',  hint: 'A partir dos perdedores da Semifinal' },
  { code: 'F',   label: 'Final',                hint: 'A partir dos vencedores da Semifinal' },
] as const

const ALL_TEAM_NAMES = Object.keys(TEAMS).sort()

function fmt(data: string, horario: string) {
  const [, mm, dd] = data.split('-')
  return `${dd} ${MESES[parseInt(mm) - 1]} · ${horario.slice(0, 5).replace(':', 'h')}`
}

function Flag({ codigo }: { codigo: string }) {
  return (
    <Image src={`https://flagcdn.com/w40/${codigo}.png`} alt={codigo}
      width={18} height={12} style={{ borderRadius: 1 }} unoptimized draggable={false} />
  )
}

// ── PreencherModal ────────────────────────────────────────────────────────────

interface FillResult {
  updated: number
  games: Array<{ jogoId: number; timeA: string; timeB: string; changed: boolean }>
}

function PreencherModal({ onClose, onDone }: { onClose: () => void; onDone: (fase: string, result: FillResult) => void }) {
  const [selectedFase, setSelectedFase] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FillResult | null>(null)

  async function confirmar() {
    if (!selectedFase) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/advance-bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: selectedFase }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao preencher.'); setLoading(false); return }
      setResult(data as FillResult)
      onDone(selectedFase, data as FillResult)
    } catch (e) {
      setError('Erro de rede. Tente novamente.')
    }
    setLoading(false)
  }

  const phaseLabel = KO_PHASES.find(p => p.code === selectedFase)?.label

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.35)', borderRadius: 12, padding: '28px 32px', maxWidth: 480, width: '100%' }}>

        {/* Title */}
        <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 4 }}>Preencher Mata-Mata Oficial</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 1.5 }}>
          Selecione a fase que deseja preencher automaticamente usando as regras FIFA.
          O admin poderá editar os times depois se necessário.
        </div>

        {/* Phase list */}
        {!result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {KO_PHASES.map(phase => (
              <div key={phase.code} onClick={() => setSelectedFase(phase.code)}
                style={{
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${selectedFase === phase.code ? 'rgba(74,144,217,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  background: selectedFase === phase.code ? 'rgba(74,144,217,0.12)' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: selectedFase === phase.code ? '#7BB8F0' : 'rgba(255,255,255,0.8)' }}>{phase.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{phase.hint}</div>
              </div>
            ))}
          </div>
        )}

        {/* Success summary */}
        {result && (
          <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>
              ✓ {phaseLabel} preenchida com sucesso
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {result.updated} {result.updated === 1 ? 'jogo atualizado' : 'jogos atualizados'}
            </div>
            {result.games.filter(g => g.changed).slice(0, 6).map(g => (
              <div key={g.jogoId} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                · {g.timeA} × {g.timeB}
              </div>
            ))}
            {result.updated > 6 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>... e mais {result.updated - 6}</div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'rgba(255,130,130,0.9)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', padding: '9px 20px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
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

// ── Main component ────────────────────────────────────────────────────────────

export function AdminResultadosClient({ jogos }: { jogos: JogoCopa[] }) {
  const supabase = createClient()
  const [jogosList, setJogosList] = useState<JogoCopa[]>(jogos)
  const [filtroFase, setFiltroFase] = useState<string>('GS')

  // Score editing
  const [editando, setEditando] = useState<number | null>(null)
  const [placarA, setPlacarA] = useState('')
  const [placarB, setPlacarB] = useState('')
  const [saving, setSaving] = useState(false)

  // Team editing (KO games only)
  const [editandoTimes, setEditandoTimes] = useState<number | null>(null)
  const [editTimeA, setEditTimeA] = useState('')
  const [editTimeB, setEditTimeB] = useState('')
  const [editCodigoA, setEditCodigoA] = useState('')
  const [editCodigoB, setEditCodigoB] = useState('')
  const [savingTimes, setSavingTimes] = useState(false)

  // Fill modal
  const [showPreencherModal, setShowPreencherModal] = useState(false)

  // ── Score save ──────────────────────────────────────────────────────────────

  async function salvarResultado(jogo: JogoCopa) {
    const a = parseInt(placarA)
    const b = parseInt(placarB)
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) return

    setSaving(true)
    const { error } = await supabase
      .from('resultados')
      .upsert({ jogo_id: jogo.id, placar_real_a: a, placar_real_b: b }, { onConflict: 'jogo_id' })

    if (!error) {
      const { data: palpitesJogos } = await supabase.from('palpites_jogos').select('*').eq('jogo_id', jogo.id)
      const { data: configs } = await supabase.from('configuracoes_pontuacao').select('*').eq('fase', jogo.fase)
      const pontosExato    = configs?.find((c: { tipo_acerto: string }) => c.tipo_acerto === 'placar_exato')?.pontos ?? 3
      const pontosVencedor = configs?.find((c: { tipo_acerto: string }) => c.tipo_acerto === 'vencedor')?.pontos ?? 1

      for (const pj of palpitesJogos ?? []) {
        if (pj.placar_palpite_a == null || pj.placar_palpite_b == null) continue
        let pontos = 0
        if (pj.placar_palpite_a === a && pj.placar_palpite_b === b) {
          pontos = pontosExato
        } else {
          const vR = a > b ? 'A' : a < b ? 'B' : 'E'
          const vP = pj.placar_palpite_a > pj.placar_palpite_b ? 'A' : pj.placar_palpite_a < pj.placar_palpite_b ? 'B' : 'E'
          if (vR === vP) pontos = pontosVencedor
        }
        await supabase.from('palpites_jogos').update({ pontos }).eq('id', pj.id)
      }

      setJogosList(prev => prev.map(j =>
        j.id === jogo.id
          ? { ...j, resultado: { id: 0, jogo_id: jogo.id, placar_real_a: a, placar_real_b: b, inserido_em: '', atualizado_em: '' } }
          : j
      ))
    }

    setEditando(null)
    setSaving(false)
  }

  function iniciarEdicaoScore(jogo: JogoCopa) {
    setEditandoTimes(null)
    setEditando(jogo.id)
    setPlacarA(jogo.resultado?.placar_real_a?.toString() ?? '')
    setPlacarB(jogo.resultado?.placar_real_b?.toString() ?? '')
  }

  // ── Team save ───────────────────────────────────────────────────────────────

  async function salvarTimes(jogoId: number) {
    setSavingTimes(true)
    const codigoA = editCodigoA || TEAMS[editTimeA]?.codigo || null
    const codigoB = editCodigoB || TEAMS[editTimeB]?.codigo || null

    const { error } = await supabase
      .from('jogos_copa')
      .update({ time_a: editTimeA, time_b: editTimeB, codigo_pais_a: codigoA, codigo_pais_b: codigoB })
      .eq('id', jogoId)

    if (!error) {
      setJogosList(prev => prev.map(j =>
        j.id === jogoId
          ? { ...j, time_a: editTimeA, time_b: editTimeB, codigo_pais_a: codigoA ?? undefined, codigo_pais_b: codigoB ?? undefined }
          : j
      ))
    }

    setEditandoTimes(null)
    setSavingTimes(false)
  }

  function iniciarEdicaoTimes(jogo: JogoCopa) {
    setEditando(null)
    setEditandoTimes(jogo.id)
    setEditTimeA(jogo.time_a)
    setEditTimeB(jogo.time_b)
    setEditCodigoA(jogo.codigo_pais_a ?? '')
    setEditCodigoB(jogo.codigo_pais_b ?? '')
  }

  // ── Fill modal callback ─────────────────────────────────────────────────────

  function onFillDone(fase: string, result: FillResult) {
    // Refresh the affected games in local state
    setJogosList(prev => prev.map(j => {
      const updated = result.games.find(g => g.jogoId === j.id)
      if (!updated || !updated.changed) return j
      return { ...j, time_a: updated.timeA, time_b: updated.timeB }
    }))
    // Switch view to the filled phase
    setFiltroFase(fase)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const jogosFiltrados = jogosList.filter(j => j.fase === filtroFase)
  const isKoFase = filtroFase !== 'GS'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg,#04143a,#091d50,#0a1f4e)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Admin</span>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: 'white', letterSpacing: 1 }}>Inserir Resultados</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Insira o placar de cada jogo. Os pontos são calculados automaticamente.</div>
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

      {/* Phase filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(FASES).map(([key, label]) => (
          <button key={key} onClick={() => setFiltroFase(key)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter,sans-serif', border: 'none', transition: 'all 0.15s',
            background: filtroFase === key ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.06)',
            color: filtroFase === key ? '#4A90D9' : 'rgba(255,255,255,0.5)',
            outline: filtroFase === key ? '1px solid rgba(74,144,217,0.4)' : '1px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* Games list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {jogosFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum jogo nesta fase</div>
        )}
        {jogosFiltrados.map(jogo => (
          <div key={jogo.id} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, overflow: 'hidden' }}>

            {/* Main row */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>

              {/* Teams */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                {jogo.codigo_pais_a && <Flag codigo={jogo.codigo_pais_a} />}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{jogo.time_a}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 2px' }}>×</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{jogo.time_b}</span>
                {jogo.codigo_pais_b && <Flag codigo={jogo.codigo_pais_b} />}
              </div>

              {/* Date */}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {fmt(jogo.data, jogo.horario)} · {jogo.cidade}
              </div>

              {/* Score edit / display */}
              {editando === jogo.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <input type="number" min={0} value={placarA} onChange={e => setPlacarA(e.target.value)}
                    style={{ width: 40, height: 32, textAlign: 'center', borderRadius: 6, background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.4)', color: '#4A90D9', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>×</span>
                  <input type="number" min={0} value={placarB} onChange={e => setPlacarB(e.target.value)}
                    style={{ width: 40, height: 32, textAlign: 'center', borderRadius: 6, background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.4)', color: '#4A90D9', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                  <button onClick={() => salvarResultado(jogo)} disabled={saving}
                    style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white' }}>
                    {saving ? '...' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditando(null)}
                    style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter,sans-serif' }}>×</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {jogo.resultado ? (
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#4A90D9', minWidth: 50, textAlign: 'center' }}>
                      {jogo.resultado.placar_real_a} × {jogo.resultado.placar_real_b}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', minWidth: 50, textAlign: 'center' }}>—</span>
                  )}
                  <button onClick={() => iniciarEdicaoScore(jogo)}
                    style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(74,144,217,0.25)', background: 'rgba(74,144,217,0.08)', color: '#7BB8F0', fontFamily: 'Inter,sans-serif' }}>
                    {jogo.resultado ? 'Editar' : 'Inserir'}
                  </button>
                  {/* Team edit button — KO phases only */}
                  {isKoFase && (
                    <button onClick={() => editandoTimes === jogo.id ? setEditandoTimes(null) : iniciarEdicaoTimes(jogo)}
                      style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${editandoTimes === jogo.id ? 'rgba(240,192,64,0.4)' : 'rgba(255,255,255,0.1)'}`, background: editandoTimes === jogo.id ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.05)', color: editandoTimes === jogo.id ? '#f0c040' : 'rgba(255,255,255,0.4)', fontFamily: 'Inter,sans-serif' }}>
                      ✏️ Times
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Team edit panel — expands below the main row */}
            {editandoTimes === jogo.id && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: 'rgba(240,192,64,0.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(240,192,64,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Editar times
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Team A */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Time A</label>
                    <select value={editTimeA} onChange={e => { setEditTimeA(e.target.value); setEditCodigoA(TEAMS[e.target.value]?.codigo ?? '') }}
                      style={{ background: '#0a1630', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }}>
                      <option value="">— selecionar —</option>
                      {ALL_TEAM_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input placeholder="Nome" value={editTimeA} onChange={e => setEditTimeA(e.target.value)}
                        style={{ flex: 2, background: '#0a1630', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                      <input placeholder="Código" value={editCodigoA} onChange={e => setEditCodigoA(e.target.value)}
                        style={{ flex: 1, background: '#0a1630', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                    </div>
                  </div>
                  {/* Team B */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Time B</label>
                    <select value={editTimeB} onChange={e => { setEditTimeB(e.target.value); setEditCodigoB(TEAMS[e.target.value]?.codigo ?? '') }}
                      style={{ background: '#0a1630', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }}>
                      <option value="">— selecionar —</option>
                      {ALL_TEAM_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input placeholder="Nome" value={editTimeB} onChange={e => setEditTimeB(e.target.value)}
                        style={{ flex: 2, background: '#0a1630', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                      <input placeholder="Código" value={editCodigoB} onChange={e => setEditCodigoB(e.target.value)}
                        style={{ flex: 1, background: '#0a1630', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditandoTimes(null)}
                    style={{ padding: '6px 16px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter,sans-serif' }}>Cancelar</button>
                  <button onClick={() => salvarTimes(jogo.id)} disabled={savingTimes || !editTimeA || !editTimeB}
                    style={{ padding: '6px 18px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', background: savingTimes ? 'rgba(240,192,64,0.3)' : 'rgba(240,192,64,0.2)', color: '#f0c040' }}>
                    {savingTimes ? 'Salvando...' : 'Salvar times'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fill modal */}
      {showPreencherModal && (
        <PreencherModal onClose={() => setShowPreencherModal(false)} onDone={(fase, result) => { onFillDone(fase, result) }} />
      )}
    </div>
  )
}
