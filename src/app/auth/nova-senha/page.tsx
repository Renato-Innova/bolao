'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function NovaSenhaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Supabase envia a sessão de duas formas:
  // 1. Hash (#access_token=...&type=recovery) — dispara evento PASSWORD_RECOVERY
  // 2. PKCE (?code=...) — sessão já foi trocada pelo callback; verificar getUser()
  useEffect(() => {
    const supabase = createClient()

    // Verifica se já há sessão ativa de recovery (fluxo PKCE via callback)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setReady(true)
    })

    // Aguarda evento para o fluxo hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Não foi possível atualizar a senha. Tente novamente.')
      setLoading(false); return
    }
    router.push('/dashboard')
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
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nova senha</span>
        </div>
        <div style={{ padding: 20 }}>
          {!ready ? (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Verificando link… aguarde.</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Nova senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="new-password"
                    className="auth-input" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 8, padding: '11px 40px 11px 14px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Confirmar senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" autoComplete="new-password"
                    className="auth-input" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 8, padding: '11px 40px 11px 14px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(255,130,130,0.9)' }}>{error}</div>}

              <button type="submit" disabled={loading}
                className="auth-btn" style={{ width: '100%', marginTop: 8, background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', borderRadius: 8, padding: 13, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
