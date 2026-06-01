'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('Email ainda não confirmado. Verifique sua caixa de entrada.')
      } else {
        setError('Email ou senha incorretos.')
      }
      setLoading(false); return
    }
    router.push('/dashboard'); router.refresh()
  }

  return (
    <div className="auth-page" style={{
      position: 'relative', zIndex: 1, minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* glow */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-60%)', width: 600, height: 400, background: 'radial-gradient(ellipse,rgba(74,144,217,0.12) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, lineHeight: 1 }}>
          <span className="auth-logo-26" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 64, color: 'white', letterSpacing: -3, lineHeight: 1 }}>2</span>
          <span className="auth-logo-trophy" style={{ fontSize: 38, marginBottom: 4, marginLeft: -6, filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.4))' }}>🏆</span>
          <span className="auth-logo-26" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 64, color: 'white', letterSpacing: -3, lineHeight: 1 }}>6</span>
        </div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, color: 'white', letterSpacing: 4, marginTop: 4 }}>FIFA</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', letterSpacing: 2, fontWeight: 500, textTransform: 'uppercase', marginTop: 2 }}>World Cup™ 2026</div>
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>Bolão Oficial dos Amigos</div>
      </div>

      {/* card */}
      <div className="auth-card" style={{ width: '100%', maxWidth: 400, background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 12, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4A90D9,#7BB8F0,#4A90D9)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(74,144,217,0.18)' }}>
          <span style={{ padding: 14, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5, background: 'rgba(74,144,217,0.08)', borderBottom: '2px solid #4A90D9' }}>Entrar</span>
          <Link href="/auth/register" style={{ display: 'block', padding: 14, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, textDecoration: 'none' }}>Cadastrar</Link>
        </div>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>Bem-vindo de volta</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 22, lineHeight: 1.5 }}>Entre com seu email e senha pra acessar seus palpites.</div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" autoComplete="email"
                className="auth-input" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password"
                className="auth-input" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
            </div>

            {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(255,130,130,0.9)' }}>{error}</div>}

            <button type="submit" disabled={loading}
              className="auth-btn" style={{ width: '100%', background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', borderRadius: 8, padding: 13, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(74,144,217,0.18)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(74,144,217,0.18)' }} />
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>
            Ainda não tem conta?{' '}
            <Link href="/auth/register" style={{ color: '#7BB8F0', textDecoration: 'none', fontWeight: 600 }}>Cadastre-se</Link>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', position: 'relative', zIndex: 1 }}>FIFA World Cup 2026™ · EUA · Canadá · México</div>
    </div>
  )
}
