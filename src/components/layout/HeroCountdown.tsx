'use client'

import { useEffect, useState } from 'react'

export function HeroCountdown({ firstGameISO }: { firstGameISO: string }) {
  // null until mounted — avoids server/client mismatch (hydration error)
  const [diff, setDiff] = useState<number | null>(null)

  useEffect(() => {
    const target = Date.parse(firstGameISO)
    setDiff(target - Date.now())
    const id = setInterval(() => setDiff(target - Date.now()), 1000)
    return () => clearInterval(id)
  }, [firstGameISO])

  // render nothing until client mounts (matches server output)
  if (diff === null) return null

  if (diff <= 0) return (
    <div style={{ width: 10, height: 10, background: '#4ade80', borderRadius: '50%', flexShrink: 0 }} />
  )

  const totalSecs = Math.floor(diff / 1000)
  const days      = Math.floor(totalSecs / 86400)
  const hours     = Math.floor((totalSecs % 86400) / 3600)
  const mins      = Math.floor((totalSecs % 3600) / 60)
  const secs      = totalSecs % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ position: 'relative', width: 12, height: 12, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, background: '#f97316',
          borderRadius: '50%', animation: 'hero-ping 1.2s ease-in-out infinite', opacity: 0.5,
        }} />
        <div style={{ position: 'absolute', inset: 1, background: '#fb923c', borderRadius: '50%' }} />
      </div>
      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
        Copa em{' '}
        <span style={{ color: '#fb923c', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {days}d {pad(hours)}:{pad(mins)}:{pad(secs)}
        </span>
      </span>
      <style>{`
        @keyframes hero-ping {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50%       { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
