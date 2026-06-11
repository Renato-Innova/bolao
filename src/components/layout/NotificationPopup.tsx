'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

/** Data atual em BRT (UTC-3) no formato YYYY-MM-DD */
function hoje(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
}

const DISMISS_KEY = () => `bolao_aviso_${hoje()}`

/* ─── Tipos ──────────────────────────────────────────────────────────────────── */

interface Aviso {
  tipo: 'especiais' | 'jogos_hoje'
  palpite: string
  detalhes: string
}

/* ─── Componente ─────────────────────────────────────────────────────────────── */

export function NotificationPopup() {
  const [avisos, setAvisos]       = useState<Aviso[]>([])
  const [visivel, setVisivel]     = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    // Se já dispensou hoje, não mostrar
    if (localStorage.getItem(DISMISS_KEY())) return

    const supabase = createClient()

    async function verificar() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const dataHoje = hoje()

        // Busca palpites ativos do usuário com dados especiais e jogos de hoje
        const [{ data: palpites }, { data: jogosHoje }, { data: sysConfig }] = await Promise.all([
          supabase
            .from('palpites')
            .select('id, nome, campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro')
            .eq('usuario_id', user.id)
            .eq('status', 'ativo'),

          supabase
            .from('jogos_copa')
            .select('id, fase, horario')
            .eq('data', dataHoje)
            .eq('fase', 'GS'),   // só fase de grupos tem prazo de palpite por dia

          supabase
            .from('configuracoes_sistema')
            .select('especiais_deadline')
            .eq('id', 1)
            .maybeSingle(),
        ])

        if (!palpites || palpites.length === 0) return

        const found: Aviso[] = []

        // ── Aviso 1: Palpites especiais incompletos ──────────────────────────
        // Só avisar se ainda não passou o deadline (ou se não tem deadline configurado)
        const especiaisDeadline = sysConfig?.especiais_deadline
          ? new Date(sysConfig.especiais_deadline)
          : null
        const especiaisExpirado = especiaisDeadline ? new Date() >= especiaisDeadline : false

        if (!especiaisExpirado) {
          for (const p of palpites) {
            const faltando = []
            if (!p.campeao)        faltando.push('Campeão')
            if (!p.vice_campeao)   faltando.push('Vice-campeão')
            if (!p.artilheiro)     faltando.push('Artilheiro')
            if (!p.melhor_jogador) faltando.push('Melhor Jogador')
            if (!p.melhor_goleiro) faltando.push('Melhor Goleiro')

            if (faltando.length > 0) {
              found.push({
                tipo: 'especiais',
                palpite: p.nome,
                detalhes: `Faltam: ${faltando.join(', ')}`,
              })
            }
          }
        }

        // ── Aviso 2: Jogos de hoje não preenchidos ───────────────────────────
        if (jogosHoje && jogosHoje.length > 0) {
          // Filtra jogos que ainda não começaram (horário BRT)
          const agora = Date.now()
          const jogosPendentes = jogosHoje.filter(j => {
            const kickoff = new Date(`${dataHoje}T${j.horario}-03:00`).getTime()
            return agora < kickoff  // jogo ainda não começou
          })

          if (jogosPendentes.length > 0) {
            const jogoIds = jogosPendentes.map(j => j.id)

            for (const p of palpites) {
              const { data: palpitesJogos } = await supabase
                .from('palpites_jogos')
                .select('jogo_id, submitted_at')
                .eq('palpite_id', p.id)
                .in('jogo_id', jogoIds)

              const naoEnviados = jogosPendentes.filter(j =>
                !palpitesJogos?.find(pj => pj.jogo_id === j.id && pj.submitted_at)
              )

              if (naoEnviados.length > 0) {
                found.push({
                  tipo: 'jogos_hoje',
                  palpite: p.nome,
                  detalhes: `${naoEnviados.length} jogo${naoEnviados.length > 1 ? 's' : ''} sem palpite hoje`,
                })
              }
            }
          }
        }

        if (found.length > 0) {
          setAvisos(found)
          setVisivel(true)
        }
      } finally {
        setCarregando(false)
      }
    }

    verificar()
  }, [])

  // Dispensa permanentemente hoje (salva no localStorage)
  function dispensarHoje() {
    localStorage.setItem(DISMISS_KEY(), '1')
    setVisivel(false)
  }

  // Fecha o popup agora mas volta a mostrar na próxima visita
  function fechar() {
    setVisivel(false)
  }

  if (carregando || !visivel || avisos.length === 0) return null

  // Agrupa por tipo
  const avisosEspeciais = avisos.filter(a => a.tipo === 'especiais')
  const avisosJogos     = avisos.filter(a => a.tipo === 'jogos_hoje')

  return (
    <>
      {/* Overlay */}
      <div
        onClick={fechar}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 9998,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Popup */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 'min(92vw, 420px)',
        background: '#0D1E3D',
        border: '1px solid rgba(74,144,217,0.35)',
        borderRadius: 14,
        padding: '22px 20px 18px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Avisos do dia</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
              Verifique seus palpites
            </div>
          </div>
          <button
            onClick={fechar}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1,
              padding: '2px 4px',
            }}
          >×</button>
        </div>

        {/* Avisos de especiais */}
        {avisosEspeciais.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.85)',
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
            }}>
              🌟 Palpites especiais incompletos
            </div>
            {avisosEspeciais.map((a, i) => (
              <div key={i} style={{
                background: 'rgba(251,191,36,0.07)',
                border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 7, padding: '8px 10px', marginBottom: 5,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{a.palpite}</div>
                <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.75)', marginTop: 2 }}>{a.detalhes}</div>
              </div>
            ))}
          </div>
        )}

        {/* Avisos de jogos hoje */}
        {avisosJogos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'rgba(74,222,128,0.85)',
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
            }}>
              ⚽ Jogos de hoje sem palpite
            </div>
            {avisosJogos.map((a, i) => (
              <div key={i} style={{
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 7, padding: '8px 10px', marginBottom: 5,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{a.palpite}</div>
                <div style={{ fontSize: 11, color: 'rgba(74,222,128,0.75)', marginTop: 2 }}>{a.detalhes}</div>
              </div>
            ))}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={dispensarHoje}
            style={{
              flex: 1, padding: '9px 0',
              background: 'rgba(74,144,217,0.15)',
              border: '1px solid rgba(74,144,217,0.3)',
              borderRadius: 8, color: '#7BB8F0',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Não mostrar mais hoje
          </button>
          <button
            onClick={fechar}
            style={{
              flex: 1, padding: '9px 0',
              background: '#4A90D9',
              border: 'none',
              borderRadius: 8, color: 'white',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Ver palpites →
          </button>
        </div>
      </div>
    </>
  )
}
