import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'pix'
  size?: 'sm' | 'md' | 'lg'
}

const VARIANTS = {
  primary: 'text-white font-bold uppercase tracking-wide',
  secondary: 'font-medium',
  pix: 'text-white font-bold uppercase tracking-wide',
}

const VARIANT_STYLES = {
  primary: { background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)' },
  secondary: { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' },
  pix: { background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)' },
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded',
  md: 'px-5 py-2.5 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
}

export function Button({ variant = 'primary', size = 'md', className, style, ...props }: ButtonProps) {
  return (
    <button
      className={cn('transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed', VARIANTS[variant], SIZES[size], className)}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      {...props}
    />
  )
}
