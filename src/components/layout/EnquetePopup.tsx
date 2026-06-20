'use client'

import { useEffect, useState } from 'react'

const OPCOES = [
  { letra: 'A', texto: 'Não. Deixe bloqueados como estão.' },
  { letra: 'B', texto: 'Sim. Mas somente Campeão e Vice-Campeão.' },
  { letra: 'C', texto: 'Sim. Todos os palpites especiais.' },
]

type Fase = 'carregando' | 'votacao' | 'resultado' | 'decisao' | 'oculto'

type Estado = {
  aberta: boolean
  resultado_visivel: boolean
  meuVoto: string | null
  totais: { A: number; B: number; C: number }
  totalVotaram: number
  totalUsuariosAtivos: number
  isAdmin: boolean
  decisao_titulo: string | null
  decisao_texto: string | null
  decisao_visivel: boolean
  decisao_preview: boolean
}

const DECISAO_DISMISS_KEY = 'enquete_decisao_dismissed'

export function EnquetePopup() {
  const [fase,    setFase]    = useState<Fase>('carregando')
  const [estado,  setEstado]  = useState<Estado | null>(null)
  const [votando, setVotando] = useState<string | null>(null)
  const [erro,    setErro]    = useState('')

  useEffect(() => {
    fetch('/api/enquete/resultado')
      .then(r => r.json())
      .then((data: Estado) => {
        setEstado(data)
        if (data.aberta) {
          if (data.meuVoto) {
            setFase(data.resultado_visivel ? 'resultado' : 'oculto')
          } else {
            setFase('votacao')
          }
          return
        }
        // Enquete encerrada — verifica se há uma decisão para comunicar
        const jaViu = typeof window !== 'undefined' && localStorage.getItem(DECISAO_DISMISS_KEY) === 'true'
        if (data.decisao_texto && !jaViu) {
          setFase('decisao')
        } else {
          setFase('oculto')
        }
      })
      .catch(() => setFase('oculto'))
  }, [])

  async function votar(letra: string) {
    if (votando) return
    setVotando(letra)
    setErro('')
    try {
      const res = await fetch('/api/enquete/votar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opcao: letra }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErro(json.error ?? 'Erro ao registrar voto.')
        setVotando(null)
        return
      }
      const res2 = await fetch('/api/enquete/resultado')
      const data2: Estado = await res2.json()
      setEstado(data2)
      setFase(data2.resultado_visivel ? 'resultado' : 'oculto')
    } catch {
      setErro('Erro de conexão.')
    }
    setVotando(null)
  }

  function fecharDecisao() {
    if (typeof window !== 'undefined') localStorage.setItem(DECISAO_DISMISS_KEY, 'true')
    setFase('oculto')
  }

  if (fase === 'carregando' || fase === 'oculto' || !estado) return null

  const total = estado.totalVotaram
  const totais = estado.totais
  function getPct(letra: string) {
    if (total === 0) return 0
    return Math.round((totais[letra as keyof typeof totais] / total) * 100)
  }

  return (
    <>
      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 9998,
        backdropFilter: 'blur(3px)',
      }} />

      {/* Popup */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 'min(92vw, 400px)',
        background: '#0D1E3D',
        border: '1px solid rgba(74,144,217,0.35)',
        borderRadius: 14,
        padding: '24px 20px 20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
      }}>

        {/* ── FASE: decisão comunicada ── */}
        {fase === 'decisao' ? (
          <div>
            {estado.decisao_preview && (
              <div style={{
                display: 'inline-block', fontSize: 9, fontWeight: 700,
                background: 'rgba(255,200,80,0.18)', color: '#FFD050',
                borderRadius: 20, padding: '3px 10px', marginBottom: 12,
                letterSpacing: 0.4, textTransform: 'uppercase',
              }}>
                ⚠ Preview — visível só para admin
              </div>
            )}

            <div style={{
              display: 'inline-block',
              fontSize: 10, fontWeight: 600,
              background: 'rgba(74,144,217,0.15)',
              color: '#7BB8F0',
              borderRadius: 20, padding: '3px 10px',
              marginBottom: 14, letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>
              Decisão do bolão
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, color: 'white', lineHeight: 1.5, marginBottom: 12 }}>
              {estado.decisao_titulo}
            </div>

            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-line' }}>
              {estado.decisao_texto}
            </div>

            <button
              onClick={fecharDecisao}
              style={{
                width: '100%', padding: '11px 0',
                background: '#4A90D9', border: 'none',
                borderRadius: 9, color: 'white',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Entendi
            </button>
          </div>
        ) : (
        <>
        {/* Badge */}
        <div style={{
          display: 'inline-block',
          fontSize: 10, fontWeight: 600,
          background: 'rgba(74,144,217,0.15)',
          color: '#7BB8F0',
          borderRadius: 20, padding: '3px 10px',
          marginBottom: 14, letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}>
          Enquete do bolão
        </div>

        {/* Pergunta */}
        <div style={{
          fontSize: 14, fontWeight: 700, color: 'white',
          lineHeight: 1.55, marginBottom: 20,
        }}>
          Você acha que os Palpites Especiais devem ficar abertos até o final da Fase de Grupos?
        </div>

        {/* ── FASE: votação ── */}
        {fase === 'votacao' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OPCOES.map(({ letra, texto }) => (
              <button
                key={letra}
                onClick={() => votar(letra)}
                disabled={!!votando}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', textAlign: 'left',
                  background: votando === letra
                    ? 'rgba(74,144,217,0.18)'
                    : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(74,144,217,0.18)',
                  borderRadius: 9, padding: '12px 14px',
                  cursor: votando ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  if (!votando) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,144,217,0.12)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(74,144,217,0.4)'
                  }
                }}
                onMouseLeave={e => {
                  if (!votando) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(74,144,217,0.18)'
                  }
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#7BB8F0',
                  minWidth: 18, flexShrink: 0,
                }}>
                  {letra}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                  {texto}
                </span>
              </button>
            ))}

            {erro && (
              <div style={{ fontSize: 11, color: 'rgba(255,100,100,0.85)', textAlign: 'center', marginTop: 4 }}>
                {erro}
              </div>
            )}

            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.3)',
              textAlign: 'center', marginTop: 6,
            }}>
              🔒 Resposta obrigatória — o popup fecha após votar
            </div>
          </div>
        )}

        {/* ── FASE: resultado ── */}
        {fase === 'resultado' && (
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#4ade80',
              marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              ✅ Voto registrado — resultado
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {OPCOES.map(({ letra, texto }) => {
                const pct    = getPct(letra)
                const meuVoto = estado?.meuVoto === letra
                return (
                  <div key={letra}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800,
                        color: meuVoto ? '#4ade80' : '#7BB8F0',
                        minWidth: 18, flexShrink: 0,
                      }}>
                        {letra}
                      </span>
                      <span style={{
                        fontSize: 12, color: meuVoto ? 'white' : 'rgba(255,255,255,0.7)',
                        fontWeight: meuVoto ? 600 : 400, lineHeight: 1.4, flex: 1,
                      }}>
                        {texto}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: meuVoto ? '#4ade80' : 'rgba(255,255,255,0.5)',
                        minWidth: 36, textAlign: 'right', flexShrink: 0,
                      }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{
                      height: 4, background: 'rgba(255,255,255,0.08)',
                      borderRadius: 99, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: meuVoto
                          ? 'linear-gradient(90deg,#4ade80,#22c55e)'
                          : 'rgba(74,144,217,0.5)',
                        borderRadius: 99,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.3)',
              textAlign: 'center', marginBottom: 16,
            }}>
              {total} {total === 1 ? 'voto' : 'votos'} de {estado.totalUsuariosAtivos} participantes
            </div>

            <button
              onClick={() => setFase('oculto')}
              style={{
                width: '100%', padding: '11px 0',
                background: '#4A90D9', border: 'none',
                borderRadius: 9, color: 'white',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </>
  )
}
