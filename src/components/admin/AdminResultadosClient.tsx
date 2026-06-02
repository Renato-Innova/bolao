'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { FASES } from '@/utils/constants'
import type { JogoCopa } from '@/types'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

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

export function AdminResultadosClient({ jogos }: { jogos: JogoCopa[] }) {
  const supabase = createClient()
  const [jogosList, setJogosList] = useState<JogoCopa[]>(jogos)
  const [filtroFase, setFiltroFase] = useState<string>('grupos')
  const [editando, setEditando] = useState<number | null>(null)
  const [placarA, setPlacarA] = useState('')
  const [placarB, setPlacarB] = useState('')
  const [saving, setSaving] = useState(false)

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

  function iniciarEdicao(jogo: JogoCopa) {
    setEditando(jogo.id)
    setPlacarA(jogo.resultado?.placar_real_a?.toString() ?? '')
    setPlacarB(jogo.resultado?.placar_real_b?.toString() ?? '')
  }

  const jogosFiltrados = jogosList.filter(j => j.fase === filtroFase)

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
        <a href="/admin/configuracoes" style={{ fontSize: 11, color: '#4A90D9', background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 7, padding: '7px 14px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Configurações →
        </a>
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
          <div key={jogo.id} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>

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

            {/* Score / Edit */}
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
                <button onClick={() => iniciarEdicao(jogo)}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(74,144,217,0.25)', background: 'rgba(74,144,217,0.08)', color: '#7BB8F0', fontFamily: 'Inter,sans-serif' }}>
                  {jogo.resultado ? 'Editar' : 'Inserir'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
