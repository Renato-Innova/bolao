import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean
}

export function Card({ accent = true, className, style, children, ...props }: CardProps) {
  return (
    <div
      className={cn('relative rounded-lg overflow-hidden', className)}
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        ...style,
      }}
      {...props}
    >
      {accent && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)',
          }}
        />
      )}
      {children}
    </div>
  )
}
