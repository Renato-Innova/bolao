import { HTMLAttributes } from 'react'

type BadgeVariant = 'active' | 'inactive' | 'phase' | 'finished' | 'today'

const STYLES: Record<BadgeVariant, React.CSSProperties> = {
  active: { background: 'rgba(74,222,128,0.15)', color: '#4ade80' },
  inactive: { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' },
  phase: { background: 'rgba(74,144,217,0.18)', border: '1px solid rgba(74,144,217,0.35)', color: '#7BB8F0' },
  finished: { background: 'rgba(74,144,217,0.15)', color: '#7BB8F0' },
  today: { background: 'rgba(74,222,128,0.15)', color: '#4ade80' },
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'phase', className, style, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className ?? ''}`}
      style={{ ...STYLES[variant], ...style }}
      {...props}
    />
  )
}
