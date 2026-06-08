'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/dashboard',  icon: '🏠', label: 'Início' },
  { href: '/tabela',     icon: '📊', label: 'Tabela' },
  { href: '/palpites',   icon: '✏️',  label: 'Meus Palpites' },
  { href: '/ranking',    icon: '🏆', label: 'Ranking' },
  { href: '/instrucoes', icon: '📋', label: 'Regras' },
]

export function BottomNav() {
  const pathname = usePathname()
  if (pathname.startsWith('/auth')) return null
  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ href, icon, label }) => (
        <Link key={href} href={href} className={`bn-item${isActive(href) ? ' bn-on' : ''}`}>
          <span className="bn-icon">{icon}</span>
          <span className="bn-label">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
