'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FASES, ALL_TEAMS, ARTILHEIRO_OPTIONS, GOLEIRO_OPTIONS } from '@/utils/constants'
import { SPECIAL_POINTS } from '@/utils/scoring'
import type { ConfiguracaoPontuacao, Palpite, User, ResultadoEspecial } from '@/types'

// Human-readable labels for each scoring type
const TIPO_LABEL: Record<string, string> = {
  placar_exato: 'Placar exato',
  empate:       'Empate (placar diferente)',
  vencedor:     'Vencedor (placar diferente)',
  gols_equipe:  'Gols de uma equipe (cumulativo)',
  penalti:      'Classificado nos pênaltis (cumulativo)',
}

// Display order for scoring types within each phase card
const TIPO_ORDER = ['placar_exato', 'empate', 'vencedor', 'gols_equipe', 'penalti']

interface Props {
  configs:         ConfiguracaoPontuacao[]
  usuarios:        User[]
  palpites:        (Palpite & { usuario?: { nome: string; email: string } })[]
  especiais:       ResultadoEspecial | null
}

type Aba = 'pontuacao' | 'especiais' | 'palpites' | 'usuarios'

export function AdminConfigClient({ configs, usuarios, palpites, especiais }: Props) {
  const supabase = createClient()

  // ── Scoring config state ──────────────────────────────────────────────────
  const [configsState, setConfigsState] = useState(configs)
  const [saving, setSaving]             = useState<number | null>(null)

  // ── Palpites state ────────────────────────────────────────────────────────
  const [palpitesState, setPalpitesState] = useState(palpites)

  // ── Special results state ─────────────────────────────────────────────────
  const [especiaisState, setEspeciaisState] = useState<Partial<ResultadoEspecial>>(especiais ?? {})
  const [especialSaving, setEspecialSaving] = useState(false)
  const [especialMsg,    setEspecialMsg]    = useState('')

  // ── Classification bonus state ────────────────────────────────────────────
  const [classifSaving, setClassifSaving] = useState(false)
  const [classifMsg,    setClassifMsg]    = useState('')

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [aba, setAba] = useState<Aba>('pontuacao')

  const abas: { key: Aba; label: string }[] = [
    { key: 'pontuacao', label: 'Pontuação' },
    { key: 'especiais', label: 'Palpites Especiais' },
    { key: 'palpites',  label: `Palpites (${palpites.length})` },
    { key: 'usuarios',  label: `Usuários (${usuarios.length})` },
  ]

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function salvarConfig(id: number, pontos: number) {
    setSaving(id)
    await supabase.from('configuracoes_pontuacao').update({ pontos }).eq('id', id)
    setConfigsState(prev => prev.map(c => c.id === id ? { ...c, pontos } : c))
    setSaving(null)
  }

  async function toggleStatus(palpiteId: number, novoStatus: 'ativo' | 'inativo') {
    await supabase.from('palpites').update({ status: novoStatus }).eq('id', palpiteId)
    setPalpitesState(prev => prev.map(p => p.id === palpiteId ? { ...p, status: novoStatus } : p))
  }

  async function calcularClassificacao() {
    setClassifSaving(true)
    setClassifMsg('')
    try {
      const res = await fetch('/api/admin/classificacao', { method: 'POST' })
      const { ok, updatedCount, oficiais, error } = await res.json()
      if (ok) setClassifMsg(`✅ ${updatedCount} palpites atualizados · ${oficiais?.length ?? 0} seleções classificadas.`)
      else    setClassifMsg(`❌ ${error}`)
    } catch {
      setClassifMsg('❌ Erro de rede.')
    } finally {
      setClassifSaving(false)
    }
  }

  async function salvarEspeciais() {
    setEspecialSaving(true)
    setEspecialMsg('')
    try {
      const res = await fetch('/api/admin/especiais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(especiaisState),
      })
      const { ok, updatedCount, error } = await res.json()
      if (ok) setEspecialMsg(`✅ Salvo! Pontos recalculados para ${updatedCount} palpites.`)
      else    setEspecialMsg(`❌ Erro: ${error}`)
    } catch {
      setEspecialMsg('❌ Erro de rede.')
    } finally {
      setEspecialSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg,#04143a,#091d50,#0a1f4e)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Admin</span>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: 'white', letterSpacing: 1 }}>Configurações</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Pontuação, palpites especiais, ativação de palpites</div>
        </div>
        <a href="/admin/resultados" style={{ fontSize: 11, color: '#4A90D9', background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 7, padding: '7px 14px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
          ← Resultados
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {abas.map(tab => (
          <button key={tab.key} onClick={() => setAba(tab.key)} style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter,sans-serif', border: 'none', transition: 'all 0.15s',
            background: aba === tab.key ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.05)',
            color:      aba === tab.key ? '#4A90D9' : 'rgba(255,255,255,0.5)',
            outline:    aba === tab.key ? '1px solid rgba(74,144,217,0.35)' : '1px solid transparent',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Pontuação ── */}
      {aba === 'pontuacao' && (
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14, lineHeight: 1.6 }}>
            Valores por fase conforme o Regulamento v1.0. Os critérios <strong style={{ color: 'rgba(255,255,255,0.6)' }}>gols_equipe</strong> e <strong style={{ color: 'rgba(255,255,255,0.6)' }}>pênaltis</strong> são <em>cumulativos</em> — somam-se ao vencedor/empate.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.keys(FASES).map(fase => {
              const faseConfigs = TIPO_ORDER
                .map(tipo => configsState.find(c => c.fase === fase && c.tipo_acerto === tipo))
                .filter(Boolean) as ConfiguracaoPontuacao[]
              return (
                <div key={fase} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                    {FASES[fase as keyof typeof FASES]}
                  </div>
                  {faseConfigs.length === 0 && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Execute o SQL 15_scoring_overhaul.sql para criar as configs.</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {faseConfigs.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', flex: 1 }}>
                          {TIPO_LABEL[c.tipo_acerto] ?? c.tipo_acerto}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="number" min={0} value={c.pontos}
                            onChange={e => setConfigsState(prev => prev.map(cfg => cfg.id === c.id ? { ...cfg, pontos: parseInt(e.target.value) || 0 } : cfg))}
                            style={{ width: 60, height: 32, textAlign: 'center', borderRadius: 6, background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.3)', color: '#4A90D9', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>pts</span>
                          <button onClick={() => salvarConfig(c.id, c.pontos)} disabled={saving === c.id}
                            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white' }}>
                            {saving === c.id ? '...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Palpites Especiais — Official Results ── */}
      {aba === 'especiais' && (
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16, lineHeight: 1.6 }}>
            Insira os resultados oficiais dos palpites especiais. Ao salvar, os pontos serão recalculados automaticamente para todos os palpites.
          </div>

          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            {([
              { key: 'campeao'       as const, emoji: '🏆', label: 'Campeão',        pts: SPECIAL_POINTS.campeao,       options: ALL_TEAMS.map(t => ({ value: t, label: t })) },
              { key: 'vice_campeao'  as const, emoji: '🥈', label: 'Vice-Campeão',   pts: SPECIAL_POINTS.vice_campeao,  options: ALL_TEAMS.map(t => ({ value: t, label: t })) },
              { key: 'artilheiro'    as const, emoji: '⚽', label: 'Artilheiro',     pts: SPECIAL_POINTS.artilheiro,    options: ARTILHEIRO_OPTIONS },
              { key: 'melhor_jogador'as const, emoji: '🌟', label: 'Melhor Jogador', pts: SPECIAL_POINTS.melhor_jogador,options: ARTILHEIRO_OPTIONS },
              { key: 'melhor_goleiro'as const, emoji: '🧤', label: 'Melhor Goleiro', pts: SPECIAL_POINTS.melhor_goleiro, options: GOLEIRO_OPTIONS },
            ]).map((item, idx, arr) => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ flex: '0 0 150px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,200,80,0.7)', fontWeight: 700 }}>{item.pts} pts</div>
                </div>
                <select
                  value={(especiaisState[item.key] as string | null | undefined) ?? ''}
                  onChange={e => setEspeciaisState(prev => ({ ...prev, [item.key]: e.target.value || null }))}
                  style={{ flex: 1, background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '8px 10px', fontSize: 12, fontWeight: 700, color: especiaisState[item.key] ? '#4ade80' : 'rgba(255,255,255,0.35)', fontFamily: 'Inter,sans-serif', outline: 'none', cursor: 'pointer' }}>
                  <option value="">— não definido —</option>
                  {item.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={salvarEspeciais} disabled={especialSaving}
              style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {especialSaving ? 'Salvando...' : 'Salvar e Recalcular'}
            </button>
            {especialMsg && (
              <span style={{ fontSize: 12, color: especialMsg.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>
                {especialMsg}
              </span>
            )}
          </div>

          {/* Group classification bonus */}
          <div style={{ marginTop: 28, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 6 }}>
              🏅 Bônus de Classificação de Grupos
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
              Atribui <strong style={{ color: 'rgba(255,255,255,0.7)' }}>20 pontos</strong> a cada seleção que o participante previu corretamente como classificada para a fase eliminatória
              (top 2 de cada grupo + 8 melhores terceiros colocados).
              <br />
              <span style={{ color: 'rgba(255,200,80,0.7)' }}>⚠️ Execute apenas após todos os resultados da Fase de Grupos estarem confirmados e a tabela de classificação oficial atualizada.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={calcularClassificacao} disabled={classifSaving}
                style={{ background: classifSaving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#4ade80,#16a34a)', color: classifSaving ? 'rgba(255,255,255,0.4)' : 'white', border: 'none', padding: '10px 24px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: classifSaving ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {classifSaving ? 'Calculando...' : 'Calcular Bônus de Grupos'}
              </button>
              {classifMsg && (
                <span style={{ fontSize: 12, color: classifMsg.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>
                  {classifMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Palpites ── */}
      {aba === 'palpites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {palpitesState.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum palpite criado</div>
          )}
          {palpitesState.map(p => (
            <div key={p.id} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {p.usuario?.nome} · {p.usuario?.email}
                </div>
                {/* Special predictions summary */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 4 }}>
                  {p.campeao      && <span style={{ fontSize: 9, color: 'rgba(255,200,80,0.7)' }}>🏆 {p.campeao}</span>}
                  {p.vice_campeao && <span style={{ fontSize: 9, color: 'rgba(255,200,80,0.7)' }}>🥈 {p.vice_campeao}</span>}
                  {p.artilheiro   && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>⚽ {p.artilheiro}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {p.pontos_especiais > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>+{p.pontos_especiais} pts esp.</span>
                )}
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: p.status === 'ativo' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.07)', color: p.status === 'ativo' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                  {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
                <button onClick={() => toggleStatus(p.id, p.status === 'ativo' ? 'inativo' : 'ativo')}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', background: p.status === 'ativo' ? 'rgba(255,255,255,0.07)' : 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: p.status === 'ativo' ? 'rgba(255,255,255,0.5)' : 'white' }}>
                  {p.status === 'ativo' ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Usuários ── */}
      {aba === 'usuarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {usuarios.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum usuário cadastrado</div>
          )}
          {usuarios.map(u => (
            <div key={u.id} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{u.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {u.email}{u.telefone ? ` · ${u.telefone}` : ''}
                </div>
              </div>
              {u.is_admin && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Admin</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
