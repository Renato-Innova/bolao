'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('users').insert({ id: data.user.id, email, nome, telefone: telefone || null, is_admin: false })
    }
    // If email confirmation is required the session is null until the user clicks the link.
    // Show a confirmation message instead of redirecting to a protected page.
    if (!data.session) {
      setLoading(false)
      setError('')
      setShowConfirmation(true)
      return
    }
    router.push('/dashboard'); router.refresh()
  }

  const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }

  return (
    <div className="auth-page" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-60%)', width: 600, height: 400, background: 'radial-gradient(ellipse,rgba(74,144,217,0.12) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, lineHeight: 1 }}>
          <span className="auth-logo-26" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 56, color: 'white', letterSpacing: -3, lineHeight: 1 }}>2</span>
          <span className="auth-logo-trophy" style={{ fontSize: 33, marginBottom: 3, marginLeft: -5, filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.4))' }}>🏆</span>
          <span className="auth-logo-26" style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 56, color: 'white', letterSpacing: -3, lineHeight: 1 }}>6</span>
        </div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 12, color: 'white', letterSpacing: 4, marginTop: 3 }}>FIFA</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', letterSpacing: 2, fontWeight: 500, textTransform: 'uppercase' }}>World Cup™ 2026</div>
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>Bolão Oficial dos Amigos</div>
      </div>

      <div className="auth-card" style={{ width: '100%', maxWidth: 420, background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 12, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4A90D9,#7BB8F0,#4A90D9)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(74,144,217,0.18)' }}>
          <Link href="/auth/login" style={{ display: 'block', padding: 14, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, textDecoration: 'none' }}>Entrar</Link>
          <span style={{ padding: 14, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5, background: 'rgba(74,144,217,0.08)', borderBottom: '2px solid #4A90D9' }}>Cadastrar</span>
        </div>
        <div style={{ padding: '22px 28px 24px' }}>
          {showConfirmation ? (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 8 }}>Confirme seu e-mail</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
                Enviamos um link de confirmação para <strong style={{ color: 'white' }}>{email}</strong>.<br />
                Clique no link para ativar sua conta e fazer login.
              </div>
              <Link href="/auth/login"
                style={{ display: 'inline-block', background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', borderRadius: 8, padding: '10px 24px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, textDecoration: 'none' }}>
                Ir para o login
              </Link>
            </div>
          ) : (
          <>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>Criar conta</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 16, lineHeight: 1.5 }}>Preencha seus dados pra participar do bolão.</div>

          <div style={{ background: 'rgba(74,144,217,0.07)', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#7BB8F0', marginBottom: 16, lineHeight: 1.5 }}>
            Acesso gratuito · Palpite ativo custa R$ 30,00 via PIX
          </div>

          <form onSubmit={handleSubmit}>
            {[
              { label: 'Nome completo', value: nome, setter: setNome, type: 'text', placeholder: 'Seu nome', auto: 'name' },
              { label: 'Email', value: email, setter: setEmail, type: 'email', placeholder: 'seu@email.com', auto: 'email' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 13 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} required placeholder={f.placeholder} autoComplete={f.auto}
                  className="auth-input" style={inputStyle} />
              </div>
            ))}

            <div style={{ marginBottom: 13 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>WhatsApp</label>
              <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999"
                className="auth-input" style={inputStyle} />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Para contato em caso de premiação</div>
            </div>

            {/* password fields — 2-col on desktop, stacked on mobile */}
            <div className="auth-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              <div style={{ marginBottom: 13 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="new-password"
                    className="auth-input" style={{ ...inputStyle, paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 13 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Confirmar senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••" autoComplete="new-password"
                    className="auth-input" style={{ ...inputStyle, paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(255,130,130,0.9)' }}>{error}</div>}

            <button type="submit" disabled={loading}
              className="auth-btn" style={{ width: '100%', background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', borderRadius: 8, padding: 13, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', fontFamily: 'Inter,sans-serif', marginTop: 4 }}>
              {loading ? 'Cadastrando...' : 'Criar conta'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.40)', marginTop: 16 }}>
            Já tem conta?{' '}
            <Link href="/auth/login" style={{ color: '#7BB8F0', textDecoration: 'none', fontWeight: 600 }}>Entrar</Link>
          </div>
          </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', position: 'relative', zIndex: 1 }}>FIFA World Cup 2026™ · EUA · Canadá · México</div>
    </div>
  )
}
