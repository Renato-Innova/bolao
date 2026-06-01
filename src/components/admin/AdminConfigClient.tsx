'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FASES } from '@/utils/constants'
import type { ConfiguracaoPontuacao, Palpite, User } from '@/types'

interface Props {
  configs: ConfiguracaoPontuacao[]
  usuarios: User[]
  palpites: (Palpite & { usuario?: { nome: string; email: string } })[]
}

export function AdminConfigClient({ configs, usuarios, palpites }: Props) {
  const supabase = createClient()
  const [configsState, setConfigsState] = useState(configs)
  const [palpitesState, setPalpitesState] = useState(palpites)
  const [saving, setSaving] = useState<string | null>(null)
  const [aba, setAba] = useState<'pontuacao' | 'palpites' | 'usuarios'>('pontuacao')

  async function salvarConfig(id: string, pontos: number) {
    setSaving(id)
    await supabase.from('configuracoes_pontuacao').update({ pontos }).eq('id', id)
    setConfigsState(prev => prev.map(c => c.id === id ? { ...c, pontos } : c))
    setSaving(null)
  }

  async function toggleStatus(palpiteId: string, novoStatus: 'ativo' | 'inativo') {
    await supabase.from('palpites').update({ status: novoStatus }).eq('id', palpiteId)
    setPalpitesState(prev => prev.map(p => p.id === palpiteId ? { ...p, status: novoStatus } : p))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div
        className="mb-6 p-5 rounded-xl flex items-center justify-between"
        style={{
          background: 'linear-gradient(90deg, #04143a 0%, #091d50 50%, #0a1f4e 100%)',
          border: '1px solid rgba(74,144,217,0.18)',
        }}
      >
        <div>
          <div className="flex items-center gap-3">
            <Badge variant="active">Admin</Badge>
            <div className="font-bebas text-2xl text-white">Configurações</div>
          </div>
          <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Gerencie pontuação, palpites e usuários
          </div>
        </div>
        <a
          href="/admin/resultados"
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: 'rgba(74,144,217,0.15)', color: '#4A90D9', border: '1px solid rgba(74,144,217,0.3)' }}
        >
          ← Resultados
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'pontuacao', label: 'Pontuação' },
          { key: 'palpites', label: `Palpites (${palpites.length})` },
          { key: 'usuarios', label: `Usuários (${usuarios.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setAba(tab.key as typeof aba)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: aba === tab.key ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.05)',
              color: aba === tab.key ? '#4A90D9' : 'rgba(255,255,255,0.5)',
              border: aba === tab.key ? '1px solid rgba(74,144,217,0.35)' : '1px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pontuação */}
      {aba === 'pontuacao' && (
        <div className="space-y-3">
          {Object.keys(FASES).map(fase => {
            const faseConfigs = configsState.filter(c => c.fase === fase)
            return (
              <Card key={fase} className="p-4">
                <div className="pt-2 mb-3 text-sm font-bold text-white">{FASES[fase as keyof typeof FASES]}</div>
                <div className="space-y-2">
                  {faseConfigs.map(c => (
                    <div key={c.id} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {c.tipo_acerto === 'placar_exato' ? 'Placar exato' : 'Vencedor/empate'}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={c.pontos}
                          onChange={e =>
                            setConfigsState(prev =>
                              prev.map(cfg => cfg.id === c.id ? { ...cfg, pontos: parseInt(e.target.value) || 0 } : cfg)
                            )
                          }
                          className="w-16 h-8 text-center rounded text-sm font-bold outline-none"
                          style={{ background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.3)', color: '#4A90D9' }}
                        />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>pts</span>
                        <Button
                          size="sm"
                          disabled={saving === c.id}
                          onClick={() => salvarConfig(c.id, c.pontos)}
                        >
                          {saving === c.id ? '...' : 'Salvar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {faseConfigs.length === 0 && (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhuma config. Execute o seed SQL para criar.</p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Palpites */}
      {aba === 'palpites' && (
        <div className="space-y-2">
          {palpitesState.map(p => (
            <Card key={p.id} className="p-4" accent={false}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white text-sm">{p.nome}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {p.usuario?.nome} · {p.usuario?.email}
                  </div>
                  {p.artilheiro && (
                    <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Artilheiro: {p.artilheiro}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === 'ativo' ? 'active' : 'inactive'}>
                    {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Button
                    size="sm"
                    variant={p.status === 'ativo' ? 'secondary' : 'primary'}
                    onClick={() => toggleStatus(p.id, p.status === 'ativo' ? 'inativo' : 'ativo')}
                  >
                    {p.status === 'ativo' ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {palpitesState.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Nenhum palpite criado</p>
          )}
        </div>
      )}

      {/* Usuários */}
      {aba === 'usuarios' && (
        <div className="space-y-2">
          {usuarios.map(u => (
            <Card key={u.id} className="p-4" accent={false}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white text-sm">{u.nome}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {u.email} · {u.telefone ?? 'sem telefone'}
                  </div>
                </div>
                {u.is_admin && <Badge variant="today">Admin</Badge>}
              </div>
            </Card>
          ))}
          {usuarios.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Nenhum usuário cadastrado</p>
          )}
        </div>
      )}
    </div>
  )
}
