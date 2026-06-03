'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/tabela',     label: 'Tabela' },
  { href: '/palpites',   label: 'Palpites' },
  { href: '/ranking',    label: 'Ranking' },
  { href: '/instrucoes', label: 'Instruções' },
]

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function Header() {
  const pathname = usePathname()
  const [user, setUser]     = useState<User | null>(null)
  const [nome, setNome]     = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('users').select('nome, is_admin').eq('id', data.user.id).maybeSingle()
          .then(({ data: u }) => { if (u) { setNome(u.nome); setIsAdmin(!!u.is_admin) } })
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) { setNome(''); setIsAdmin(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  if (pathname.startsWith('/auth')) return null

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(2,15,42,0.96)',
      borderBottom: '1px solid rgba(74,144,217,0.15)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      height: 60,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 20,
    }}>
      {/* Mobile hamburger — left side */}
      <button onClick={() => setMenuOpen(!menuOpen)} className="show-mobile"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'none', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 5, width: 36, height: 36, flexShrink: 0 }}>
        <span style={{ display: 'block', width: 22, height: 2, borderRadius: 2, background: 'white' }} />
        <span style={{ display: 'block', width: 22, height: 2, borderRadius: 2, background: 'white' }} />
        <span style={{ display: 'block', width: 22, height: 2, borderRadius: 2, background: 'white' }} />
      </button>

      {/* Logo */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: 'white', letterSpacing: -2, lineHeight: 1 }}>26</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 9, color: 'white', letterSpacing: 3 }}>FIFA</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.5, fontWeight: 500 }}>WORLD CUP™</span>
        </div>
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.12)' }} />
        <div>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>Bolão Copa 2026</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, marginTop: 1 }}>EUA · CAN · MEX · 11 jun – 19 jul</div>
        </div>
      </Link>

      {/* Desktop Nav — centered */}
      <nav style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }} className="hidden-mobile">
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href} style={{
            color: isActive(href) ? 'white' : 'rgba(255,255,255,0.45)',
            fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.6,
            padding: '6px 12px', borderRadius: 6,
            textDecoration: 'none',
            background: isActive(href) ? 'rgba(255,255,255,0.08)' : 'transparent',
          }}>
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link href="/admin/resultados" style={{
            color: pathname.startsWith('/admin') ? '#4ade80' : 'rgba(74,222,128,0.7)',
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6,
            padding: '6px 12px', borderRadius: 6, textDecoration: 'none',
            background: pathname.startsWith('/admin') ? 'rgba(74,222,128,0.08)' : 'transparent',
          }}>Admin</Link>
        )}
      </nav>

      {/* User area */}
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            {nome.split(' ')[0]} {nome.split(' ').slice(-1)[0] !== nome.split(' ')[0] ? nome.split(' ').slice(-1)[0][0] + '.' : ''}
          </span>
          <div
            onClick={handleLogout}
            title="Sair"
            style={{
              width: 34, height: 34,
              background: 'linear-gradient(135deg, #4A90D9, #1a5ca8)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {nome ? initials(nome) : '?'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Link href="/auth/login" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontWeight: 500 }}>Entrar</Link>
          <Link href="/auth/register" style={{
            fontSize: 12, fontWeight: 700, color: 'white', textDecoration: 'none',
            background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)',
            padding: '6px 14px', borderRadius: 6,
          }}>Cadastrar</Link>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 60, left: 0, right: 0,
          background: '#0D1E3D', borderBottom: '1px solid rgba(74,144,217,0.15)',
          padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 200,
        }}>
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{
              color: isActive(href) ? '#4A90D9' : 'rgba(255,255,255,0.7)',
              fontSize: 13, fontWeight: 600, textDecoration: 'none', padding: '6px 0',
            }}>{label}</Link>
          ))}
          {user && <button onClick={handleLogout} style={{ textAlign: 'left', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', padding: '6px 0', fontFamily: 'Inter, sans-serif' }}>Sair</button>}
        </div>
      )}
    </header>
  )
}
