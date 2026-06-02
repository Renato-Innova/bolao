'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FASES } from '@/utils/constants'
import type { ConfiguracaoPontuacao, Palpite, User } from '@/types'

interface Props {
  configs: ConfiguracaoPontuacao[]
  usuarios: User[]
  palpites: (Palpite & { usuario?: { nome: string; email: string } })[]
}

type Aba = 'pontuacao' | 'palpites' | 'usuarios'

export function AdminConfigClient({ configs, usuarios, palpites }: Props) {
  const supabase = createClient()
  const [configsState, setConfigsState] = useState(configs)
  const [palpitesState, setPalpitesState] = useState(palpites)
  const [saving, setSaving] = useState<number | null>(null)
  const [aba, setAba] = useState<Aba>('pontuacao')

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

  const abas: { key: Aba; label: string }[] = [
    { key: 'pontuacao', label: 'Pontuação' },
    { key: 'palpites',  label: `Palpites (${palpites.length})` },
    { key: 'usuarios',  label: `Usuários (${usuarios.length})` },
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg,#04143a,#091d50,#0a1f4e)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>Admin</span>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: 'white', letterSpacing: 1 }}>Configurações</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Gerencie pontuação, palpites e usuários</div>
        </div>
        <a href="/admin/resultados" style={{ fontSize: 11, color: '#4A90D9', background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 7, padding: '7px 14px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
          ← Resultados
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {abas.map(tab => (
          <button key={tab.key} onClick={() => setAba(tab.key)} style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter,sans-serif', border: 'none', transition: 'all 0.15s',
            background: aba === tab.key ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.05)',
            color: aba === tab.key ? '#4A90D9' : 'rgba(255,255,255,0.5)',
            outline: aba === tab.key ? '1px solid rgba(74,144,217,0.35)' : '1px solid transparent',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Pontuação ── */}
      {aba === 'pontuacao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.keys(FASES).map(fase => {
            const faseConfigs = configsState.filter(c => c.fase === fase)
            return (
              <div key={fase} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)' }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                  {FASES[fase as keyof typeof FASES]}
                </div>
                {faseConfigs.length === 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Nenhuma config. Execute o seed SQL para criar.</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {faseConfigs.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                        {c.tipo_acerto === 'placar_exato' ? 'Placar exato' : 'Vencedor / empate'}
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
      )}

      {/* ── Palpites ── */}
      {aba === 'palpites' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {palpitesState.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum palpite criado</div>
          )}
          {palpitesState.map(p => (
            <div key={p.id} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {p.usuario?.nome} · {p.usuario?.email}
                </div>
                {p.artilheiro && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Artilheiro: {p.artilheiro}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
