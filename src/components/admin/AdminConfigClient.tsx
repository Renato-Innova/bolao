'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FASES, ALL_TEAMS, ARTILHEIRO_OPTIONS, GOLEIRO_OPTIONS } from '@/utils/constants'
import { SPECIAL_POINTS } from '@/utils/scoring'
import type { ConfiguracaoPontuacao, Palpite, User, ResultadoEspecial, ActivityLog } from '@/types'

// Human-readable labels for each scoring type
const TIPO_LABEL: Record<string, string> = {
  placar_exato:  'Placar exato',
  empate:        'Empate (placar diferente)',
  vencedor:      'Vencedor (placar diferente)',
  gols_equipe:   'Gols de uma equipe (cumulativo)',
  penalti:       'Classificado nos pênaltis (cumulativo)',
  classificacao:    'Bônus de classificação correta para fase 16Avos (por time)',
  campeao:          'Campeão',
  vice_campeao:     'Vice-Campeão',
  artilheiro:       'Artilheiro',
  melhor_jogador:   'Melhor Jogador',
  melhor_goleiro:   'Melhor Goleiro',
}

// Display order for the Palpites Especiais points card
const ESPECIAIS_ORDER = ['campeao', 'vice_campeao', 'artilheiro', 'melhor_jogador', 'melhor_goleiro']

// Display order for scoring types within each phase card
const TIPO_ORDER = ['placar_exato', 'empate', 'vencedor', 'gols_equipe', 'penalti']

interface Props {
  configs:         ConfiguracaoPontuacao[]
  usuarios:        User[]
  palpites:        (Palpite & { usuario?: { nome: string; email: string }; palpites_jogos?: { submitted_at: string | null }[] })[]
  especiais:       ResultadoEspecial | null
  activityLog:     ActivityLog[]
}

type Aba = 'pontuacao' | 'especiais' | 'palpites' | 'usuarios' | 'operacoes' | 'atividades'

export function AdminConfigClient({ configs, usuarios, palpites, especiais, activityLog }: Props) {
  const supabase = createClient()

  // ── Scoring config state ──────────────────────────────────────────────────
  const [configsState, setConfigsState] = useState(configs)
  const [saving, setSaving]             = useState<number | null>(null)

  // ── Palpites state ────────────────────────────────────────────────────────
  const [palpitesState, setPalpitesState] = useState(palpites)
  const [searchPalpites, setSearchPalpites] = useState('')
  const [statusFilterAdmin, setStatusFilterAdmin] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  // ── Usuários filter + delete state ───────────────────────────────────────
  const [usuarioPalpiteFilter, setUsuarioPalpiteFilter] = useState<'todos' | 'com' | 'sem'>('todos')
  const [usuariosState, setUsuariosState] = useState(usuarios)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<{ id: string; nome: string } | null>(null)
  const [deleteUserMsg, setDeleteUserMsg] = useState('')

  async function handleDeleteUser(id: string) {
    setDeletingUser(id)
    setDeleteUserMsg('')
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        setDeleteUserMsg(json.error ?? 'Erro ao excluir.')
      } else {
        setUsuariosState(prev => prev.filter(u => u.id !== id))
        setDeleteUserConfirm(null)
      }
    } catch {
      setDeleteUserMsg('Erro de conexão.')
    }
    setDeletingUser(null)
  }

  // ── Special results state ─────────────────────────────────────────────────
  const [especiaisState, setEspeciaisState] = useState<Partial<ResultadoEspecial>>(especiais ?? {})
  const [especialSaving, setEspecialSaving] = useState(false)
  const [especialMsg,    setEspecialMsg]    = useState('')

  // ── Classification bonus state ────────────────────────────────────────────
  const [classifSaving, setClassifSaving] = useState(false)
  const [classifMsg,    setClassifMsg]    = useState('')

  // ── Bulk recalculation state ──────────────────────────────────────────────
  const [recalcSaving, setRecalcSaving] = useState(false)
  const [recalcMsg,    setRecalcMsg]    = useState('')

  // ── Artilheiros (atualização manual) state ────────────────────────────────
  const [artilheirosSaving, setArtilheirosSaving] = useState(false)
  const [artilheirosMsg,    setArtilheirosMsg]    = useState('')

  // ── Reset results state ───────────────────────────────────────────────────
  const [resetConfirm,  setResetConfirm]  = useState(false)
  const [resetSaving,   setResetSaving]   = useState(false)
  const [resetMsg,      setResetMsg]      = useState('')
  const [resetWord,     setResetWord]     = useState('')
  const [resetSenha,    setResetSenha]    = useState('')
  const [resetSenhaErr, setResetSenhaErr] = useState('')

  // ── Boletim manual state ──────────────────────────────────────────────────
  type BoletimStatus = {
    gerado_em: string
    auditoria: string | null
    reescrito: boolean
    total: number
  }
  const [boletimSaving,   setBoletimSaving]   = useState(false)
  const [boletimErro,     setBoletimErro]     = useState('')
  const [boletimStatus,   setBoletimStatus]   = useState<BoletimStatus | null>(null)
  const [previewPrompt,   setPreviewPrompt]   = useState<string | null>(null)
  const [previewLoading,  setPreviewLoading]  = useState(false)
  const [previewErro,     setPreviewErro]     = useState('')
  const [boletimLoaded,   setBoletimLoaded]   = useState(false)
  const [auditExpanded,   setAuditExpanded]   = useState(false)

  async function carregarBoletimStatus() {
    if (boletimLoaded) return
    try {
      const res  = await fetch('/api/admin/boletim-status')
      const json = await res.json()
      if (res.ok && json.data) setBoletimStatus(json.data)
      setBoletimLoaded(true)
    } catch { /* silencioso */ }
  }

  async function gerarBoletim() {
    setBoletimSaving(true)
    setBoletimErro('')
    try {
      const res  = await fetch('/api/boletim/gerar')
      const json = await res.json()
      if (!res.ok) {
        setBoletimErro(json.error ?? 'Erro ao gerar boletim.')
      } else {
        // Recarrega o status do banco para refletir o novo boletim
        setBoletimLoaded(false)
        setBoletimStatus(null)
        await carregarBoletimStatus()
      }
    } catch {
      setBoletimErro('Erro de conexão.')
    }
    setBoletimSaving(false)
  }

  // Monta e devolve o prompt que seria enviado ao Sonnet, sem chamar a API da
  // Anthropic nem gravar nenhum boletim — útil pra testar mudanças no prompt
  // sem custo e sem duplicar o boletim do dia.
  async function testarPrompt() {
    setPreviewLoading(true)
    setPreviewErro('')
    setPreviewPrompt(null)
    try {
      const res  = await fetch('/api/boletim/gerar?preview=true')
      const json = await res.json()
      if (!res.ok) {
        setPreviewErro(json.error ?? 'Erro ao montar o prompt.')
      } else {
        setPreviewPrompt(json.prompt ?? '')
      }
    } catch {
      setPreviewErro('Erro de conexão.')
    }
    setPreviewLoading(false)
  }

  // ── Configurações do sistema (prazos) ─────────────────────────────────────
  const [especiaisDeadline,    setEspeciaisDeadline]    = useState('')
  const [novoPalpiteDeadline,  setNovoPalpiteDeadline]  = useState('')
  const [minutosLock,          setMinutosLock]          = useState('60')
  const [prazoSaving,          setPrazoSaving]          = useState(false)
  const [prazoMsg,             setPrazoMsg]             = useState('')
  const [prazoLoaded,          setPrazoLoaded]          = useState(false)

  // Carrega prazos ao montar (lazy — só quando a aba Operações é acessada)
  async function carregarPrazos() {
    if (prazoLoaded) return
    try {
      const res = await fetch('/api/admin/configuracoes-sistema')
      const { data } = await res.json()
      if (data) {
        // Converte ISO → formato datetime-local (YYYY-MM-DDTHH:mm) em BRT (UTC-3)
        const toLocal = (iso: string | null) => {
          if (!iso) return ''
          const d = new Date(iso)
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
          return d.toISOString().slice(0, 16)
        }
        setEspeciaisDeadline(toLocal(data.especiais_deadline))
        setNovoPalpiteDeadline(toLocal(data.novo_palpite_deadline))
        setMinutosLock(String(data.minutos_lock_jogo ?? 60))
      }
      setPrazoLoaded(true)
    } catch { /* silencioso */ }
  }

  async function salvarPrazos() {
    setPrazoSaving(true)
    setPrazoMsg('')
    try {
      const res = await fetch('/api/admin/configuracoes-sistema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          especiais_deadline:    especiaisDeadline    ? new Date(especiaisDeadline).toISOString()   : null,
          novo_palpite_deadline: novoPalpiteDeadline  ? new Date(novoPalpiteDeadline).toISOString() : null,
          minutos_lock_jogo:     parseInt(minutosLock) || 60,
        }),
      })
      const { ok, error } = await res.json()
      setPrazoMsg(ok ? '✅ Configurações salvas com sucesso.' : `❌ ${error}`)
    } catch {
      setPrazoMsg('❌ Erro de rede.')
    } finally {
      setPrazoSaving(false)
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [aba, setAba] = useState<Aba>('pontuacao')

  const abas: { key: Aba; label: string }[] = [
    { key: 'pontuacao',  label: 'Pontuação' },
    { key: 'especiais',  label: 'Palpites Especiais' },
    { key: 'palpites',   label: `Palpites (${palpites.length})` },
    { key: 'usuarios',   label: `Usuários (${usuarios.length})` },
    { key: 'operacoes',  label: 'Operações' },
    { key: 'atividades', label: `Atividades (${activityLog.length})` },
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

  async function resetResultados() {
    setResetSenhaErr('')
    // Verifica senha no cliente antes de chamar a API
    const supabaseClient = createClient()
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) { setResetSenhaErr('Sessão expirada. Recarregue a página.'); return }
    const { error: signInErr } = await supabaseClient.auth.signInWithPassword({
      email: user.email!,
      password: resetSenha,
    })
    if (signInErr) { setResetSenhaErr('Senha incorreta.'); return }

    setResetSaving(true)
    setResetMsg('')
    try {
      const res = await fetch('/api/admin/reset-resultados', { method: 'POST' })
      const { ok, error } = await res.json()
      if (ok) {
        setResetMsg('✅ Todos os resultados foram apagados e os pontos zerados.')
        setResetConfirm(false)
        setResetWord('')
        setResetSenha('')
      } else {
        setResetMsg(`❌ ${error}`)
      }
    } catch {
      setResetMsg('❌ Erro de rede.')
    } finally {
      setResetSaving(false)
    }
  }

  async function recalcularTudo() {
    setRecalcSaving(true)
    setRecalcMsg('')
    try {
      const res = await fetch('/api/admin/recalcular', { method: 'POST' })
      const { ok, updatedCount, jogosComResultado, error } = await res.json()
      if (ok) setRecalcMsg(`✅ ${updatedCount} predições atualizadas em ${jogosComResultado} jogos com resultado.`)
      else    setRecalcMsg(`❌ ${error}`)
    } catch {
      setRecalcMsg('❌ Erro de rede.')
    } finally {
      setRecalcSaving(false)
    }
  }

  async function atualizarArtilheirosManual() {
    setArtilheirosSaving(true)
    setArtilheirosMsg('')
    try {
      const res = await fetch('/api/admin/artilheiros', { method: 'POST' })
      const { ok, count, error } = await res.json()
      if (ok) setArtilheirosMsg(`✅ ${count} artilheiros atualizados.`)
      else    setArtilheirosMsg(`❌ ${error}`)
    } catch {
      setArtilheirosMsg('❌ Erro de rede.')
    } finally {
      setArtilheirosSaving(false)
    }
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
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Pontuação, palpites especiais, ativação de palpites</div>
        </div>
        <a href="/admin/resultados" style={{ fontSize: 11, color: '#4A90D9', background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 7, padding: '7px 14px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
          ← Resultados
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {abas.map(tab => (
          <button key={tab.key} onClick={() => { setAba(tab.key); if (tab.key === 'operacoes') { carregarPrazos(); carregarBoletimStatus() } }} style={{
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
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 14, lineHeight: 1.6 }}>
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
                    {fase === 'GS' && (() => {
                      const c = configsState.find(cfg => cfg.fase === 'GS' && cfg.tipo_acerto === 'classificacao')
                      if (!c) return (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          Execute o SQL 20_classificacao_pontos_config.sql para liberar este campo.
                        </div>
                      )
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
                      )
                    })()}
                  </div>
                </div>
              )
            })}

            {/* Palpites Especiais — pontos por categoria */}
            <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                🌟 Palpites Especiais
              </div>
              {(() => {
                const especiaisConfigs = ESPECIAIS_ORDER
                  .map(tipo => configsState.find(c => c.fase === 'ESP' && c.tipo_acerto === tipo))
                  .filter(Boolean) as ConfiguracaoPontuacao[]
                if (especiaisConfigs.length === 0) {
                  return (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                      Execute o SQL 21_especiais_pontos_config.sql para criar as configs.
                    </div>
                  )
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {especiaisConfigs.map(c => (
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
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Palpites Especiais — Official Results ── */}
      {aba === 'especiais' && (
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 16, lineHeight: 1.6 }}>
            Insira os resultados oficiais dos palpites especiais. Ao salvar, os pontos serão recalculados automaticamente para todos os palpites.
          </div>

          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            {([
              { key: 'campeao'       as const, emoji: '🏆', label: 'Campeão',        pts: configsState.find(c => c.fase === 'ESP' && c.tipo_acerto === 'campeao')?.pontos        ?? SPECIAL_POINTS.campeao,        options: ALL_TEAMS.map(t => ({ value: t, label: t })) },
              { key: 'vice_campeao'  as const, emoji: '🥈', label: 'Vice-Campeão',   pts: configsState.find(c => c.fase === 'ESP' && c.tipo_acerto === 'vice_campeao')?.pontos   ?? SPECIAL_POINTS.vice_campeao,   options: ALL_TEAMS.map(t => ({ value: t, label: t })) },
              { key: 'artilheiro'    as const, emoji: '⚽', label: 'Artilheiro',     pts: configsState.find(c => c.fase === 'ESP' && c.tipo_acerto === 'artilheiro')?.pontos     ?? SPECIAL_POINTS.artilheiro,     options: ARTILHEIRO_OPTIONS },
              { key: 'melhor_jogador'as const, emoji: '🌟', label: 'Melhor Jogador', pts: configsState.find(c => c.fase === 'ESP' && c.tipo_acerto === 'melhor_jogador')?.pontos ?? SPECIAL_POINTS.melhor_jogador, options: ARTILHEIRO_OPTIONS },
              { key: 'melhor_goleiro'as const, emoji: '🧤', label: 'Melhor Goleiro', pts: configsState.find(c => c.fase === 'ESP' && c.tipo_acerto === 'melhor_goleiro')?.pontos ?? SPECIAL_POINTS.melhor_goleiro, options: GOLEIRO_OPTIONS },
            ]).map((item, idx, arr) => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.emoji}</span>
                <div style={{ flex: '0 0 auto', minWidth: 90, maxWidth: 120 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,200,80,0.7)', fontWeight: 700 }}>{item.pts} pts</div>
                </div>
                <select
                  value={(especiaisState[item.key] as string | null | undefined) ?? ''}
                  onChange={e => setEspeciaisState(prev => ({ ...prev, [item.key]: e.target.value || null }))}
                  style={{ flex: 1, minWidth: 0, background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '7px 6px', fontSize: 12, fontWeight: 700, color: especiaisState[item.key] ? '#4ade80' : 'rgba(255,255,255,0.35)', fontFamily: 'Inter,sans-serif', outline: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

        </div>
      )}

      {/* ── Operações ── */}
      {aba === 'operacoes' && (
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 20, lineHeight: 1.6 }}>
            Operações administrativas que afetam todos os palpites e resultados do bolão.
          </div>

          {/* ── Prazos e bloqueios ── */}
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 10, padding: '20px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 4 }}>
              🔒 Prazos e Bloqueios
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.6 }}>
              Define quando cada tipo de edição é encerrado automaticamente.
              Deixe em branco para não aplicar o prazo.
            </div>

            {/* 1. Prazo palpites especiais */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                1 · Prazo para editar Palpites Especiais
              </label>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                Após este dia e hora, os campos Campeão, Vice, Artilheiro, etc. ficam travados para todos os participantes.
              </div>
              <input
                type="datetime-local"
                value={especiaisDeadline}
                onChange={e => setEspeciaisDeadline(e.target.value)}
                style={{ background: '#020F2A', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none', width: '100%', maxWidth: 280, colorScheme: 'dark' }}
              />
            </div>

            {/* 2. Prazo novo palpite */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                2 · Prazo para criar novo Palpite
              </label>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                Após este dia e hora, novos palpites não poderão mais ser criados.
              </div>
              <input
                type="datetime-local"
                value={novoPalpiteDeadline}
                onChange={e => setNovoPalpiteDeadline(e.target.value)}
                style={{ background: '#020F2A', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none', width: '100%', maxWidth: 280, colorScheme: 'dark' }}
              />
            </div>

            {/* 3. Minutos antes do jogo */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                3 · Minutos antes do jogo para travar edição
              </label>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                Impede alteração do placar de um jogo X minutos antes do seu horário de início.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={minutosLock}
                  onChange={e => setMinutosLock(e.target.value)}
                  style={{ background: '#020F2A', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none', width: 100, colorScheme: 'dark' }}
                />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>minutos</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={salvarPrazos} disabled={prazoSaving}
                style={{ background: prazoSaving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#4A90D9,#2563eb)', color: prazoSaving ? 'rgba(255,255,255,0.4)' : 'white', border: 'none', padding: '10px 24px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: prazoSaving ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {prazoSaving ? 'Salvando...' : '💾 Salvar Configurações'}
              </button>
              {prazoMsg && (
                <span style={{ fontSize: 12, color: prazoMsg.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>
                  {prazoMsg}
                </span>
              )}
            </div>
          </div>

          {/* Bulk recalculation */}
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '20px 20px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 6 }}>
              🔄 Recalcular todos os pontos
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
              Recalcula <strong style={{ color: 'rgba(255,255,255,0.7)' }}>todos</strong> os pontos de todos os palpites para todos os jogos que já têm resultado oficial.
              Use após alterar a tabela de pontuação ou para corrigir palpites criados antes das mudanças de regra.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={recalcularTudo} disabled={recalcSaving}
                style={{ background: recalcSaving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#f59e0b,#d97706)', color: recalcSaving ? 'rgba(255,255,255,0.4)' : 'white', border: 'none', padding: '10px 24px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: recalcSaving ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {recalcSaving ? 'Recalculando...' : 'Recalcular Tudo'}
              </button>
              {recalcMsg && (
                <span style={{ fontSize: 12, color: recalcMsg.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>
                  {recalcMsg}
                </span>
              )}
            </div>
          </div>

          {/* Atualizar ranking de artilheiros */}
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '20px 20px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 6 }}>
              ⚽ Atualizar Ranking de Artilheiros
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
              Busca o ranking de artilheiros mais recente na football-data.org e atualiza a tabela exibida no Dashboard e no boletim.
              Já roda automaticamente a cada 30 min — use este botão só se precisar forçar uma atualização imediata.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={atualizarArtilheirosManual} disabled={artilheirosSaving}
                style={{ background: artilheirosSaving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#f59e0b,#d97706)', color: artilheirosSaving ? 'rgba(255,255,255,0.4)' : 'white', border: 'none', padding: '10px 24px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: artilheirosSaving ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {artilheirosSaving ? 'Atualizando...' : 'Atualizar Artilheiros'}
              </button>
              {artilheirosMsg && (
                <span style={{ fontSize: 12, color: artilheirosMsg.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>
                  {artilheirosMsg}
                </span>
              )}
            </div>
          </div>

          {/* Group classification bonus */}
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '20px 20px', marginBottom: 12 }}>
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

          {/* ── Boletim manual ── */}
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '20px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 6 }}>
              📰 Boletim da Copa
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
              Gera uma nova edição do boletim agora. Use quando o boletim automático tiver informações incorretas ou quebrar alguma regra de formato.
            </div>

            {/* Status do último boletim */}
            {boletimStatus && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(74,144,217,0.12)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Último boletim</span>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                      {new Date(boletimStatus.gerado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</span>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      {boletimStatus.reescrito
                        ? <span style={{ color: '#fbbf24' }}>⚠️ Gerado com correções</span>
                        : <span style={{ color: '#4ade80' }}>✅ Gerado com sucesso</span>}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total gerados</span>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{boletimStatus.total}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Auditoria do Haiku — colapsável */}
            {boletimStatus?.auditoria && boletimStatus.auditoria !== 'SEM ERROS IDENTIFICADOS' && (
              <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
                <button
                  onClick={() => setAuditExpanded(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(251,191,36,0.85)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    ⚠️ Auditoria Haiku — último boletim
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(251,191,36,0.6)', flexShrink: 0 }}>
                    {auditExpanded ? '▲ Recolher' : '▼ Expandir'}
                  </span>
                </button>
                {auditExpanded && (
                  <div style={{ padding: '0 14px 12px' }}>
                    <pre style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'Inter,sans-serif' }}>
                      {boletimStatus.auditoria}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {boletimStatus?.auditoria === 'SEM ERROS IDENTIFICADOS' && (
              <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 16 }}>
                ✅ Haiku não encontrou erros no último boletim.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={gerarBoletim} disabled={boletimSaving}
                style={{ background: boletimSaving ? 'rgba(255,255,255,0.08)' : 'linear-gradient(90deg,#4A90D9,#7c3aed)', color: boletimSaving ? 'rgba(255,255,255,0.4)' : 'white', border: 'none', padding: '10px 24px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: boletimSaving ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {boletimSaving ? 'Gerando boletim...' : '📰 Gerar Novo Boletim'}
              </button>
              <button onClick={testarPrompt} disabled={previewLoading}
                style={{ background: 'rgba(255,255,255,0.06)', color: previewLoading ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)', padding: '10px 20px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: previewLoading ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {previewLoading ? 'Montando prompt...' : '🔍 Testar Prompt (sem gerar)'}
              </button>
              {boletimErro && (
                <span style={{ fontSize: 12, color: 'rgba(255,100,100,0.9)' }}>❌ {boletimErro}</span>
              )}
              {previewErro && (
                <span style={{ fontSize: 12, color: 'rgba(255,100,100,0.9)' }}>❌ {previewErro}</span>
              )}
            </div>

            {previewPrompt != null && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Prompt que seria enviado ao Sonnet (não gera boletim)
                  </span>
                  <button onClick={() => setPreviewPrompt(null)}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', borderRadius: 5, fontSize: 11, padding: '2px 8px', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    Fechar
                  </button>
                </div>
                <textarea readOnly value={previewPrompt}
                  style={{ width: '100%', height: 360, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'monospace', padding: 12, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            )}
          </div>

          {/* ── Enquete ── */}
          <EnqueteAdminCard />

          {/* Reset all results */}
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 10, padding: '20px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,130,130,0.9)', marginBottom: 6 }}>
              ⚠️ Resetar todos os resultados
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
              Apaga <strong style={{ color: 'rgba(255,255,255,0.7)' }}>todos</strong> os resultados oficiais, zera todos os pontos e restaura os times do Mata-Mata para os placeholders originais.
              Os palpites e suas predições são preservados. Use apenas para testes.
            </div>
            {!resetConfirm ? (
              <button onClick={() => { setResetConfirm(true); setResetMsg(''); setResetWord(''); setResetSenha(''); setResetSenhaErr('') }}
                style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.35)', color: 'rgba(255,130,130,0.9)', padding: '10px 24px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Resetar Resultados
              </button>
            ) : (
              <div style={{ background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 8, padding: '16px' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,200,200,0.9)', fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
                  Esta ação é irreversível. Para confirmar, preencha os campos abaixo.
                </div>

                {/* Campo 1: palavra RESETAR */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>
                    Digite <strong style={{ color: 'rgba(255,150,150,0.9)', letterSpacing: 1 }}>RESETAR</strong> para continuar
                  </label>
                  <input
                    type="text"
                    value={resetWord}
                    onChange={e => setResetWord(e.target.value)}
                    placeholder="RESETAR"
                    autoComplete="off"
                    style={{ width: '100%', maxWidth: 240, background: '#020F2A', border: `1px solid ${resetWord === 'RESETAR' ? 'rgba(74,222,128,0.4)' : 'rgba(255,80,80,0.3)'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box', letterSpacing: 1 }}
                  />
                </div>

                {/* Campo 2: senha */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>
                    Confirme sua senha
                  </label>
                  <input
                    type="password"
                    value={resetSenha}
                    onChange={e => { setResetSenha(e.target.value); setResetSenhaErr('') }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{ width: '100%', maxWidth: 240, background: '#020F2A', border: `1px solid ${resetSenhaErr ? 'rgba(255,80,80,0.7)' : 'rgba(255,80,80,0.3)'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box' }}
                  />
                  {resetSenhaErr && (
                    <div style={{ fontSize: 11, color: 'rgba(255,100,100,0.9)', marginTop: 4 }}>⚠️ {resetSenhaErr}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={resetResultados}
                    disabled={resetSaving || resetWord !== 'RESETAR' || !resetSenha}
                    style={{ background: (resetSaving || resetWord !== 'RESETAR' || !resetSenha) ? 'rgba(255,255,255,0.06)' : 'rgba(255,80,80,0.25)', border: '1px solid rgba(255,80,80,0.5)', color: (resetSaving || resetWord !== 'RESETAR' || !resetSenha) ? 'rgba(255,255,255,0.25)' : 'rgba(255,150,150,0.9)', padding: '8px 20px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: (resetSaving || resetWord !== 'RESETAR' || !resetSenha) ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    {resetSaving ? 'Resetando...' : '🗑 Confirmar reset'}
                  </button>
                  <button onClick={() => { setResetConfirm(false); setResetWord(''); setResetSenha(''); setResetSenhaErr('') }} disabled={resetSaving}
                    style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: 'rgba(255,255,255,0.5)', padding: '8px 20px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {resetMsg && (
              <div style={{ marginTop: 10, fontSize: 12, color: resetMsg.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>
                {resetMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Palpites ── */}
      {aba === 'palpites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Buscador + filtro de status */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar por nome do palpite ou participante..."
                value={searchPalpites}
                onChange={e => setSearchPalpites(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 8, padding: '8px 12px 8px 32px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }}
              />
              {searchPalpites && (
                <button onClick={() => setSearchPalpites('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
              )}
            </div>
            {/* pills de status */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['todos', 'ativo', 'inativo'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilterAdmin(s)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  background: statusFilterAdmin === s
                    ? s === 'ativo' ? 'rgba(74,222,128,0.2)' : s === 'inativo' ? 'rgba(255,100,100,0.15)' : 'rgba(74,144,217,0.2)'
                    : 'rgba(255,255,255,0.05)',
                  color: statusFilterAdmin === s
                    ? s === 'ativo' ? '#4ade80' : s === 'inativo' ? 'rgba(255,130,130,0.9)' : '#7BB8F0'
                    : 'rgba(255,255,255,0.35)',
                  borderWidth: 1, borderStyle: 'solid',
                  borderColor: statusFilterAdmin === s
                    ? s === 'ativo' ? 'rgba(74,222,128,0.35)' : s === 'inativo' ? 'rgba(255,100,100,0.25)' : 'rgba(74,144,217,0.35)'
                    : 'transparent',
                }}>{s === 'todos' ? 'Todos' : s === 'ativo' ? 'Ativos' : 'Inativos'}</button>
              ))}
            </div>
          </div>
          {(() => {
            const q = searchPalpites.trim().toLowerCase()
            const filtered = palpitesState.filter(p => {
              const matchSearch = !q ||
                p.nome.toLowerCase().includes(q) ||
                (p.usuario?.nome ?? '').toLowerCase().includes(q) ||
                (p.usuario?.email ?? '').toLowerCase().includes(q)
              const matchStatus = statusFilterAdmin === 'todos' || p.status === statusFilterAdmin
              return matchSearch && matchStatus
            })
            if (filtered.length === 0) return (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                {q ? `Nenhum resultado para "${searchPalpites}"` : 'Nenhum palpite criado'}
              </div>
            )
            const totalStatus = statusFilterAdmin === 'todos' ? palpitesState.length : palpitesState.filter(p => p.status === statusFilterAdmin).length
            return (<>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} de {totalStatus}
                {' · '}
                <span style={{ color: '#4ade80' }}>{palpitesState.filter(p => p.status === 'ativo').length} ativos</span>
                {' · '}
                <span style={{ color: 'rgba(255,130,130,0.8)' }}>{palpitesState.filter(p => p.status === 'inativo').length} inativos</span>
              </div>
              {filtered.map(p => {
            const jogosSubmetidos = p.palpites_jogos?.filter(pj => pj.submitted_at).length ?? 0
            const totalJogos      = 104 // always 104 games in the tournament
            const speciais        = [p.campeao, p.vice_campeao, p.artilheiro, p.melhor_jogador, p.melhor_goleiro]
            const specialCount    = speciais.filter(Boolean).length
            const pct             = totalJogos > 0 ? Math.round((jogosSubmetidos / totalJogos) * 100) : 0

            // Color helpers
            const jogosColor  = jogosSubmetidos === totalJogos && totalJogos > 0 ? '#4ade80' : jogosSubmetidos > 0 ? '#f97316' : 'rgba(255,255,255,0.3)'
            const specColor   = specialCount === 5 ? '#4ade80' : specialCount > 0 ? '#f97316' : 'rgba(255,255,255,0.3)'

            return (
              <div key={p.id} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Progress bar top */}
                <div style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: 2, width: `${pct}%`, background: pct === 100 ? '#4ade80' : 'linear-gradient(90deg,#4A90D9,#7BB8F0)', transition: 'width 0.3s' }} />
                </div>

                <div style={{ padding: '12px 14px' }}>
                  {/* Top row: name + status + button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{p.usuario?.nome} · {p.usuario?.email}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0, background: p.status === 'ativo' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.07)', color: p.status === 'ativo' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                      {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                    <button onClick={() => toggleStatus(p.id, p.status === 'ativo' ? 'inativo' : 'ativo')}
                      style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', flexShrink: 0, background: p.status === 'ativo' ? 'rgba(255,255,255,0.07)' : 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: p.status === 'ativo' ? 'rgba(255,255,255,0.5)' : 'white' }}>
                      {p.status === 'ativo' ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {/* Jogos submetidos */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '5px 10px' }}>
                      <span style={{ fontSize: 12 }}>⚽</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Jogos</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: jogosColor }}>{jogosSubmetidos}/{totalJogos}</span>
                    </div>

                    {/* Palpites especiais */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '5px 10px' }}>
                      <span style={{ fontSize: 12 }}>🌟</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Especiais</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: specColor }}>{specialCount}/5</span>
                    </div>

                    {/* Pontos totais */}
                    {p.status === 'ativo' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(74,144,217,0.08)', borderRadius: 6, padding: '5px 10px' }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Pts</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#4A90D9' }}>{(p.pontos_especiais ?? 0) + (p.pontos_classificacao ?? 0)}</span>
                      </div>
                    )}

                    {/* Especiais detalhes */}
                    {specialCount > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {p.campeao      && <span style={{ fontSize: 9, color: 'rgba(255,200,80,0.75)', background: 'rgba(255,200,80,0.08)', borderRadius: 4, padding: '2px 6px' }}>🏆 {p.campeao}</span>}
                        {p.vice_campeao && <span style={{ fontSize: 9, color: 'rgba(255,200,80,0.75)', background: 'rgba(255,200,80,0.08)', borderRadius: 4, padding: '2px 6px' }}>🥈 {p.vice_campeao}</span>}
                        {p.artilheiro   && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 6px' }}>⚽ {p.artilheiro}</span>}
                        {p.melhor_jogador && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 6px' }}>🌟 {p.melhor_jogador}</span>}
                        {p.melhor_goleiro && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 6px' }}>🧤 {p.melhor_goleiro}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
            </>)
          })()}
        </div>
      )}

      {/* ── Atividades ── */}
      {aba === 'atividades' && (
        <ActivityLogTab log={activityLog} />
      )}

      {/* ── Usuários ── */}
      {aba === 'usuarios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* Delete confirmation dialog */}
          {deleteUserConfirm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: '#0D1E3D', border: '1px solid rgba(255,100,100,0.35)', borderRadius: 12, padding: '28px 32px', maxWidth: 400, width: '100%' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 6 }}>Excluir usuário?</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>Você está prestes a excluir permanentemente:</div>
                <div style={{ background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{deleteUserConfirm.nome}</div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,200,80,0.8)', marginBottom: 4 }}>⚠️ Esta ação remove a conta de autenticação e não pode ser desfeita.</div>
                {deleteUserMsg && (
                  <div style={{ fontSize: 12, color: 'rgba(255,130,130,0.9)', marginBottom: 8, padding: '6px 10px', background: 'rgba(255,100,100,0.1)', borderRadius: 6 }}>{deleteUserMsg}</div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={() => { setDeleteUserConfirm(null); setDeleteUserMsg('') }}
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', padding: '9px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    Cancelar
                  </button>
                  <button onClick={() => handleDeleteUser(deleteUserConfirm.id)} disabled={deletingUser === deleteUserConfirm.id}
                    style={{ background: deletingUser === deleteUserConfirm.id ? 'rgba(255,100,100,0.2)' : 'rgba(220,50,50,0.8)', color: 'white', border: 'none', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: deletingUser === deleteUserConfirm.id ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    {deletingUser === deleteUserConfirm.id ? 'Excluindo...' : 'Confirmar exclusão'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
            {([
              { key: 'todos', label: `Todos (${usuariosState.length})` },
              { key: 'com',   label: `Com Palpite (${usuariosState.filter(u => palpites.some(p => p.usuario_id === u.id)).length})` },
              { key: 'sem',   label: `Sem Palpite (${usuariosState.filter(u => !palpites.some(p => p.usuario_id === u.id)).length})` },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setUsuarioPalpiteFilter(f.key)} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif',
                textTransform: 'uppercase', letterSpacing: 0.5,
                background: usuarioPalpiteFilter === f.key ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.05)',
                color: usuarioPalpiteFilter === f.key ? '#7BB8F0' : 'rgba(255,255,255,0.35)',
                outline: usuarioPalpiteFilter === f.key ? '1px solid rgba(74,144,217,0.35)' : '1px solid transparent',
              }}>{f.label}</button>
            ))}
          </div>

          {usuariosState.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum usuário cadastrado</div>
          )}
          {usuariosState
            .filter(u => {
              const hasPalpite = palpites.some(p => p.usuario_id === u.id)
              if (usuarioPalpiteFilter === 'com') return hasPalpite
              if (usuarioPalpiteFilter === 'sem') return !hasPalpite
              return true
            })
            .map(u => {
              const digits = (u.telefone ?? '').replace(/\D/g, '')
              const fone = digits.length === 11
                ? `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
                : digits.length === 10
                ? `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
                : (u.telefone ?? null)
              const formatDate = (iso: string) => {
                const d = new Date(iso)
                const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                return `${date} - ${time}`
              }
              const userPalpites = palpites.filter(p => p.usuario_id === u.id)
              const canDelete = !u.is_admin && userPalpites.length === 0
              return (
                <div key={u.id} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{u.nome}</div>
                      {u.is_admin && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Admin</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                      {u.email}{fone ? ` · ${fone}` : ''}
                    </div>
                    {/* Datas — mesma linha, texto mais visível */}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: userPalpites.length > 0 ? 6 : 0, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {u.criado_em && (
                        <span>📅 Criado em {formatDate(u.criado_em)}</span>
                      )}
                      {u.last_sign_in_at ? (
                        <span>🔑 Último acesso {formatDate(u.last_sign_in_at)}</span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.25)' }}>🔑 Nunca acessou</span>
                      )}
                    </div>
                    {userPalpites.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {userPalpites.map(p => (
                          <span key={p.id} style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                            background: p.status === 'ativo' ? 'rgba(74,222,128,0.12)' : 'rgba(255,100,100,0.10)',
                            color: p.status === 'ativo' ? '#4ade80' : 'rgba(255,130,130,0.8)',
                            border: `1px solid ${p.status === 'ativo' ? 'rgba(74,222,128,0.25)' : 'rgba(255,100,100,0.20)'}`,
                          }}>{p.nome}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Delete button — only for users with no palpites and non-admin */}
                  {canDelete && (
                    <button
                      onClick={() => { setDeleteUserMsg(''); setDeleteUserConfirm({ id: u.id, nome: u.nome }) }}
                      title="Excluir usuário"
                      style={{ flexShrink: 0, background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.2)', color: 'rgba(255,130,130,0.7)', borderRadius: 7, padding: '6px 10px', fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>
                      🗑
                    </button>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   ActivityLogTab — sub-component with its own search/filter state
   ───────────────────────────────────────────────────────────────────────────── */

type LogSort = 'data_desc' | 'data_asc' | 'usuario' | 'palpite'

function ActivityLogTab({ log }: { log: ActivityLog[] }) {
  const [search, setSearch]           = useState('')
  const [userFilter, setUserFilter]   = useState<string>('todos')
  const [sort, setSort]               = useState<LogSort>('data_desc')

  // Build sorted list of unique users who appear in the log
  const usersInLog = Array.from(
    new Map(
      log
        .filter(e => e.usuario_id)
        .map(e => [
          e.usuario_id!,
          { id: e.usuario_id!, label: e.usuario?.nome ?? e.usuario?.email ?? e.usuario_id! },
        ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  const q = search.trim().toLowerCase()
  const filtered = log.filter(e => {
    const matchUser   = userFilter === 'todos' || e.usuario_id === userFilter
    const matchSearch = !q ||
      (e.action ?? '').toLowerCase().includes(q) ||
      (e.palpite?.nome ?? '').toLowerCase().includes(q) ||
      (e.usuario?.nome ?? '').toLowerCase().includes(q) ||
      (e.usuario?.email ?? '').toLowerCase().includes(q)
    return matchUser && matchSearch
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'data_asc':  return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
      case 'data_desc': return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
      case 'usuario':   return (a.usuario?.nome ?? a.usuario?.email ?? '').localeCompare(b.usuario?.nome ?? b.usuario?.email ?? '', 'pt-BR')
      case 'palpite':   return (a.palpite?.nome ?? '').localeCompare(b.palpite?.nome ?? '', 'pt-BR')
    }
  })

  function formatDT(iso: string) {
    const d = new Date(iso)
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return `${date} - ${time}`
  }

  const isEspeciais = (e: ActivityLog) => e.jogo_id === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por ação ou palpite..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 8, padding: '8px 28px 8px 32px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
          )}
        </div>

        {/* User dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,144,217,0.25)',
              borderRadius: 8, padding: '8px 32px 8px 12px', fontSize: 12, color: userFilter === 'todos' ? 'rgba(255,255,255,0.5)' : 'white',
              fontFamily: 'Inter,sans-serif', outline: 'none', cursor: 'pointer',
              appearance: 'none', WebkitAppearance: 'none', minWidth: 160,
            }}
          >
            <option value="todos" style={{ background: '#0D1E3D' }}>Todos os usuários</option>
            {usersInLog.map(u => (
              <option key={u.id} value={u.id} style={{ background: '#0D1E3D' }}>{u.label}</option>
            ))}
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>▾</span>
        </div>
      </div>

      {/* Sort pills + summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { key: 'data_desc', label: 'Mais recente' },
            { key: 'data_asc',  label: 'Mais antigo'  },
            { key: 'usuario',   label: 'Usuário'       },
            { key: 'palpite',   label: 'Palpite'       },
          ] as { key: LogSort; label: string }[]).map(s => (
            <button key={s.key} onClick={() => setSort(s.key)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif',
              textTransform: 'uppercase', letterSpacing: 0.5,
              background: sort === s.key ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.05)',
              color: sort === s.key ? '#7BB8F0' : 'rgba(255,255,255,0.35)',
              outline: sort === s.key ? '1px solid rgba(74,144,217,0.35)' : '1px solid transparent',
            }}>{s.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''} de {log.length} total
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          {log.length === 0 ? 'Nenhuma atividade registrada ainda.' : 'Nenhum resultado.'}
        </div>
      )}

      {sorted.map(e => (
        <div key={e.id} style={{
          background: '#0D1E3D',
          border: `1px solid ${isEspeciais(e) ? 'rgba(251,191,36,0.18)' : 'rgba(74,144,217,0.15)'}`,
          borderRadius: 8, padding: '10px 14px',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', alignItems: 'start',
        }}>
          <div>
            {/* Action */}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 3 }}>
              {isEspeciais(e)
                ? <span style={{ color: '#fbbf24' }}>{e.action}</span>
                : e.action
              }
            </div>
            {/* Palpite + user + jogo */}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {e.palpite?.nome && (
                <span style={{ background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: '#7BB8F0' }}>
                  {e.palpite.nome}
                </span>
              )}
              <span>{e.usuario?.nome ?? e.usuario?.email ?? '—'}</span>
              {e.jogo?.numero_jogo && (
                <span style={{ color: 'rgba(255,255,255,0.22)' }}>Jogo #{e.jogo.numero_jogo}</span>
              )}
            </div>
          </div>
          {/* Timestamp */}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'right', whiteSpace: 'nowrap', paddingTop: 2 }}>
            {formatDT(e.criado_em)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Enquete admin card (usado dentro da aba Operações) ────────────────────────
function EnqueteAdminCard() {
  const [config,   setConfig]   = useState<{ aberta: boolean; resultado_visivel: boolean } | null>(null)
  const [totais,   setTotais]   = useState<{ A: number; B: number; C: number }>({ A: 0, B: 0, C: 0 })
  const [votaram,  setVotaram]  = useState(0)
  const [ativos,   setAtivos]   = useState(0)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  const [decisaoTitulo,  setDecisaoTitulo]  = useState('')
  const [decisaoTexto,   setDecisaoTexto]   = useState('')
  const [decisaoVisivel, setDecisaoVisivel] = useState(false)
  const [savingDecisao,  setSavingDecisao]  = useState(false)
  const [msgDecisao,     setMsgDecisao]     = useState('')

  useEffect(() => {
    fetch('/api/enquete/resultado')
      .then(r => r.json())
      .then(d => {
        setConfig({ aberta: d.aberta, resultado_visivel: d.resultado_visivel })
        setTotais(d.totais)
        setVotaram(d.totalVotaram)
        setAtivos(d.totalUsuariosAtivos)
        setDecisaoTitulo(d.decisao_titulo ?? '')
        setDecisaoTexto(d.decisao_texto ?? '')
        setDecisaoVisivel(d.decisao_visivel ?? false)
      })
      .catch(() => {})
  }, [])

  async function toggle(field: 'aberta' | 'resultado_visivel', value: boolean) {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/enquete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const json = await res.json()
      if (json.ok) {
        setConfig(prev => prev ? { ...prev, [field]: value } : null)
        setMsg('✅ Salvo.')
      } else {
        setMsg(`❌ ${json.error}`)
      }
    } catch {
      setMsg('❌ Erro de rede.')
    }
    setSaving(false)
  }

  async function salvarDecisao(extra?: Record<string, boolean>) {
    setSavingDecisao(true)
    setMsgDecisao('')
    try {
      const res = await fetch('/api/admin/enquete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisao_titulo: decisaoTitulo,
          decisao_texto: decisaoTexto,
          ...extra,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        if (extra && 'decisao_visivel' in extra) setDecisaoVisivel(!!extra.decisao_visivel)
        setMsgDecisao('✅ Salvo.')
      } else {
        setMsgDecisao(`❌ ${json.error}`)
      }
    } catch {
      setMsgDecisao('❌ Erro de rede.')
    }
    setSavingDecisao(false)
  }

  const total = Object.values(totais).reduce((s, v) => s + v, 0)
  const faltam = ativos - votaram

  const OPCOES = [
    { letra: 'A', texto: 'Não. Deixe bloqueados como estão.' },
    { letra: 'B', texto: 'Sim. Mas somente Campeão e Vice-Campeão.' },
    { letra: 'C', texto: 'Sim. Todos os palpites especiais.' },
  ]

  return (
    <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '20px', marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 4 }}>
        🗳️ Enquete — Palpites Especiais
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.6 }}>
        Controle quando o popup aparece e quando os resultados ficam visíveis para os participantes.
      </div>

      {config && (
        <>
          {/* Toggles */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => toggle('aberta', !config.aberta)}
              disabled={saving}
              style={{
                padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                background: config.aberta ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.07)',
                color: config.aberta ? '#4ade80' : 'rgba(255,255,255,0.5)',
                outline: config.aberta ? '1px solid rgba(74,222,128,0.35)' : '1px solid transparent',
              }}
            >
              {config.aberta ? '🟢 Enquete aberta' : '⚫ Enquete fechada'}
            </button>
            <button
              onClick={() => toggle('resultado_visivel', !config.resultado_visivel)}
              disabled={saving}
              style={{
                padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                background: config.resultado_visivel ? 'rgba(74,144,217,0.18)' : 'rgba(255,255,255,0.07)',
                color: config.resultado_visivel ? '#7BB8F0' : 'rgba(255,255,255,0.5)',
                outline: config.resultado_visivel ? '1px solid rgba(74,144,217,0.35)' : '1px solid transparent',
              }}
            >
              {config.resultado_visivel ? '👁 Resultado visível' : '🙈 Resultado oculto'}
            </button>
          </div>

          {/* Progresso */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(74,144,217,0.1)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              {votaram} de {ativos} participantes votaram
              {faltam > 0 && <span style={{ color: 'rgba(251,191,36,0.8)', marginLeft: 8 }}>· faltam {faltam}</span>}
              {faltam === 0 && ativos > 0 && <span style={{ color: '#4ade80', marginLeft: 8 }}>· todos votaram ✅</span>}
            </div>
            {OPCOES.map(({ letra, texto }) => {
              const votos = totais[letra as keyof typeof totais]
              const pct   = total > 0 ? Math.round((votos / total) * 100) : 0
              return (
                <div key={letra} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                      <strong style={{ color: '#7BB8F0' }}>{letra}</strong> — {texto}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', flexShrink: 0, marginLeft: 10 }}>
                      {votos}v · {pct}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(74,144,217,0.6)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {msg && <div style={{ fontSize: 11, color: msg.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>{msg}</div>}

          {/* Comunicação da decisão */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(74,144,217,0.12)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'white', marginBottom: 4 }}>📢 Comunicar decisão</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.6 }}>
              Mostra um popup com a decisão final, mesmo após a enquete ser encerrada. Enquanto &quot;visível para todos&quot; estiver desligado, só o admin vê (modo preview).
            </div>

            <input
              type="text"
              placeholder="Título — ex: Decisão sobre Palpites Especiais"
              value={decisaoTitulo}
              onChange={e => setDecisaoTitulo(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 8, padding: '9px 12px', color: 'white', fontSize: 13, marginBottom: 8, outline: 'none' }}
            />
            <textarea
              placeholder="Texto da decisão..."
              value={decisaoTexto}
              onChange={e => setDecisaoTexto(e.target.value)}
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 8, padding: '9px 12px', color: 'white', fontSize: 13, marginBottom: 10, outline: 'none', resize: 'vertical', fontFamily: 'Inter,sans-serif' }}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button
                onClick={() => salvarDecisao()}
                disabled={savingDecisao}
                style={{ padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: 'none', cursor: savingDecisao ? 'not-allowed' : 'pointer', background: 'rgba(74,144,217,0.18)', color: '#7BB8F0' }}
              >
                💾 Salvar texto
              </button>
              <button
                onClick={() => salvarDecisao({ decisao_visivel: !decisaoVisivel })}
                disabled={savingDecisao}
                style={{
                  padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  border: 'none', cursor: savingDecisao ? 'not-allowed' : 'pointer',
                  background: decisaoVisivel ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.07)',
                  color: decisaoVisivel ? '#4ade80' : 'rgba(255,255,255,0.5)',
                  outline: decisaoVisivel ? '1px solid rgba(74,222,128,0.35)' : '1px solid transparent',
                }}
              >
                {decisaoVisivel ? '👁 Visível para todos' : '🔒 Visível só para admin (preview)'}
              </button>
            </div>

            {msgDecisao && <div style={{ fontSize: 11, color: msgDecisao.startsWith('✅') ? '#4ade80' : 'rgba(255,100,100,0.9)' }}>{msgDecisao}</div>}
          </div>
        </>
      )}
      {!config && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Carregando...</div>
      )}
    </div>
  )
}
