'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ─────────────────────────────────────────────────────────────────────────────
   Fluxo de recuperação de senha (client-side PKCE):
   1. esqueci-senha → redirectTo: /auth/nova-senha (direto, sem callback)
   2. Supabase envia email → link abre /auth/nova-senha?code=xxx
   3. Esta página troca o code CLIENT-SIDE (browser tem o code_verifier nos cookies)
   4. Sessão fica no browser → updateUser funciona sem 422
   ───────────────────────────────────────────────────────────────────────────── */

function NovaSenhaForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [ready, setReady]               = useState(false)
  const [debug, setDebug]               = useState<Record<string, string>>({})

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    // ── Fluxo implicit: token chega no hash (#access_token=...) ──────────────
    // Usado quando resetPasswordForEmail é chamado com flowType: 'implicit'
    // Funciona independente do browser que abre o email (sem code verifier)
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.slice(1))
      const access_token  = params.get('access_token')
      const refresh_token = params.get('refresh_token') ?? ''
      const type          = params.get('type')

      setDebug({ flow: 'implicit (hash)', type: type ?? '?', has_token: access_token ? 'sim' : 'não' })

      if (access_token && type === 'recovery') {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error: err }) => {
          if (err) setError(`Erro ao estabelecer sessão: ${err.message}`)
          else setReady(true)
        })
        return
      }
    }

    // ── Fluxo PKCE: token chega como ?code= (mesmo browser) ──────────────────
    setDebug({ flow: 'pkce (code)', code: code ?? '(null)', error_param: errorParam ?? '(null)' })

    if (errorParam) {
      setError('Link inválido ou expirado. Solicite um novo link.')
      return
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error: err }) => {
        setDebug(prev => ({ ...prev, user: data.session?.user.email ?? 'null', err: err?.message ?? 'none' }))
        if (err) setError(`Erro: ${err.message}`)
        else setReady(true)
      })
      return
    }

    // ── Fallback: aguarda evento PASSWORD_RECOVERY ────────────────────────────
    setDebug({ flow: 'aguardando evento...' })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setReady(true); subscription.unsubscribe() }
    })
    const timer = setTimeout(() => {
      subscription.unsubscribe()
      setError('Link inválido ou expirado. Solicite um novo link de redefinição.')
    }, 8000)
    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true); setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('Não foi possível atualizar a senha. Tente novamente ou solicite um novo link.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(74,144,217,0.18)', borderRadius: 8,
    padding: '11px 40px 11px 14px', fontSize: 14, color: 'white',
    fontFamily: 'Inter,sans-serif', outline: 'none',
  }

  return (
    <div className="auth-page" style={{
      position: 'relative', zIndex: 1, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-60%)', width: 600, height: 400, background: 'radial-gradient(ellipse,rgba(74,144,217,0.12) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

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

      <div className="auth-card" style={{ width: '100%', maxWidth: 400, background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.18)', borderRadius: 12, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4A90D9,#7BB8F0,#4A90D9)' }} />
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(74,144,217,0.18)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nova senha</span>
        </div>
        <div style={{ padding: 20 }}>

          {/* ── Erro — sempre visível ── */}
          {error && (
            <div style={{ padding: '12px 14px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(255,130,130,0.9)', lineHeight: 1.6 }}>
              {error}
              <div style={{ marginTop: 10 }}>
                <a href="/auth/esqueci-senha" style={{ color: '#7BB8F0', fontWeight: 600, textDecoration: 'underline' }}>
                  Solicitar novo link
                </a>
              </div>
            </div>
          )}

          {/* ── Debug temporário ── */}
          {!ready && !error && (
            <div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 12 }}>
                Verificando link… aguarde.
              </p>
              {Object.keys(debug).length > 0 && (
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', lineHeight: 1.8, background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }}>
                  {Object.entries(debug).map(([k, v]) => (
                    <div key={k}><span style={{ color: 'rgba(255,200,0,0.6)' }}>{k}:</span> {v}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Formulário ── */}
          {ready && !error && (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Nova senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="new-password" className="auth-input" style={inputStyle} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Confirmar senha</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" autoComplete="new-password" className="auth-input" style={inputStyle} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 0, display: 'flex', alignItems: 'center' }}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="auth-btn" style={{ width: '100%', background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', borderRadius: 8, padding: 13, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}

export default function NovaSenhaPage() {
  return (
    <Suspense>
      <NovaSenhaForm />
    </Suspense>
  )
}
