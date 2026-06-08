'use client'

import { useState } from 'react'
import Image from 'next/image'
import { CAMISA_OPTIONS, EMOJI_OPTIONS, PalpiteAvatar } from './PalpiteAvatar'

interface AvatarPickerProps {
  nome: string
  currentType?: string | null
  currentValue?: string | null
  onSave: (type: string, value: string) => void
  onClose: () => void
  saving?: boolean
}

export function AvatarPicker({ nome, currentType, currentValue, onSave, onClose, saving }: AvatarPickerProps) {
  const [tab, setTab] = useState<'camisa' | 'emoji'>(
    currentType === 'emoji' ? 'emoji' : 'camisa'
  )
  const [selType, setSelType]   = useState(currentType ?? 'initials')
  const [selValue, setSelValue] = useState(currentValue ?? '')

  function select(type: string, value: string) {
    setSelType(type)
    setSelValue(value)
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.6,
    background: active ? 'rgba(74,144,217,0.18)' : 'transparent',
    border: 'none', borderBottom: active ? '2px solid #4A90D9' : '2px solid transparent',
    color: active ? '#7BB8F0' : 'rgba(255,255,255,0.4)',
    cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.3)',
        borderRadius: 14, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Escolher avatar</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 10px' }}>
          <PalpiteAvatar nome={nome} avatarType={selType} avatarValue={selValue} size={64} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(74,144,217,0.15)', margin: '0 20px' }}>
          <button style={tabStyle(tab === 'camisa')} onClick={() => setTab('camisa')}>⚽ Camisetas</button>
          <button style={tabStyle(tab === 'emoji')}  onClick={() => setTab('emoji')}>😄 Emojis</button>
        </div>

        {/* Content */}
        <div style={{ padding: '14px 20px', maxHeight: 260, overflowY: 'auto' }}>

          {tab === 'camisa' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {CAMISA_OPTIONS.map(opt => {
                const active = selType === 'camisa' && selValue === opt.value
                return (
                  <button key={opt.value} onClick={() => select('camisa', opt.value)}
                    style={{
                      background: active ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${active ? '#4A90D9' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8, padding: '8px 4px 6px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s',
                    }}>
                    <Image src={`/avatar/Camiseta_${opt.value}.png`} alt={opt.label}
                      width={44} height={44} style={{ objectFit: 'contain' }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: active ? '#7BB8F0' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'emoji' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {EMOJI_OPTIONS.map(emoji => {
                const active = selType === 'emoji' && selValue === emoji
                return (
                  <button key={emoji} onClick={() => select('emoji', emoji)}
                    style={{
                      background: active ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${active ? '#4A90D9' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8, padding: '10px 0', cursor: 'pointer',
                      fontSize: 24, textAlign: 'center',
                      transition: 'all 0.15s',
                    }}>
                    {emoji}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid rgba(74,144,217,0.1)' }}>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', padding: '9px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Cancelar
          </button>
          <button onClick={() => onSave(selType, selValue)} disabled={saving || !selValue}
            style={{
              background: (!selValue || saving) ? 'rgba(74,144,217,0.2)' : 'linear-gradient(90deg,#4A90D9,#1a5ca8)',
              border: 'none', color: 'white', padding: '9px 22px', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: (!selValue || saving) ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter,sans-serif',
            }}>
            {saving ? 'Salvando…' : 'Salvar avatar'}
          </button>
        </div>
      </div>
    </div>
  )
}
