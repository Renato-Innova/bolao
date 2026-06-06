'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PalpiteInativo {
  id: number
  nome: string
  status: string
  criado_em: string
  usuario: { nome: string; email: string } | null
}

export default function OperadorPage() {
  const router = useRouter()
  const [palpites, setPalpites] = useState<PalpiteInativo[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [authorized, setAuthorized] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('palpites')
      .select('id, nome, status, criado_em, usuario:users(nome, email)')
      .eq('status', 'inativo')
      .order('criado_em', { ascending: false })
    setPalpites((data ?? []) as unknown as PalpiteInativo[])
    setLoading(false)
  }, [])

  useEffect(() => {
    async function checkAccess() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('users').select('is_operador, is_admin').eq('id', user.id).single()

      if (!profile?.is_operador && !profile?.is_admin) {
        router.push('/dashboard')
        return
      }
      setAuthorized(true)
      load()
    }
    checkAccess()
  }, [router, load])

  async function handleAtivar(palpiteId: number, nomePalpite: string, nomeUsuario: string) {
    const ok = window.confirm(
      `Confirma a ativação do palpite?\n\n"${nomePalpite}" — ${nomeUsuario}\n\nEsta ação não pode ser desfeita.`
    )
    if (!ok) return

    setActivating(palpiteId)
    setError('')
    const res = await fetch('/api/operador/ativar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palpiteId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Erro ao ativar.')
    } else {
      setPalpites(prev => prev.filter(p => p.id !== palpiteId))
    }
    setActivating(null)
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (!authorized) return null

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4A90D9', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
          Painel do Operador
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>Ativação de Palpites</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
          Ative os palpites após confirmação do pagamento via PIX.
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 13, color: 'rgba(255,130,130,0.9)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.50)', fontSize: 13 }}>Carregando...</div>
      ) : palpites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Tudo em dia!</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Nenhum palpite aguardando ativação.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
            {palpites.length} palpite{palpites.length !== 1 ? 's' : ''} aguardando ativação
          </div>
          {palpites.map(p => (
            <div key={p.id} style={{
              background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.2)',
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 2 }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                  {p.usuario?.nome ?? '—'}
                  <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                  {p.usuario?.email ?? '—'}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>
                  Cadastrado em {formatDate(p.criado_em)}
                </div>
              </div>
              <button
                onClick={() => handleAtivar(p.id, p.nome, p.usuario?.nome ?? p.usuario?.email ?? '?')}
                disabled={activating === p.id}
                style={{
                  background: activating === p.id ? 'rgba(74,144,217,0.2)' : 'linear-gradient(90deg,#4A90D9,#1a5ca8)',
                  color: 'white', border: 'none', borderRadius: 8,
                  padding: '8px 18px', fontSize: 12, fontWeight: 700,
                  cursor: activating === p.id ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {activating === p.id ? 'Ativando...' : 'Ativar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
