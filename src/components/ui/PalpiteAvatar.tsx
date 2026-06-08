'use client'

import Image from 'next/image'

export const CAMISA_OPTIONS = [
  { value: 'Brasil',     label: 'Brasil'     },
  { value: 'Argentina',  label: 'Argentina'  },
  { value: 'França',     label: 'França'     },
  { value: 'Espanha',    label: 'Espanha'    },
  { value: 'Alemanha',   label: 'Alemanha'   },
  { value: 'Inglaterra', label: 'Inglaterra' },
  { value: 'Portugal',   label: 'Portugal'   },
  { value: 'Itália',     label: 'Itália'     },
  { value: 'Croácia',    label: 'Croácia'    },
  { value: 'Bélgica',    label: 'Bélgica'    },
  { value: 'Colômbia',   label: 'Colômbia'   },
  { value: 'Uruguai',    label: 'Uruguai'    },
  { value: 'México',     label: 'México'     },
  { value: 'EUA',        label: 'EUA'        },
  { value: 'Chile',      label: 'Chile'      },
  { value: 'Japão',      label: 'Japão'      },
]

export const EMOJI_OPTIONS = [
  // Animais
  '🦁', '🐺', '🦊', '🐯', '🦅', '🦈', '🐙', '🦏',
  // Futebol / Copa
  '⚽', '🏆', '🥇', '🧤', '🎯', '🔥',
  // Personagens
  '🤖', '👽', '🥷', '🤡', '🦸', '🎭',
]

/* Deterministic color from string — used for initials fallback */
function nameToColor(name: string): string {
  const COLORS = [
    '#1a5ca8', '#2d7a3a', '#7c3aed', '#b45309',
    '#be185d', '#0e7490', '#7f1d1d', '#065f46',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

interface PalpiteAvatarProps {
  nome: string
  avatarType?: string | null
  avatarValue?: string | null
  size?: number
}

export function PalpiteAvatar({ nome, avatarType, avatarValue, size = 40 }: PalpiteAvatarProps) {
  const radius = size * 0.22

  /* ── Camisa ── */
  if (avatarType === 'camisa' && avatarValue) {
    const src = `/avatar/Camiseta_${avatarValue}.png`
    return (
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: 'rgba(74,144,217,0.08)',
        border: '1px solid rgba(74,144,217,0.25)',
        overflow: 'hidden', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Image src={src} alt={avatarValue} width={size} height={size}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
      </div>
    )
  }

  /* ── Emoji ── */
  if (avatarType === 'emoji' && avatarValue) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius,
        background: 'rgba(74,144,217,0.08)',
        border: '1px solid rgba(74,144,217,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.52, flexShrink: 0, userSelect: 'none',
      }}>
        {avatarValue}
      </div>
    )
  }

  /* ── Initials fallback ── */
  const bg = nameToColor(nome)
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 800, color: 'white',
      flexShrink: 0, userSelect: 'none', fontFamily: 'Inter, sans-serif',
      letterSpacing: -0.5,
    }}>
      {initials(nome)}
    </div>
  )
}
