'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    // Usa implicit flow para o reset: evita o problema do PKCE code verifier
    // não estar disponível quando o email abre em browser diferente (Gmail app, etc.)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: 'implicit' } }
    )
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/nova-senha`,
    })
    if (error) {
      setError('Não foi possível enviar o email. Verifique o endereço e tente novamente.')
      setLoading(false); return
    }
    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="auth-page" style={{
      position: 'relative', zIndex: 1, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px',
    }}>
      {/* glow */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-60%)', width: 600, height: 400, background: 'radial-gradient(ellipse,rgba(74,144,217,0.12) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, lineHeight: 1 }}>
          <span className="auth-logo-26" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 52, color: 'white', letterSpacing: -3, lineHeight: 1 }}>2</span>
          <span className="auth-logo-trophy" style={{ fontSize: 38, marginBottom: 4, marginLeft: -6, filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.4))' }}>🏆</span>
          <span className="auth-logo-26" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 52, color: 'white', letterSpacing: -3, lineHeight: 1 }}>6</span>
        </div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, color: 'white', letterSpacing: 4, marginTop: 4 }}>FIFA</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', letterSpacing: 2, fontWeight: 500, textTransform: 'uppercase', marginTop: 2 }}>World Cup™ 2026</div>
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>Bolão Oficial dos Amigos</div>
      </div>

      {/* card */}
      <div className="auth-card" style={{ width: '100%', maxWidth: 400, background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 12, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4A90D9,#7BB8F0,#4A90D9)' }} />
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(74,144,217,0.18)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 }}>Recuperar senha</span>
        </div>
        <div style={{ padding: 20 }}>
          {success ? (
            <div>
              <div style={{ marginBottom: 20, padding: '12px 14px', background: 'rgba(74,217,144,0.1)', border: '1px solid rgba(74,217,144,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(130,255,180,0.9)', lineHeight: 1.5 }}>
                Email enviado! Verifique sua caixa de entrada e siga o link para redefinir sua senha.
              </div>
              <Link href="/auth/login" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: '#7BB8F0', textDecoration: 'none', fontWeight: 600 }}>
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.5 }}>
                Informe seu email e enviaremos um link para você redefinir sua senha.
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" autoComplete="email"
                  className="auth-input" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
              </div>

              {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(255,130,130,0.9)' }}>{error}</div>}

              <button type="submit" disabled={loading}
                className="auth-btn" style={{ width: '100%', marginTop: 8, background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', borderRadius: 8, padding: 13, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>

              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>
                <Link href="/auth/login" style={{ color: '#7BB8F0', textDecoration: 'none', fontWeight: 600 }}>Voltar para o login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
