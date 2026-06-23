// v2
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getRankingCached } from '@/services/ranking'
import { FlagImg } from '@/components/ui/FlagImg'
import { PalpiteAvatar } from '@/components/ui/PalpiteAvatar'
import { PalpiteCarousel } from '@/components/dashboard/PalpiteCarousel'
import type { PalpiteSlide } from '@/components/dashboard/PalpiteCarousel'
import type { JogoCopa, ClassificacaoGrupo } from '@/types'

// Inicio do código

export const dynamic = 'force-dynamic'

const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s

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

  const hoje  = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0]
  const ontem = new Date(Date.now() - 3 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { count: totalAtivos },
    { count: totalUsuarios },
    { count: totalJogos },
    { count: jogosRealizados },
    { data: proximosJogos },
    { data: ultimosResultados },
    ranking,
    { data: grupoJogos },
    { data: boletins },
    { count: totalBoletins },
    { data: artilheiros },
    { data: pontuacaoResumo },
    { data: jogosPorFase },
  ] = await Promise.all([
    supabase.from('palpites').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa').select('*', { count: 'exact', head: true }),
    supabase.from('resultados').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').gte('data', hoje).order('data').order('horario').limit(8),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').eq('data', ontem).not('resultado', 'is', null).order('horario', { ascending: false }),
    getRankingCached(),
    supabase.from('classificacao_grupos').select('*').order('grupo').order('pts', { ascending: false }).order('dg', { ascending: false }).order('m', { ascending: false }),
    supabase.from('boletim_copa').select('*').order('gerado_em', { ascending: false }).limit(10),
    supabase.from('boletim_copa').select('*', { count: 'exact', head: true }),
    supabase.from('artilheiros_copa').select('*').order('gols', { ascending: false }).order('assistencias', { ascending: false }).limit(10),
    supabase.from('pontuacao_resumo').select('fase, tipo, pontos_unitario, pontos_max'),
    supabase.from('jogos_copa').select('fase, resultado:resultados(id)'),
  ])

  // Contagem de palpites para próximos jogos (vitória A / empate / vitória B)
  const proximosIds = (proximosJogos ?? []).map((j: JogoCopa) => j.id)
  type PJRow = { jogo_id: number; placar_palpite_a: number; placar_palpite_b: number }
  let palpitesProximos: PJRow[] = []
  if (proximosIds.length > 0) {
    const { data: pjData } = await supabase
      .from('palpites_jogos')
      .select('jogo_id, placar_palpite_a, placar_palpite_b')
      .in('jogo_id', proximosIds)
      .not('submitted_at', 'is', null)
    palpitesProximos = (pjData ?? []) as PJRow[]
  }

  const pctMap: Record<number, { winA: number; draw: number; winB: number; total: number }> = {}
  for (const j of (proximosJogos ?? [])) {
    const jogo = j as JogoCopa
    const pals = palpitesProximos.filter(p => p.jogo_id === jogo.id && p.placar_palpite_a != null && p.placar_palpite_b != null)
    pctMap[jogo.id] = {
      winA:  pals.filter(p => p.placar_palpite_a > p.placar_palpite_b).length,
      draw:  pals.filter(p => p.placar_palpite_a === p.placar_palpite_b).length,
      winB:  pals.filter(p => p.placar_palpite_a < p.placar_palpite_b).length,
      total: pals.length,
    }
  }

  function pct(n: number, total: number) { return total ? Math.round((n / total) * 100) : 0 }
  const progressPct = (totalJogos ?? 104) > 0 ? Math.round(((jogosRealizados ?? 0) / (totalJogos ?? 104)) * 100) : 0

  // Pontos em disputa = soma, por fase, de (jogos já com resultado × pts placar exato da fase)
  // Sourced from pontuacao_resumo (admin-configurable) — fallback à tabela oficial se a view não existir ainda.
  const PONTOS_EXATO_FALLBACK: Record<string, number> = { GS: 20, R32: 30, R16: 40, QF: 60, SF: 80, TPL: 100, F: 120 }
  const resumoRows = (pontuacaoResumo ?? []) as { fase: string; tipo: string; pontos_unitario: number; pontos_max: number }[]
  const resumoJogos = resumoRows.filter(r => r.tipo === 'jogos')
  const completadosPorFase: Record<string, number> = {}
  for (const j of (jogosPorFase ?? []) as { fase: string; resultado: unknown }[]) {
    if (!j.resultado) continue
    completadosPorFase[j.fase] = (completadosPorFase[j.fase] ?? 0) + 1
  }
  const fasesUsadas = resumoJogos.length > 0
    ? resumoJogos.map(r => ({ fase: r.fase, ptsExato: r.pontos_unitario }))
    : Object.entries(PONTOS_EXATO_FALLBACK).map(([fase, ptsExato]) => ({ fase, ptsExato }))
  const pontosEmDisputa = fasesUsadas.reduce((s, f) => s + (completadosPorFase[f.fase] ?? 0) * f.ptsExato, 0)
  // Máximo possível = total geral do bolão (jogos + classificação + especiais), direto da view
  const pontosMaxJogos = resumoRows.length > 0
    ? resumoRows.reduce((s, r) => s + r.pontos_max, 0)
    : 3820
  const disputaPct = pontosMaxJogos > 0 ? Math.round((pontosEmDisputa / pontosMaxJogos) * 100) : 0

  // Pega somente o boletim mais recente (independente de tipo)
  type Boletim = { id: number; tipo: string; titulo: string; conteudo: string; gerado_em: string }
  const ultimoBoletim: Boletim | null = ((boletins ?? []) as Boletim[])[0] ?? null

  const lider   = (ranking[0]?.total_pontos ?? 0) > 0 ? ranking[0] : null
  const myEntry = currentUser ? ranking.find(r => r.usuario_id === currentUser.id) : null

  /* slides do carrossel — todos os palpites do usuário logado */
  const mySlides: PalpiteSlide[] = currentUser
    ? ranking
        .filter(r => r.usuario_id === currentUser.id)
        .map(r => ({
          palpite_id:     r.palpite_id,
          nome:           r.nome,
          total_pontos:   r.total_pontos,
          acertos_exatos: r.acertos_exatos,
          posicao:        r.posicao,
          total:          ranking.length,
          status:         r.status ?? 'ativo',
        }))
    : []

  /* Fase atual — from most recent played game, else next upcoming */
  const faseAtualRaw = (ultimosResultados?.[0] as JogoCopa | undefined)?.fase
    ?? (proximosJogos?.[0] as JogoCopa | undefined)?.fase
    ?? 'GS'
  const faseAtual = FASE_LABEL[faseAtualRaw] ?? 'Fase de Grupos'

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
  ].slice(0, 3)
  const displayGroups = nextGSGroups.length > 0
    ? nextGSGroups
    : Object.keys(byGrupo).slice(0, 3)

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

  return (
    <div className="page-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* ── Main grid 3×2: col 3 spans both rows ────────────────────────── */}
      <div className="dash-main-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'auto auto', gap: 12, marginBottom: 12 }}>

        {/* R1C1 — Carrossel de palpites do usuário */}
        <div className="dash-card-carrossel" style={{ height: '100%' }}><PalpiteCarousel slides={mySlides} /></div>

        {/* R1C2 — Progresso do torneio */}
        <div className="dash-card-jogos" style={card}>
          <div style={bar} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <div style={{ paddingRight: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Jogos realizados</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1 }}>{jogosRealizados ?? 0}</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>/ {totalJogos ?? 104}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #4A90D9, #7BB8F0)', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{faseAtual}</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Pontos em disputa</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1 }}>{pontosEmDisputa.toLocaleString('pt-BR')}</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>/ {pontosMaxJogos.toLocaleString('pt-BR')} *</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${disputaPct}%`, background: 'linear-gradient(90deg, #4A90D9, #7BB8F0)', borderRadius: 3 }} />
              </div>
              <Link href="/instrucoes#pontuacao-maxima-geral" style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', textDecoration: 'underline' }}>
                * veja em instruções o cálculo
              </Link>
            </div>
          </div>
        </div>

        {/* R1C3 — Últimas Partidas */}
        <div className="dash-card-ultimas" style={card}>
          <div style={bar} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Partidas de Ontem</div>
          {!(ultimosResultados?.length) ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12, padding: '12px 0' }}>Nenhum resultado ainda</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(ultimosResultados as JogoCopa[]).map((j) => (
                <div key={j.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '7px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'white', textAlign: 'right' }}>{j.time_a}</span>
                    {j.codigo_pais_a && <FlagImg codigo={j.codigo_pais_a} size={16} />}
                  </div>
                  <div style={{ textAlign: 'center', padding: '0 10px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#4A90D9', letterSpacing: 1 }}>
                      {j.resultado!.placar_real_a} – {j.resultado!.placar_real_b}
                    </div>
                    {j.resultado!.placar_penalti_a != null && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)' }}>
                        pên {j.resultado!.placar_penalti_a}–{j.resultado!.placar_penalti_b}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{formatDate(j.data)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 5 }}>
                    {j.codigo_pais_b && <FlagImg codigo={j.codigo_pais_b} size={16} />}
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>{j.time_b}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* R2C3 — Ranking do Bolão */}
        <div className="dash-card-ranking" style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8 }}>Ranking do bolão</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>5 primeiros + você</div>
            </div>
            {currentUser && <Link href="/ranking" style={{ fontSize: 10, color: '#4A90D9', fontWeight: 500, textDecoration: 'none', letterSpacing: 0 }}>ranking completo →</Link>}
          </div>
          {!currentUser ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '24px 12px' }}>
              <div style={{ fontSize: 28 }}>🏆</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
                Faça login para ter acesso ao ranking
              </div>
              <Link href="/auth/login" style={{ fontSize: 12, fontWeight: 700, color: 'white', textDecoration: 'none', background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)', padding: '8px 20px', borderRadius: 8 }}>
                Entrar
              </Link>
            </div>
          ) : (() => {
              const maxPts = ranking[0]?.total_pontos || 1
              const top5   = ranking.slice(0, 5)
              const top5Ids = new Set(top5.map(e => e.palpite_id))
              // palpites do usuário que ficaram fora do top 5
              const myExtra = currentUser
                ? ranking.filter(e => e.usuario_id === currentUser.id && !top5Ids.has(e.palpite_id))
                : []

              function RankRow({ entry, idx, showPos }: { entry: typeof ranking[0]; idx: number; showPos?: boolean }) {
                const pct   = Math.round((entry.total_pontos / maxPts) * 100)
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : String(entry.posicao)
                const isMe  = currentUser && entry.usuario_id === currentUser.id
                return (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 12px', background: isMe ? 'rgba(74,144,217,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isMe ? 'rgba(74,144,217,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 22, gap: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.50)' }}>{medal}</span>
                      {entry.variacao_posicao !== 0 && (
                        <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, color: entry.variacao_posicao > 0 ? '#4ade80' : 'rgba(255,100,100,0.85)' }}>
                          {entry.variacao_posicao > 0 ? `▲${entry.variacao_posicao}` : `▼${Math.abs(entry.variacao_posicao)}`}
                        </span>
                      )}
                    </div>
                    <PalpiteAvatar nome={entry.nome} avatarType={entry.avatar_type} avatarValue={entry.avatar_value} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{trunc(entry.nome, 20)}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap' }}>{trunc(entry.usuario_nome, 30)}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 52 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#4A90D9' }}>{entry.total_pontos} pts</span>
                        {entry.variacao !== 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: entry.variacao > 0 ? '#4ade80' : 'rgba(255,100,100,0.85)' }}>
                            {entry.variacao > 0 ? `▲ +${entry.variacao}` : `▼ ${entry.variacao}`}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 1, whiteSpace: 'nowrap' }}>
                        {entry.acertos_exatos} {entry.acertos_exatos === 1 ? 'acerto' : 'acertos'}
                      </div>
                    </div>
                    {/* barra de desempenho — borda inferior do card, sem track */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 }}>
                      <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(74,222,128,0.55), rgba(74,222,128,0.15))', width: `${pct}%` }} />
                    </div>
                  </div>
                )
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {ranking.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 12, padding: '12px 0' }}>Nenhum palpite ativo ainda</p>
                  )}
                  {top5.map((entry, idx) => (
                    <RankRow key={entry.palpite_id} entry={entry} idx={idx} />
                  ))}
                  {myExtra.length > 0 && (
                    <>
                      {/* separador "· · ·" indicando que há posições entre o top 5 e o usuário */}
                      <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 4, padding: '2px 0' }}>· · ·</div>
                      {myExtra.map((entry) => (
                        <RankRow key={entry.palpite_id} entry={entry} idx={entry.posicao - 1} />
                      ))}
                    </>
                  )}
                </div>
              )
            })()}
        </div>

        {/* R2C1 — Próximas Partidas */}
        <div className="dash-card-proximas" style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Próximas Partidas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(proximosJogos ?? []).slice(0, 5).map((j: JogoCopa) => {
              const isToday   = j.data === hoje
              const hasPlacar = !!j.resultado
              const counts    = pctMap[j.id]
              const showPct   = counts && counts.total > 0
              return (
                <div key={j.id} style={{
                  padding: '8px 10px',
                  background: isToday ? 'rgba(74,144,217,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isToday ? 'rgba(74,144,217,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 7,
                }}>
                  {/* times + placar */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                        <span style={{ textAlign: 'right' }}>{j.time_a}</span>
                        {j.codigo_pais_a && <FlagImg codigo={j.codigo_pais_a} size={16} />}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)' }}>{formatDate(j.data)}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0 10px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#4A90D9' }}>
                        {hasPlacar ? `${j.resultado!.placar_real_a} – ${j.resultado!.placar_real_b}` : '– –'}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3,
                        background: hasPlacar ? 'rgba(74,144,217,0.15)' : isToday ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.07)',
                        color: hasPlacar ? '#7BB8F0' : isToday ? '#4ade80' : 'rgba(255,255,255,0.5)',
                      }}>
                        {hasPlacar ? 'Encerrado' : isToday ? `Hoje ${formatTime(j.horario)}h` : `Amanhã ${formatTime(j.horario)}h`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                        {j.codigo_pais_b && <FlagImg codigo={j.codigo_pais_b} size={16} />}
                        <span>{j.time_b}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)' }}>{j.cidade}</div>
                    </div>
                  </div>
                  {/* barras de % palpites */}
                  {showPct && (
                    <div style={{ marginTop: 7 }}>
                      <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden' }}>
                        {counts.winA > 0 && <div style={{ flex: counts.winA, background: '#4A90D9' }} />}
                        {counts.draw > 0 && <div style={{ flex: counts.draw, background: '#F59E0B' }} />}
                        {counts.winB > 0 && <div style={{ flex: counts.winB, background: '#7BB8F0' }} />}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.50)', marginTop: 3 }}>
                        <span>{pct(counts.winA, counts.total)}% vitória <span style={{ color: 'rgba(255,255,255,0.30)' }}>({counts.winA})</span></span>
                        <span>{pct(counts.draw, counts.total)}% empate <span style={{ color: 'rgba(255,255,255,0.30)' }}>({counts.draw})</span></span>
                        <span>{pct(counts.winB, counts.total)}% vitória <span style={{ color: 'rgba(255,255,255,0.30)' }}>({counts.winB})</span></span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {!(proximosJogos?.length) && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 12, padding: '20px 0' }}>Nenhuma partida em breve</p>
            )}
          </div>
        </div>

        {/* R2C2 — Tabela Oficial */}
        <div className="dash-card-tabela" style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8 }}>Tabela oficial</div>
              {nextGSGroups.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                  Grupos com jogos hoje
                </div>
              )}
            </div>
            <Link href="/tabela" style={{ fontSize: 10, color: '#4A90D9', fontWeight: 500, textDecoration: 'none', letterSpacing: 0 }}>ver todos →</Link>
          </div>

          {displayGroups.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 12, padding: '16px 0' }}>Grupos em breve</p>
          ) : displayGroups.map((grupo, gi) => (
            <div key={grupo} style={{ marginBottom: gi < displayGroups.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4A90D9', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Grupo {grupo}
              </div>
              <div className="dash-table-cols" style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '0 4px 3px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span>#</span><span style={{ textAlign: 'left' }}>Seleção</span><span>J</span><span>V</span><span>SG</span><span className="rank-acertos">GP</span><span>Pts</span>
              </div>
              {(byGrupo[grupo] ?? []).length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 11, padding: '6px 0' }}>Jogos em breve</p>
              ) : (byGrupo[grupo] ?? []).map((row: ClassificacaoGrupo, idx: number) => {
                const q     = idx < 2
                const sgStr = row.dg > 0 ? `+${row.dg}` : String(row.dg)
                return (
                  <div key={row.pais_nome} className="dash-table-cols" style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '4px 4px', alignItems: 'center', fontSize: 11, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', background: q ? 'rgba(74,144,217,0.07)' : 'transparent', borderRadius: q ? 4 : 0 }}>
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

        {/* R3C1+C2 — Boletim da Copa 2026 */}
        <div className="dash-card-boletim" style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px', gridColumn: 'span 2' }}>
          {/* cabeçalho */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Boletim da Copa 2026
              {totalBoletins != null && (
                <span style={{ color: '#7BB8F0', marginLeft: 6 }}>
                  · Edição no. {totalBoletins}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Resumo do dia · gerado por IA</div>
          </div>

          {!ultimoBoletim ? (
            /* estado vazio */
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
              O primeiro boletim será publicado hoje às 7h. ☀️
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* único boletim — o mais recente */}
              {(() => {
                const b = ultimoBoletim
                const dt = new Date(b.gerado_em)
                const dataHora = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
                return (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(74,144,217,0.10)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.60)' }}>{dataHora}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>
                      {b.conteudo.split('\n').map((line, i) => {
                        const parts = line.split(/(\*\*.*?\*\*)/)
                        return (
                          <p key={i} style={{ margin: line.startsWith('**') ? '8px 0 2px' : '0 0 2px', color: line.startsWith('**') ? 'white' : undefined, fontWeight: line.startsWith('**') ? 700 : undefined, fontSize: line.startsWith('**') ? 11 : 13 }}>
                            {parts.map((part, j) =>
                              part.startsWith('**') && part.endsWith('**')
                                ? <strong key={j} style={{ color: 'white', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{part.slice(2, -2)}</strong>
                                : part
                            )}
                          </p>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* link para página Meu Dia */}
              {currentUser && (
                <Link href="/meu-dia" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.20)', borderRadius: 8, textDecoration: 'none', color: '#7BB8F0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  🎯 Ver meu dia no bolão →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* R2-3 C3 — Artilheiro da Copa */}
        <div className="dash-card-artilheiro" style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8 }}>⚽ Artilheiros da Copa</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                Atualizado a cada 30 min · football-data.org
              </div>
            </div>
            {artilheiros && artilheiros.length > 0 && (() => {
              const ultima = new Date((artilheiros as { atualizado_em: string }[])[0].atualizado_em)
              const hora = ultima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
              return (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap' }}>
                  {hora}
                </span>
              )
            })()}
          </div>

          {!artilheiros || artilheiros.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12, padding: '20px 0', fontStyle: 'italic' }}>
              Aguardando primeiro jogo…
            </p>
          ) : (
            <>
              {/* cabeçalho de colunas */}
              <div style={{ display: 'grid', gridTemplateColumns: '18px 16px 1fr 24px 24px 22px', gap: 4, padding: '0 4px 5px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
                <span />
                <span />
                <span>Jogador</span>
                <span style={{ textAlign: 'center' }}>G</span>
                <span style={{ textAlign: 'center' }}>A</span>
                <span style={{ textAlign: 'center' }}>J</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(artilheiros as { id: number; jogador: string; seleção: string; escudo_url: string | null; gols: number; assistencias: number | null; penaltis: number | null; jogos: number }[]).map((a, i) => {
                  const isFirst  = i === 0
                  const medal    = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                  const goalColor = isFirst ? '#FFD700' : '#4A90D9'
                  const pens     = a.penaltis ?? 0
                  return (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '18px 16px 1fr 24px 24px 22px', gap: 4, alignItems: 'center', padding: '5px 4px', background: isFirst ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isFirst ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.04)'}`, borderRadius: 6 }}>
                      {/* posição */}
                      <span style={{ fontSize: medal ? 11 : 9, fontWeight: 700, color: medal ? undefined : 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1 }}>
                        {medal ?? `${i + 1}`}
                      </span>
                      {/* escudo */}
                      {a.escudo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={a.escudo_url} alt={a.seleção} width={14} height={14} style={{ objectFit: 'contain', display: 'block' }} />
                        : <span />
                      }
                      {/* nome + seleção */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.jogador}
                        </div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.seleção}{pens > 0 ? ` · ${pens} pên` : ''}
                        </div>
                      </div>
                      {/* gols */}
                      <span style={{ fontSize: 13, fontWeight: 700, color: goalColor, textAlign: 'center' }}>{a.gols}</span>
                      {/* assistências */}
                      <span style={{ fontSize: 11, fontWeight: 500, color: (a.assistencias ?? 0) > 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.20)', textAlign: 'center' }}>
                        {a.assistencias ?? 0}
                      </span>
                      {/* jogos */}
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', textAlign: 'center' }}>{a.jogos}</span>
                    </div>
                  )
                })}
              </div>
              {/* legenda */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                {[['G','Gols'],['A','Assistências'],['J','Jogos']].map(([k,v]) => (
                  <span key={k} style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                    <strong style={{ color: 'rgba(255,255,255,0.45)' }}>{k}</strong> {v}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
