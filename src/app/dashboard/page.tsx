import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getRanking } from '@/services/ranking'
import { FlagImg } from '@/components/ui/FlagImg'
import type { JogoCopa, ClassificacaoGrupo } from '@/types'

export const dynamic = 'force-dynamic'

const FASE_LABEL: Record<string, string> = {
  GS:  'Fase de Grupos',
  R32: 'Rodada de 32',
  R16: 'Oitavas de Final',
  QF:  'Quartas de Final',
  SF:  'Semifinal',
  TPL: 'Disputa de 3º',
  F:   'Final',
}


export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const [
    { count: totalAtivos },
    { count: totalUsuarios },
    { count: totalJogos },
    { count: jogosRealizados },
    { data: proximosJogos },
    { data: ultimosResultados },
    ranking,
    { data: grupoJogos },
  ] = await Promise.all([
    supabase.from('palpites').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa').select('*', { count: 'exact', head: true }),
    supabase.from('resultados').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').gte('data', new Date().toISOString().split('T')[0]).order('data').order('horario').limit(8),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').lt('data', new Date().toISOString().split('T')[0]).not('resultado', 'is', null).order('data', { ascending: false }).order('horario', { ascending: false }).limit(4),
    getRanking(),
    supabase.from('classificacao_grupos').select('*').order('grupo').order('pts', { ascending: false }).order('dg', { ascending: false }).order('m', { ascending: false }),
  ])

  const lider   = (ranking[0]?.total_pontos ?? 0) > 0 ? ranking[0] : null
  const hoje    = new Date().toISOString().split('T')[0]
  const myEntry = currentUser ? ranking.find(r => r.usuario_id === currentUser.id) : null

  /* Fase atual — from most recent played game, else next upcoming */
  const faseAtualRaw = (ultimosResultados?.[0] as JogoCopa | undefined)?.fase
    ?? (proximosJogos?.[0] as JogoCopa | undefined)?.fase
    ?? 'GS'
  const faseAtual = FASE_LABEL[faseAtualRaw] ?? 'Fase de Grupos'

  /* Max pontos possíveis = all played games * 20 (placar exato) */
  const maxPontosPossiveis = (jogosRealizados ?? 0) * 20

  /* Two groups to display — derived from next GS games */
  const classRows  = (grupoJogos ?? []) as ClassificacaoGrupo[]
  const byGrupo: Record<string, ClassificacaoGrupo[]> = {}
  for (const row of classRows) {
    if (!byGrupo[row.grupo]) byGrupo[row.grupo] = []
    byGrupo[row.grupo].push(row)
  }
  const nextGSGroups = [
    ...new Set(
      (proximosJogos ?? [])
        .filter((j: JogoCopa) => j.fase === 'GS' && j.grupo)
        .map((j: JogoCopa) => j.grupo as string)
    ),
  ].slice(0, 2)
  const displayGroups = nextGSGroups.length > 0
    ? nextGSGroups
    : Object.keys(byGrupo).slice(0, 2)

  function formatDate(d: string) {
    const parts = d.split('-')
    return `${parts[2]} ${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(parts[1])-1]}`
  }
  function formatTime(t: string) { return t.slice(0, 5) }

  /* Shared styles */
  const card: React.CSSProperties = {
    background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)',
    borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden',
  }
  const bar: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)',
  }
  const label12: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.50)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
  }
  const value24: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: 'white', lineHeight: 1 }
  const sub10: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 3 }

  return (
    <div className="page-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* ── 4 metric cards ───────────────────────────────────────────────── */}
      <div className="dash-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>

        {/* Card 1 — Palpites + Participantes */}
        <div style={card}>
          <div style={bar} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={label12}>Palpites</div>
              <div style={value24}>{totalAtivos ?? 0}</div>
              <div style={sub10}>ativos no bolão</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={label12}>Participantes</div>
              <div style={value24}>{totalUsuarios ?? 0}</div>
              <div style={sub10}>cadastrados</div>
            </div>
          </div>
        </div>

        {/* Card 2 — Jogos + Máx. pontos */}
        <div style={card}>
          <div style={bar} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={label12}>Jogos realizados</div>
              <div style={value24}>
                {jogosRealizados ?? 0}
                <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.50)' }}>/{totalJogos ?? 104}</span>
              </div>
              <div style={sub10}>{faseAtual}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={label12}>Máx. de pontos</div>
              <div style={value24}>{maxPontosPossiveis}</div>
              <div style={sub10}>pts possíveis</div>
            </div>
          </div>
        </div>

        {/* Card 3 — Sua Posição + Líder */}
        <div style={card}>
          <div style={bar} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={label12}>Sua posição</div>
              <div style={value24}>{myEntry ? `#${myEntry.posicao}` : '—'}</div>
              <div style={sub10}>{myEntry ? `${myEntry.total_pontos} pts` : 'sem palpite ativo'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={label12}>Líder do bolão</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: 2 }}>
                {lider?.nome ?? '—'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                {lider ? `${lider.total_pontos} pts` : 'Sem palpites ativos'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Second row: ranking + groups + matches ───────────────────────── */}
      <div className="dash-two" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>

        {/* Ranking */}
        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            Ranking do bolão
            <Link href="/ranking" style={{ fontSize: 10, color: '#4A90D9', fontWeight: 500, textDecoration: 'none', textTransform: 'none', letterSpacing: 0 }}>ranking completo →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {ranking.length === 0 && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 12, padding: '12px 0' }}>Nenhum palpite ativo ainda</p>
            )}
            {ranking.slice(0, 5).map((entry, idx) => {
              const maxPts = ranking[0]?.total_pontos || 1
              const pct    = Math.round((entry.total_pontos / maxPts) * 100)
              const medal  = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : String(entry.posicao)
              const isMe   = currentUser && entry.usuario_id === currentUser.id
              return (
                <div key={entry.palpite_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: isMe ? 'rgba(74,144,217,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isMe ? 'rgba(74,144,217,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 22, color: 'rgba(255,255,255,0.50)', textAlign: 'center' }}>{medal}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{entry.nome}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)' }}>{entry.usuario_nome}</div>
                  </div>
                  <div style={{ width: 56, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: 3, background: 'linear-gradient(90deg, #4A90D9, #7BB8F0)', borderRadius: 2, width: `${pct}%` }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#4A90D9', minWidth: 52, textAlign: 'right' }}>{entry.total_pontos} pts</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Groups — shows the 2 groups related to next games */}
        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            Tabela oficial
            <Link href="/tabela" style={{ fontSize: 10, color: '#4A90D9', fontWeight: 500, textDecoration: 'none', textTransform: 'none', letterSpacing: 0 }}>ver todos →</Link>
          </div>

          {displayGroups.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 12, padding: '16px 0' }}>Grupos em breve</p>
          ) : displayGroups.map((grupo, gi) => (
            <div key={grupo} style={{ marginBottom: gi < displayGroups.length - 1 ? 18 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4A90D9', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                Grupo {grupo}
              </div>
              <div className="dash-table-cols" style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '0 4px 5px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>#</span><span style={{ textAlign: 'left' }}>Seleção</span><span>J</span><span>V</span><span>SG</span><span className="rank-acertos">GP</span><span>Pts</span>
              </div>
              {(byGrupo[grupo] ?? []).length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 11, padding: '10px 0' }}>Jogos em breve</p>
              ) : (byGrupo[grupo] ?? []).map((row: ClassificacaoGrupo, idx: number) => {
                const q     = idx < 2
                const sgStr = row.dg > 0 ? `+${row.dg}` : String(row.dg)
                return (
                  <div key={row.pais_nome} className="dash-table-cols" style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '6px 4px', alignItems: 'center', fontSize: 11, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', background: q ? 'rgba(74,144,217,0.07)' : 'transparent', borderRadius: q ? 4 : 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: q ? '#4A90D9' : 'rgba(255,255,255,0.25)' }}>{idx + 1}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left' }}>
                      <FlagImg codigo={row.pais_codigo} size={18} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'white' }}>{row.pais_nome}</span>
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{row.j}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{row.c}</span>
                    <span style={{ fontSize: 10, color: row.dg < 0 ? 'rgba(255,100,100,0.75)' : 'rgba(255,255,255,0.6)' }}>{sgStr}</span>
                    <span className="rank-acertos" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{row.m}</span>
                    <span style={{ fontWeight: 700, color: '#4A90D9', fontSize: 11 }}>{row.pts}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Próximas Partidas */}
        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Próximas Partidas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(proximosJogos ?? []).slice(0, 5).map((j: JogoCopa) => {
              const isToday   = j.data === hoje
              const hasPlacar = !!j.resultado
              return (
                <div key={j.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
                  padding: '8px 10px',
                  background: isToday ? 'rgba(74,144,217,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isToday ? 'rgba(74,144,217,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 7,
                }}>
                  {/* Time A */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                      {j.codigo_pais_a && <FlagImg codigo={j.codigo_pais_a} size={16} />}
                      {j.time_a}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>{formatDate(j.data)}</div>
                  </div>
                  {/* Centro */}
                  <div style={{ textAlign: 'center', padding: '0 10px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4A90D9' }}>
                      {hasPlacar ? `${j.resultado!.placar_real_a} – ${j.resultado!.placar_real_b}` : '– –'}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3,
                      background: hasPlacar ? 'rgba(74,144,217,0.15)' : isToday ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.07)',
                      color: hasPlacar ? '#7BB8F0' : isToday ? '#4ade80' : 'rgba(255,255,255,0.5)',
                    }}>
                      {hasPlacar ? 'Encerrado' : isToday ? `Hoje ${formatTime(j.horario)}h` : 'Em breve'}
                    </span>
                  </div>
                  {/* Time B */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, justifyContent: 'flex-end' }}>
                      {j.time_b}
                      {j.codigo_pais_b && <FlagImg codigo={j.codigo_pais_b} size={16} />}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>{j.cidade}</div>
                  </div>
                </div>
              )
            })}
            {!(proximosJogos?.length) && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 12, padding: '20px 0' }}>Nenhuma partida em breve</p>
            )}
          </div>
        </div>

      </div>

      {/* ── Third row: Informações ────────────────────────────────────────── */}
      <div style={{ ...card }}>
        <div style={bar} />
        <div style={label12}>Informações</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          {[
            <span><strong style={{ color: 'white' }}>Ativação:</strong> R$ 30,00 via PIX · CPF <strong style={{ color: 'white' }}>247.076.998-12</strong> (Ricardo L C Pereira)</span>,
            <span><strong style={{ color: 'white' }}>Como ativar:</strong> envie o comprovante no grupo do WhatsApp com o nome do seu palpite</span>,
            <span><strong style={{ color: 'white' }}>Prazo de ativação:</strong> palpites não podem ser ativados após o início da Copa — <strong style={{ color: 'white' }}>11 de junho</strong></span>,
            <span><strong style={{ color: 'white' }}>Prazo por jogo:</strong> cada placar deve ser enviado até <strong style={{ color: 'white' }}>1 hora antes</strong> da partida</span>,
            <span><strong style={{ color: 'white' }}>Palpites especiais:</strong> devem ser preenchidos até <strong style={{ color: 'white' }}>1h antes da primeira partida (11 jun · 16h00)</strong> — sem edição após esse prazo</span>,
            <span><strong style={{ color: 'white' }}>Placar exato</strong> vale até <strong style={{ color: 'white' }}>20 pts</strong> na fase de grupos (mais nas fases seguintes)</span>,
            <span><strong style={{ color: 'white' }}>Campeão correto</strong> vale <strong style={{ color: 'white' }}>100 pts</strong> · Vice vale <strong style={{ color: 'white' }}>70 pts</strong></span>,
            <span><strong style={{ color: 'white' }}>Bônus de grupos:</strong> 20 pts por seleção classificada que você previu corretamente (máx. <strong style={{ color: 'white' }}>640 pts</strong>)</span>,
          ].map((item, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#4A90D9', flexShrink: 0 }}>•</span>
              {item}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ color: '#4A90D9', flexShrink: 0 }}>•</span>
            <Link href="/instrucoes" style={{ color: '#7BB8F0', textDecoration: 'none' }}>Ver regulamento completo →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
