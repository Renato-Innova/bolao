import { createAdminClient } from '@/lib/supabase/server'
import { getWCScorers, type FDScorer } from '@/lib/football-data'

export const revalidate = 300 // regenera a cada 5 min (ISR)

/* ─── helpers ───────────────────────────────────────────────────────────── */

function FlagImg({ code, size = 22 }: { code: string; size?: number }) {
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      width={size}
      height={Math.round(size * 0.67)}
      style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
      alt=""
    />
  )
}

const FASE_LABEL: Record<string, string> = {
  GS: 'Fase de Grupos', R32: 'Oitavas de Final',
  R16: 'Quartas de Final', QF: 'Quartas de Final',
  SF: 'Semifinal', TPL: '3º Lugar', F: 'Final',
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function CopaPage() {
  const supabase = createAdminClient()

  // hoje em BRT (UTC-3)
  const hoje = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]

  // jogos de hoje
  const { data: jogosHoje } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .eq('data', hoje)
    .order('horario')

  // se não houver jogos hoje, pega os próximos 4
  let exibir       = jogosHoje ?? []
  let isProximos   = false
  if (exibir.length === 0) {
    const { data: prox } = await supabase
      .from('jogos_copa')
      .select('*, resultado:resultados(*)')
      .gt('data', hoje)
      .order('data').order('horario')
      .limit(4)
    exibir      = prox ?? []
    isProximos  = true
  }

  // artilharia da API externa (cache 1h no Next.js)
  const artilheiros = await getWCScorers(10)

  // ─── título da seção de jogos ───────────────────────────────────────────
  const dataHojeLabel = new Date(hoje + 'T12:00:00-03:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="page-main" style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* ── cabeçalho ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>🏆</span>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 30, letterSpacing: 1,
            color: 'white', margin: 0,
          }}>
            Copa do Mundo 2026
          </h1>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', letterSpacing: 0.3 }}>
          EUA · Canadá · México &nbsp;·&nbsp; 11 Jun – 19 Jul 2026
        </div>
      </div>

      {/* ── jogos ──────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 1, color: 'rgba(255,255,255,0.40)', marginBottom: 12,
        }}>
          {isProximos
            ? '📅 Próximos Jogos'
            : `📅 Jogos de Hoje · ${dataHojeLabel}`}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exibir.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              Nenhum jogo encontrado.
            </div>
          ) : exibir.map((jogo: Record<string, unknown>) => {
            // resultado pode vir como array ou objeto dependendo da query
            const res = Array.isArray(jogo.resultado)
              ? (jogo.resultado as Record<string, unknown>[])[0]
              : jogo.resultado as Record<string, unknown> | null
            const temResultado = res?.placar_real_a != null && res?.placar_real_b != null

            const dataJogo = (jogo.data as string) > hoje
              ? new Date((jogo.data as string) + 'T12:00:00-03:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
              : null

            return (
              <div
                key={jogo.id as number}
                style={{
                  background: '#0D1E3D',
                  border: '1px solid rgba(74,144,217,0.15)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                {/* data (só em próximos jogos) */}
                {dataJogo && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' }}>
                    {dataJogo}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
                  {/* Time A */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'white', textAlign: 'right', lineHeight: 1.2 }}>
                      {jogo.time_a as string}
                    </span>
                    <FlagImg code={jogo.codigo_pais_a as string} />
                  </div>

                  {/* placar / horário */}
                  <div style={{ textAlign: 'center', minWidth: 80 }}>
                    {temResultado ? (
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: 3, lineHeight: 1 }}>
                        {res!.placar_real_a as number} – {res!.placar_real_b as number}
                      </div>
                    ) : (
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#4A90D9', lineHeight: 1 }}>
                        {(jogo.horario as string)?.slice(0, 5)}h
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {jogo.grupo ? `Grupo ${jogo.grupo as string}` : FASE_LABEL[jogo.fase as string] ?? jogo.fase as string}
                    </div>
                  </div>

                  {/* Time B */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FlagImg code={jogo.codigo_pais_b as string} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>
                      {jogo.time_b as string}
                    </span>
                  </div>
                </div>

                {/* pênaltis */}
                {res?.placar_penalti_a != null && res?.placar_penalti_b != null && (
                  <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.40)' }}>
                    Pênaltis: {res.placar_penalti_a as number} – {res.placar_penalti_b as number}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── artilharia ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.40)' }}>
            ⚽ Artilharia
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>
            atualiza a cada hora
          </div>
        </div>

        <div style={{
          background: '#0D1E3D',
          border: '1px solid rgba(74,144,217,0.15)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          {artilheiros.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>
              Ainda não há gols marcados.
            </div>
          ) : artilheiros.map((s: FDScorer, i: number) => (
            <div
              key={s.player.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 30px 1fr auto',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderBottom: i < artilheiros.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: i === 0 ? 'rgba(255,215,0,0.04)' : 'transparent',
              }}
            >
              {/* posição */}
              <span style={{
                fontSize: 12, fontWeight: 700, textAlign: 'center',
                color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.30)',
              }}>
                {i + 1}°
              </span>

              {/* escudo do time */}
              <img
                src={s.team.crest}
                width={24} height={24}
                style={{ objectFit: 'contain' }}
                alt={s.team.shortName}
              />

              {/* nome + time */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{s.player.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 1 }}>{s.team.shortName}</div>
              </div>

              {/* gols */}
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#4A90D9', lineHeight: 1 }}>{s.goals}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', marginLeft: 3 }}>gols</span>
                {s.assists > 0 && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                    {s.assists} assist.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── boletim placeholder ────────────────────────────────────────────── */}
      <section>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.40)', marginBottom: 12 }}>
          📰 Boletim do Dia
        </div>
        <div style={{
          background: '#0D1E3D',
          border: '1px solid rgba(74,144,217,0.10)',
          borderRadius: 10, padding: '32px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✍️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 8 }}>Em breve</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
            Boletim diário com curiosidades, bastidores e análises da Copa —
            gerado pelo Claude 2× ao dia.
          </div>
        </div>
      </section>

    </div>
  )
}
