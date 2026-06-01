'use client'

import { useState, useRef } from 'react'
import { FlagImg } from '@/components/ui/FlagImg'
import { formatDate, formatTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { JogoCopa, PalpiteJogo } from '@/types'

interface Props {
  jogo: JogoCopa
  palpiteJogo?: PalpiteJogo
  palpiteId: string
}

export function JogoCard({ jogo, palpiteJogo, palpiteId }: Props) {
  const supabase = createClient()
  const temResultado = !!jogo.resultado

  const [placarA, setPlacarA] = useState<string>(
    palpiteJogo?.placar_palpite_a != null ? String(palpiteJogo.placar_palpite_a) : ''
  )
  const [placarB, setPlacarB] = useState<string>(
    palpiteJogo?.placar_palpite_b != null ? String(palpiteJogo.placar_palpite_b) : ''
  )
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function save(a: string, b: string) {
    if (a === '' || b === '') return
    const na = parseInt(a)
    const nb = parseInt(b)
    if (isNaN(na) || isNaN(nb)) return

    setSaving(true)
    if (palpiteJogo?.id) {
      await supabase
        .from('palpites_jogos')
        .update({ placar_palpite_a: na, placar_palpite_b: nb })
        .eq('id', palpiteJogo.id)
    } else {
      await supabase
        .from('palpites_jogos')
        .upsert(
          { palpite_id: palpiteId, jogo_id: jogo.id, placar_palpite_a: na, placar_palpite_b: nb, pontos: 0 },
          { onConflict: 'palpite_id,jogo_id' }
        )
    }
    setSaving(false)
  }

  function handleChange(setter: (v: string) => void, otherVal: string, newVal: string, isA: boolean) {
    const cleaned = newVal.replace(/\D/g, '').slice(0, 2)
    setter(cleaned)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      save(isA ? cleaned : otherVal, isA ? otherVal : cleaned)
    }, 800)
  }

  const pontos = palpiteJogo?.pontos
  const hasPalpite = palpiteJogo?.placar_palpite_a != null && palpiteJogo?.placar_palpite_b != null

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg transition-all"
      style={{
        background: temResultado ? 'rgba(74,144,217,0.04)' : 'var(--color-bg-card)',
        border: `1px solid ${temResultado ? 'rgba(74,144,217,0.12)' : 'rgba(74,144,217,0.1)'}`,
        opacity: temResultado ? 0.9 : 1,
      }}
    >
      {/* Time A */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-sm font-medium text-white truncate text-right">{jogo.time_a}</span>
        <FlagImg codigo={jogo.codigo_pais_a} size={18} />
      </div>

      {/* Placares */}
      <div className="flex items-center gap-2 shrink-0">
        {temResultado ? (
          <>
            {/* Real result */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
                style={{ background: 'rgba(74,144,217,0.15)', color: '#7BB8F0' }}
              >
                {jogo.resultado?.placar_real_a}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>×</span>
              <span
                className="w-8 h-8 flex items-center justify-center rounded text-sm font-bold"
                style={{ background: 'rgba(74,144,217,0.15)', color: '#7BB8F0' }}
              >
                {jogo.resultado?.placar_real_b}
              </span>
            </div>
            {/* User prediction */}
            {hasPalpite && (
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
                <span className="text-xs" style={{ color: pontos! > 0 ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
                  {placarA}×{placarB}
                </span>
                {pontos! > 0 && (
                  <span className="text-xs font-bold ml-1" style={{ color: '#4ade80' }}>+{pontos}</span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <input
              type="number"
              min={0}
              max={99}
              value={placarA}
              onChange={e => handleChange(setPlacarA, placarB, e.target.value, true)}
              disabled={temResultado}
              className="w-8 h-8 text-center rounded text-sm font-bold outline-none"
              style={{
                border: '1px solid rgba(74,144,217,0.4)',
                borderRadius: '6px',
                background: 'rgba(74,144,217,0.08)',
                color: '#4A90D9',
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>×</span>
            <input
              type="number"
              min={0}
              max={99}
              value={placarB}
              onChange={e => handleChange(setPlacarB, placarA, e.target.value, false)}
              disabled={temResultado}
              className="w-8 h-8 text-center rounded text-sm font-bold outline-none"
              style={{
                border: '1px solid rgba(74,144,217,0.4)',
                borderRadius: '6px',
                background: 'rgba(74,144,217,0.08)',
                color: '#4A90D9',
              }}
            />
          </>
        )}
      </div>

      {/* Time B */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FlagImg codigo={jogo.codigo_pais_b} size={18} />
        <span className="text-sm font-medium text-white truncate">{jogo.time_b}</span>
      </div>

      {/* Date/time or saving indicator */}
      <div className="text-right shrink-0 w-16">
        {saving ? (
          <span className="text-xs" style={{ color: '#4A90D9' }}>●</span>
        ) : (
          <>
            <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatDate(jogo.data)}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatTime(jogo.horario)}</div>
          </>
        )}
      </div>
    </div>
  )
}
