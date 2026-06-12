import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PIX_VALOR } from '@/utils/constants'
import { getRanking } from '@/services/ranking'

export const dynamic = 'force-dynamic'

/* ─── Regras de distribuição do prêmio ──────────────────────────────────────
   Altere os percentuais aqui conforme o regulamento do bolão.               */
const REGRAS_PREMIO = [
  { posicao: 1, label: '1º Lugar',  emoji: '🥇', pct: 0.50 },
  { posicao: 2, label: '2º Lugar',  emoji: '🥈', pct: 0.30 },
  { posicao: 3, label: '3º Lugar',  emoji: '🥉', pct: 0.20 },
]

/* ─── Custo estimado por boletim IA ─────────────────────────────────────────
   Baseado em claude-opus-4-5: ~650 tokens input + ~450 tokens output.
   Input $15/MTok + Output $75/MTok ≈ $0,044/boletim × câmbio ~5,50 ≈ R$0,24 */
const CUSTO_POR_BOLETIM_BRL = 0.24

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`
}

/* ─── Helpers de estilo ──────────────────────────────────────────────────── */
const card = {
  background: '#0D1E3D',
  border: '1px solid rgba(74,144,217,0.15)',
  borderRadius: 12,
  padding: '20px 24px',
} as React.CSSProperties

const sectionTitle = {
  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16,
}

const rowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
} as React.CSSProperties

const totalRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 0 0',
  marginTop: 4,
} as React.CSSProperties

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default async function BalancoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users').select('is_admin, is_operador').eq('id', user.id).maybeSingle()
  if (!userData?.is_admin && !userData?.is_operador) redirect('/dashboard')

  const admin = createAdminClient()

  /* ── Dados de entrada ── */
  const { count: totalPalpites } = await admin
    .from('palpites').select('*', { count: 'exact', head: true }).eq('status', 'ativo')

  const numPalpites = totalPalpites ?? 0
  const totalEntradas = numPalpites * PIX_VALOR

  /* ── Dados de custo IA ── */
  const { count: totalBoletins } = await admin
    .from('boletim_copa').select('*', { count: 'exact', head: true })

  const numBoletins = totalBoletins ?? 0
  const custoIA = numBoletins * CUSTO_POR_BOLETIM_BRL

  /* ── Sobra ── */
  const totalSaidas = custoIA
  const sobra = totalEntradas - totalSaidas

  /* ── Ranking atual para distribuição do prêmio ── */
  const ranking = await getRanking()
  const temPontos = ranking.some(r => r.total_pontos > 0)

  return (
    <div className="page-main" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 24px 60px' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: 0.2 }}>
          💰 Balanço do Bolão
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
          Contabilidade em tempo real · atualizado automaticamente
        </div>
      </div>

      {/* ── ENTRADAS ──────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={sectionTitle}>📥 Entradas</div>

        <div style={rowStyle}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Inscrições pagas</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {numPalpites} palpites ativos × {fmt(PIX_VALOR)}
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>{fmt(totalEntradas)}</div>
        </div>

        <div style={totalRow}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Total de entradas
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{fmt(totalEntradas)}</div>
        </div>
      </div>

      {/* ── SAÍDAS ────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={sectionTitle}>📤 Saídas / Custos</div>

        <div style={rowStyle}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>
              Boletins IA — Claude Opus
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {numBoletins} boletins gerados × {fmt(CUSTO_POR_BOLETIM_BRL)} estimado
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
              Estimativa baseada em ~650 tokens input + ~450 tokens output (claude-opus-4-5)
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,100,100,0.85)' }}>{fmt(custoIA)}</div>
        </div>

        <div style={totalRow}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Total de saídas
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,100,100,0.85)' }}>{fmt(totalSaidas)}</div>
        </div>
      </div>

      {/* ── SOBRA ─────────────────────────────────────────────── */}
      <div style={{
        ...card,
        marginBottom: 32,
        background: 'linear-gradient(135deg, #0a2040 0%, #0d2a52 100%)',
        border: '1px solid rgba(74,144,217,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              💵 Prêmio disponível (sobra)
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              Entradas ({fmt(totalEntradas)}) − Saídas ({fmt(totalSaidas)})
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#4A90D9', lineHeight: 1 }}>
              {fmt(sobra)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              a distribuir entre os vencedores
            </div>
          </div>
        </div>
      </div>

      {/* ── DISTRIBUIÇÃO DO PRÊMIO ────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={sectionTitle}>🏆 Distribuição do Prêmio</div>
          {!temPontos && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,200,0,0.8)',
              background: 'rgba(255,200,0,0.1)', border: '1px solid rgba(255,200,0,0.2)',
              padding: '3px 10px', borderRadius: 20,
            }}>
              Classificação em andamento
            </span>
          )}
        </div>

        {/* Linhas por posição */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REGRAS_PREMIO.map(regra => {
            const entry = ranking.find(r => r.posicao === regra.posicao)
            const premio = sobra * regra.pct

            return (
              <div key={regra.posicao} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                {/* Posição */}
                <div style={{
                  fontSize: 22, minWidth: 36, textAlign: 'center',
                }}>
                  {regra.emoji}
                </div>

                {/* Nome e pontos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {entry ? (
                    <>
                      {/* Nome ofuscado — revelado somente após o final do bolão */}
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: 'transparent',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        textShadow: '0 0 10px rgba(255,255,255,0.85)',
                        userSelect: 'none',
                        filter: 'blur(6px)',
                        maxWidth: 180,
                      }}>
                        {entry.nome}
                      </div>
                      <div style={{
                        fontSize: 11, color: 'transparent',
                        marginTop: 2,
                        textShadow: '0 0 8px rgba(255,255,255,0.5)',
                        filter: 'blur(4px)',
                        userSelect: 'none',
                      }}>
                        {entry.usuario_nome} · {entry.total_pontos} pts
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                      Aguardando resultado final
                    </div>
                  )}
                </div>

                {/* Percentual */}
                <div style={{ textAlign: 'center', minWidth: 44 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
                    {pct(regra.pct)}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', marginTop: 1 }}>do prêmio</div>
                </div>

                {/* Valor */}
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#4A90D9', lineHeight: 1 }}>
                    {fmt(premio)}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    posição atual
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Nota de rodapé */}
        <div style={{
          marginTop: 20, padding: '12px 14px',
          background: 'rgba(74,144,217,0.06)', borderRadius: 8,
          fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6,
        }}>
          🔒 Os nomes dos líderes estão <strong style={{ color: 'rgba(255,255,255,0.55)' }}>ocultos até o final do bolão</strong> (19 jul 2026) para manter o suspense.
          Os valores refletem a classificação atual e serão confirmados apenas na apuração final.
          O custo de IA é estimado — pode variar conforme uso efetivo da API.
        </div>
      </div>

    </div>
  )
}
