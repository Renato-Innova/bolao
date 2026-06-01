'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { FlagImg } from '@/components/ui/FlagImg'
import { formatDate, formatTime } from '@/lib/utils'
import { FASES } from '@/utils/constants'
import type { JogoCopa } from '@/types'

interface Props {
  jogos: JogoCopa[]
}

export function AdminResultadosClient({ jogos }: Props) {
  const supabase = createClient()
  const [editando, setEditando] = useState<string | null>(null)
  const [placarA, setPlacarA] = useState('')
  const [placarB, setPlacarB] = useState('')
  const [saving, setSaving] = useState(false)
  const [jogosList, setJogosList] = useState<JogoCopa[]>(jogos)
  const [filtroFase, setFiltroFase] = useState('grupos')

  async function salvarResultado(jogo: JogoCopa) {
    const a = parseInt(placarA)
    const b = parseInt(placarB)
    if (isNaN(a) || isNaN(b)) return

    setSaving(true)
    const { error } = await supabase
      .from('resultados')
      .upsert(
        { jogo_id: jogo.id, placar_real_a: a, placar_real_b: b },
        { onConflict: 'jogo_id' }
      )

    if (!error) {
      // Recalculate points for all palpites of this game
      const { data: palpitesJogos } = await supabase
        .from('palpites_jogos')
        .select('*')
        .eq('jogo_id', jogo.id)

      const { data: configs } = await supabase
        .from('configuracoes_pontuacao')
        .select('*')
        .eq('fase', jogo.fase)

      const pontosExato = configs?.find((c: { tipo_acerto: string }) => c.tipo_acerto === 'placar_exato')?.pontos ?? 3
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
          ? { ...j, resultado: { id: '', jogo_id: jogo.id, placar_real_a: a, placar_real_b: b, inserido_em: '', atualizado_em: '' } }
          : j
      ))
    }

    setEditando(null)
    setSaving(false)
  }

  function iniciarEdicao(jogo: JogoCopa) {
    setEditando(jogo.id)
    setPlacarA(jogo.resultado?.placar_real_a?.toString() ?? '')
    setPlacarB(jogo.resultado?.placar_real_b?.toString() ?? '')
  }

  const jogosFiltrados = jogosList.filter(j => j.fase === filtroFase)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div
        className="mb-6 p-5 rounded-xl"
        style={{
          background: 'linear-gradient(90deg, #04143a 0%, #091d50 50%, #0a1f4e 100%)',
          border: '1px solid rgba(74,144,217,0.18)',
        }}
      >
        <div className="flex items-center gap-3">
          <Badge variant="active">Admin</Badge>
          <div className="font-bebas text-2xl text-white">Inserir Resultados</div>
        </div>
        <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Insira o placar de cada jogo. Os pontos são calculados automaticamente.
        </div>
      </div>

      {/* Fase filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.entries(FASES).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltroFase(key)}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: filtroFase === key ? 'rgba(74,144,217,0.25)' : 'rgba(255,255,255,0.06)',
              color: filtroFase === key ? '#4A90D9' : 'rgba(255,255,255,0.5)',
              border: filtroFase === key ? '1px solid rgba(74,144,217,0.4)' : '1px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {jogosFiltrados.map(jogo => (
          <Card key={jogo.id} className="p-4" accent={false}>
            <div className="flex items-center gap-4">
              {/* Match info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <FlagImg codigo={jogo.codigo_pais_a} size={16} />
                  <span className="text-sm font-medium text-white">{jogo.time_a}</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>×</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white">{jogo.time_b}</span>
                  <FlagImg codigo={jogo.codigo_pais_b} size={16} />
                </div>
              </div>

              {/* Date */}
              <div className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {formatDate(jogo.data)} {formatTime(jogo.horario)}
              </div>

              {/* Result / Edit */}
              {editando === jogo.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={0}
                    value={placarA}
                    onChange={e => setPlacarA(e.target.value)}
                    className="w-10 h-8 text-center rounded text-sm font-bold outline-none"
                    style={{ background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.4)', color: '#4A90D9' }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>×</span>
                  <input
                    type="number"
                    min={0}
                    value={placarB}
                    onChange={e => setPlacarB(e.target.value)}
                    className="w-10 h-8 text-center rounded text-sm font-bold outline-none"
                    style={{ background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.4)', color: '#4A90D9' }}
                  />
                  <Button size="sm" onClick={() => salvarResultado(jogo)} disabled={saving}>
                    {saving ? '...' : 'Salvar'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>×</Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 shrink-0">
                  {jogo.resultado ? (
                    <span className="text-sm font-bold" style={{ color: '#4A90D9' }}>
                      {jogo.resultado.placar_real_a} × {jogo.resultado.placar_real_b}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Sem resultado</span>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => iniciarEdicao(jogo)}>
                    {jogo.resultado ? 'Editar' : 'Inserir'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {jogosFiltrados.length === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Nenhum jogo nesta fase
          </p>
        )}
      </div>
    </div>
  )
}
