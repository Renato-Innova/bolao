'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Palpite = { id: number; nome: string }

type Status = {
  respondida: boolean
  resposta: Record<string, unknown> | null
  palpites: Palpite[]
}

const PERGUNTAS = [
  { campo: 'indicaria',         texto: 'De 0 a 5, o quanto você indicaria esse bolão para um amigo ou familiar?', legenda: '0 = não indicaria · 5 = com certeza indicaria' },
  { campo: 'custo_beneficio',   texto: 'De 0 a 5, como você avalia o custo-benefício da participação (R$30 por palpite)?', legenda: '0 = não valeu o valor pago · 5 = valeu muito mais do que paguei' },
  { campo: 'facilidade_uso',    texto: 'De 0 a 5, o quanto você achou fácil de usar a plataforma?', legenda: 'site, preenchimento de palpites, acompanhamento do ranking' },
  { campo: 'clareza_pontuacao', texto: 'De 0 a 5, o quanto o sistema de pontuação ficou claro para você?', legenda: 'critérios, fases, bônus' },
  { campo: 'boletim_diario',    texto: 'De 0 a 5, o quanto você gostou de receber o boletim diário?', legenda: 'resumo dos jogos e da sua pontuação' },
] as const

export default function PesquisaPage() {
  const [carregando, setCarregando] = useState(true)
  const [status, setStatus] = useState<Status | null>(null)
  const [respostas, setRespostas] = useState<Record<string, number>>({})
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/pesquisa/status')
      .then(r => r.json())
      .then((data: Status) => setStatus(data))
      .catch(() => setErro('Não foi possível carregar a pesquisa.'))
      .finally(() => setCarregando(false))
  }, [])

  function escolher(campo: string, valor: number) {
    setRespostas(prev => ({ ...prev, [campo]: valor }))
  }

  const faltam = PERGUNTAS.filter(p => respostas[p.campo] === undefined).length

  async function enviar() {
    if (faltam > 0 || enviando) return
    setEnviando(true)
    setErro('')
    try {
      const res = await fetch('/api/pesquisa/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...respostas, comentario }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErro(json.error ?? 'Erro ao enviar respostas.')
        setEnviando(false)
        return
      }
      const res2 = await fetch('/api/pesquisa/status')
      setStatus(await res2.json())
    } catch {
      setErro('Erro de conexão.')
    }
    setEnviando(false)
  }

  const card: React.CSSProperties = {
    background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)',
    borderRadius: 10, padding: '20px 22px',
  }

  if (carregando) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        Carregando…
      </div>
    )
  }

  if (!status) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        {erro || 'Faça login para responder a pesquisa.'}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 24px 60px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7BB8F0', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Bolão Copa 2026
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: '4px 0 6px', fontFamily: 'var(--font-title, inherit)' }}>
          Pesquisa de Satisfação
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          Rápida, leva menos de 1 minuto — e libera o relatório em PDF de cada um dos seus palpites.
        </p>
      </div>

      {status.respondida ? (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>✅ Obrigado por responder!</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 18 }}>
            Seus relatórios estão liberados abaixo.
          </p>
          {status.palpites.length === 0 ? (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>Nenhum palpite ativo encontrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {status.palpites.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{p.nome}</span>
                  <a
                    href={`/api/pesquisa/relatorio?palpiteId=${p.id}`}
                    download
                    style={{
                      fontSize: 11, fontWeight: 700, color: 'white', textDecoration: 'none',
                      padding: '8px 14px', borderRadius: 7,
                      background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)',
                      textTransform: 'uppercase', letterSpacing: 0.4,
                    }}
                  >
                    Baixar PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PERGUNTAS.map((p, i) => (
            <div key={p.campo} style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>
                {i + 1}. {p.texto}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginBottom: 14 }}>{p.legenda}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2, 3, 4, 5].map(n => {
                  const selecionado = respostas[p.campo] === n
                  const positivo = n >= 4
                  return (
                    <button
                      key={n}
                      onClick={() => escolher(p.campo, n)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${selecionado ? (positivo ? '#4ade80' : '#4A90D9') : 'rgba(255,255,255,0.12)'}`,
                        background: selecionado ? (positivo ? 'rgba(74,222,128,0.18)' : 'rgba(74,144,217,0.18)') : 'rgba(255,255,255,0.03)',
                        color: selecionado ? 'white' : 'rgba(255,255,255,0.55)',
                        fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
                      }}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 10 }}>
              6. O que podemos melhorar para a próxima edição? <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(opcional)</span>
            </div>
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              rows={4}
              placeholder="Fique à vontade para escrever..."
              style={{
                width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {erro && <div style={{ fontSize: 12, color: 'rgba(255,100,100,0.85)', textAlign: 'center' }}>{erro}</div>}

          <button
            onClick={enviar}
            disabled={faltam > 0 || enviando}
            style={{
              padding: '14px 0', borderRadius: 9, border: 'none',
              background: faltam > 0 ? 'rgba(74,144,217,0.25)' : 'linear-gradient(90deg, #4A90D9, #1a5ca8)',
              color: 'white', fontSize: 14, fontWeight: 700,
              cursor: faltam > 0 || enviando ? 'not-allowed' : 'pointer',
            }}
          >
            {enviando ? 'Enviando…' : faltam > 0 ? `Responda todas as perguntas (faltam ${faltam})` : 'Enviar e liberar meu relatório'}
          </button>

          <Link href="/dashboard" style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            ← voltar ao dashboard
          </Link>
        </div>
      )}
    </div>
  )
}
