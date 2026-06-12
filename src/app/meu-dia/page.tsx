import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRanking } from '@/services/ranking'

export const dynamic = 'force-dynamic'

export default async function MeuDiaPage() {
  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) redirect('/auth/login')

  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const hoje   = brtNow.toISOString().split('T')[0]
  const ontem  = new Date(brtNow.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { data: meusPalpites },
    { data: jogosOntemData },
    { data: jogosHojeData },
    ranking,
  ] = await Promise.all([
    supabase.from('palpites').select('id, nome').eq('usuario_id', currentUser.id).eq('status', 'ativo').order('criado_em'),
    supabase.from('jogos_copa').select('id, time_a, time_b, resultado:resultados(placar_real_a, placar_real_b)').eq('data', ontem).order('horario'),
    supabase.from('jogos_copa').select('id, time_a, time_b, horario, resultado:resultados(placar_real_a, placar_real_b)').eq('data', hoje).order('horario'),
    getRanking(),
  ])

  const palpiteIds   = (meusPalpites ?? []).map((p: { id: number }) => p.id)
  const jogoIdsOntem = (jogosOntemData ?? []).map((j: { id: number }) => j.id)
  const jogoIdsHoje  = (jogosHojeData  ?? []).map((j: { id: number }) => j.id)

  const { data: pjOntem } = palpiteIds.length && jogoIdsOntem.length
    ? await supabase.from('palpites_jogos')
        .select('palpite_id, jogo_id, placar_palpite_a, placar_palpite_b, pontos')
        .in('palpite_id', palpiteIds).in('jogo_id', jogoIdsOntem)
    : { data: [] }

  const { data: pjHoje } = palpiteIds.length && jogoIdsHoje.length
    ? await supabase.from('palpites_jogos')
        .select('palpite_id, jogo_id, placar_palpite_a, placar_palpite_b, pontos')
        .in('palpite_id', palpiteIds).in('jogo_id', jogoIdsHoje)
    : { data: [] }

  // rivais — 2 acima e 2 abaixo de cada palpite
  const rivalIds: number[] = []
  for (const pid of palpiteIds) {
    const pos = ranking.find(r => r.palpite_id === pid)?.posicao
    if (pos != null) {
      for (const delta of [-2, -1, 1, 2]) {
        const rival = ranking.find(r => r.posicao === pos + delta)
        if (rival) rivalIds.push(rival.palpite_id)
      }
    }
  }
  const uniqueRivalIds = [...new Set(rivalIds.filter(id => !palpiteIds.includes(id)))]

  const { data: pjRivaisHoje } = uniqueRivalIds.length && jogoIdsHoje.length
    ? await supabase.from('palpites_jogos')
        .select('palpite_id, jogo_id, placar_palpite_a, placar_palpite_b')
        .in('palpite_id', uniqueRivalIds).in('jogo_id', jogoIdsHoje)
    : { data: [] }

  type PJ = { palpite_id: number; jogo_id: number; placar_palpite_a: number | null; placar_palpite_b: number | null; pontos: number }
  type Jogo = { id: number; time_a: string; time_b: string; horario?: string; resultado: { placar_real_a: number; placar_real_b: number } | null }

  const jogosOntem = (jogosOntemData ?? []) as unknown as Jogo[]
  const jogosHoje  = (jogosHojeData  ?? []) as unknown as Jogo[]

  const pontosOntemPorPalpite: Record<number, number> = {}
  for (const pj of (pjOntem ?? []) as PJ[]) {
    pontosOntemPorPalpite[pj.palpite_id] = (pontosOntemPorPalpite[pj.palpite_id] ?? 0) + pj.pontos
  }

  const temOntem = jogosOntem.some(j => j.resultado)
  const temHoje  = jogosHoje.length > 0

  const fmt = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

  /* ── shared styles ── */
  const sectionTitle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  }
  const subLabel: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.80)',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  }
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 12px',
  }

  return (
    <div className="page-main" style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 60px' }}>

      {/* ── cabeçalho ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'white', letterSpacing: 1, lineHeight: 1 }}>
          🎯 Meu Dia no Bolão
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)', marginTop: 4 }}>
          Uma análise de ontem e possibilidades para hoje.
        </div>
      </div>

      {/* ── Seu dia ── */}
      {!temOntem && !temHoje ? (
        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.20)', borderRadius: 10, padding: '16px 18px', marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', textAlign: 'center' }}>
          Nenhum jogo encontrado para ontem ou hoje.
        </div>
      ) : (
        <div className="meu-dia-row" style={{ marginBottom: 16 }}>

          {/* ontem */}
          {temOntem && (
            <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.20)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={subLabel}>Ontem · {fmt(ontem)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(meusPalpites as { id: number; nome: string }[]).map(p => {
                    const ptsTotais = pontosOntemPorPalpite[p.id] ?? 0
                    const linhas = jogosOntem.filter(j => j.resultado).map(j => ({
                      jogo: j,
                      pj: (pjOntem as PJ[]).find(x => x.palpite_id === p.id && x.jogo_id === j.id),
                    }))
                    return (
                      <div key={p.id} style={{ ...card, border: '1px solid rgba(74,144,217,0.10)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{p.nome}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: ptsTotais > 0 ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
                            {ptsTotais > 0 ? `+${ptsTotais} pts` : '0 pts'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {linhas.map(({ jogo, pj }) => {
                            const apostou = pj?.placar_palpite_a != null ? `${pj.placar_palpite_a}×${pj.placar_palpite_b}` : '—'
                            const real    = `${jogo.resultado!.placar_real_a}×${jogo.resultado!.placar_real_b}`
                            const pts     = pj?.pontos ?? 0
                            const acertou = pts > 0
                            return (
                              <div key={jogo.id} style={{ display: 'flex', alignItems: 'stretch', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(74,144,217,0.08)', borderLeft: `3px solid ${acertou ? '#4ade80' : 'rgba(255,100,100,0.55)'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, flexShrink: 0, fontSize: 13, color: acertou ? '#4ade80' : 'rgba(255,100,100,0.75)' }}>
                                  {acertou ? '✓' : '✗'}
                                </div>
                                <div style={{ flex: 1, padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)' }}>{jogo.time_a} × {jogo.time_b}</span>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                                    <span>apostei <b style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{apostou}</b></span>
                                    <span style={{ color: 'rgba(255,255,255,0.20)' }}>|</span>
                                    <span>real <b style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{real}</b></span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, flexShrink: 0, fontSize: 12, fontWeight: 700, borderLeft: '1px solid rgba(74,144,217,0.08)', color: acertou ? '#4ade80' : 'rgba(255,255,255,0.25)' }}>
                                  {acertou ? `+${pts}` : '0'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
            </div>
          )}

          {/* hoje */}
          {temHoje && (
            <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.20)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={subLabel}>Hoje · {fmt(hoje)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(meusPalpites as { id: number; nome: string }[]).map(p => (
                    <div key={p.id} style={{ ...card, border: '1px solid rgba(74,144,217,0.10)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 8 }}>{p.nome}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {jogosHoje.map(j => {
                          const pj      = (pjHoje as PJ[]).find(x => x.palpite_id === p.id && x.jogo_id === j.id)
                          const apostou = pj?.placar_palpite_a != null ? `${pj.placar_palpite_a}×${pj.placar_palpite_b}` : '—'
                          const enc     = !!j.resultado
                          const pts     = pj?.pontos ?? 0
                          const acertou = enc && pts > 0
                          return (
                            <div key={j.id} style={{ display: 'flex', alignItems: 'stretch', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(74,144,217,0.08)', borderLeft: enc ? `3px solid ${acertou ? '#4ade80' : 'rgba(255,100,100,0.55)'}` : '3px solid rgba(74,144,217,0.30)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, flexShrink: 0, fontSize: enc ? 13 : 11, color: enc ? (acertou ? '#4ade80' : 'rgba(255,100,100,0.75)') : 'rgba(255,255,255,0.30)' }}>
                                {enc ? (acertou ? '✓' : '✗') : j.horario?.slice(0,5)}
                              </div>
                              <div style={{ flex: 1, padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)' }}>{j.time_a} × {j.time_b}</span>
                                {enc ? (
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                                    <span>apostei <b style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{apostou}</b></span>
                                    <span style={{ color: 'rgba(255,255,255,0.20)' }}>|</span>
                                    <span>real <b style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{j.resultado!.placar_real_a}×{j.resultado!.placar_real_b}</b></span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#4A90D9', fontWeight: 600 }}>apostei {apostou}</span>
                                )}
                              </div>
                              {enc && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, flexShrink: 0, fontSize: 12, fontWeight: 700, borderLeft: '1px solid rgba(74,144,217,0.08)', color: acertou ? '#4ade80' : 'rgba(255,255,255,0.25)' }}>
                                  {acertou ? `+${pts}` : '0'}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}
        </div>
      )}

      {/* ── Olhando para cima e para baixo ── */}
      {palpiteIds.length > 0 && jogoIdsHoje.length > 0 && (() => {
        type RankEntry = typeof ranking[0]
        const pjRivaisTyped = (pjRivaisHoje ?? []) as { palpite_id: number; jogo_id: number; placar_palpite_a: number | null; placar_palpite_b: number | null }[]

        const blocos = (meusPalpites as { id: number; nome: string }[]).map(p => {
          const myRank = ranking.find(r => r.palpite_id === p.id)
          if (!myRank) return null

          const rivaisAcima: RankEntry[] = []
          const rivaisAbaixo: RankEntry[] = []
          // acima: mais distante primeiro (delta 2 → delta 1)
          for (const delta of [2, 1]) {
            const r = ranking.find(e => e.posicao === myRank.posicao - delta)
            if (r) rivaisAcima.push(r)
          }
          // abaixo: menos distante primeiro (delta 1 → delta 2)
          for (const delta of [1, 2]) {
            const r = ranking.find(e => e.posicao === myRank.posicao + delta)
            if (r) rivaisAbaixo.push(r)
          }

          return { p, myRank, rivaisAcima, rivaisAbaixo }
        }).filter(Boolean)

        if (!blocos.length) return null

        return (
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ ...sectionTitle, color: 'rgba(255,255,255,0.75)' }}>🔭 Olhando para cima e para baixo</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {blocos.map(bloco => {
                const { p, myRank, rivaisAcima, rivaisAbaixo } = bloco!
                return (
                  <div key={p.id}>
                    {/* cabeçalho do palpite */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 10px', background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.20)', borderRadius: 7 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#4A90D9' }}>#{myRank.posicao}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'white', flex: 1 }}>{p.nome}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#4A90D9' }}>{myRank.total_pontos} pts</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* rivais acima */}
                      {rivaisAcima.length > 0 ? rivaisAcima.map(rival => (
                        <RivalCard
                          key={rival.palpite_id}
                          rival={rival}
                          direcao="acima"
                          diff={rival.total_pontos - myRank.total_pontos}
                          jogosHoje={jogosHoje}
                          pjRivais={pjRivaisTyped}
                        />
                      )) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,215,0,0.7)', fontStyle: 'italic', padding: '6px 0' }}>🏆 Você está na liderança com este palpite!</div>
                      )}

                      {/* divisor — posição do usuário */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(74,144,217,0.20)' }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(74,144,217,0.60)', textTransform: 'uppercase', letterSpacing: 0.5 }}>você · #{myRank.posicao}</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(74,144,217,0.20)' }} />
                      </div>

                      {/* rivais abaixo */}
                      {rivaisAbaixo.length > 0 ? rivaisAbaixo.map(rival => (
                        <RivalCard
                          key={rival.palpite_id}
                          rival={rival}
                          direcao="abaixo"
                          diff={myRank.total_pontos - rival.total_pontos}
                          jogosHoje={jogosHoje}
                          pjRivais={pjRivaisTyped}
                        />
                      )) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', fontStyle: 'italic', padding: '6px 0' }}>Nenhum palpite atrás de você ainda.</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

/* ── componente de rival ── */
function RivalCard({
  rival, direcao, diff, jogosHoje, pjRivais,
}: {
  rival: { palpite_id: number; nome: string; posicao: number; total_pontos: number }
  direcao: 'acima' | 'abaixo'
  diff: number
  jogosHoje: { id: number; time_a: string; time_b: string; horario?: string; resultado: { placar_real_a: number; placar_real_b: number } | null }[]
  pjRivais: { palpite_id: number; jogo_id: number; placar_palpite_a: number | null; placar_palpite_b: number | null }[]
}) {
  const acima     = direcao === 'acima'
  const cor       = acima ? 'rgba(255,100,100,0.85)' : '#4ade80'
  const borderCor = acima ? 'rgba(255,100,100,0.18)' : 'rgba(74,222,128,0.18)'
  const bgCor     = acima ? 'rgba(255,100,100,0.04)' : 'rgba(74,222,128,0.04)'

  return (
    <div style={{ background: bgCor, border: `1px solid ${borderCor}`, borderRadius: 7, padding: '10px 12px' }}>
      {/* cabeçalho rival */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: cor }}>{acima ? '▲' : '▼'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{rival.nome}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>#{rival.posicao}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: cor }}>
            {acima ? `+${diff} à frente` : `-${diff} atrás`}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)' }}>{rival.total_pontos} pts</div>
        </div>
      </div>

      {/* palpites do rival para hoje */}
      <div style={{ borderTop: `1px solid ${borderCor}`, paddingTop: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Apostas de hoje
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {jogosHoje.map(j => {
            const pj      = pjRivais.find(x => x.palpite_id === rival.palpite_id && x.jogo_id === j.id)
            const apostou = pj?.placar_palpite_a != null ? `${pj.placar_palpite_a}×${pj.placar_palpite_b}` : '—'
            const enc     = !!j.resultado
            return (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', minWidth: 36 }}>{j.horario?.slice(0, 5)}h</span>
                <span style={{ color: 'rgba(255,255,255,0.65)', flex: 1 }}>{j.time_a} × {j.time_b}</span>
                {enc ? (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.35)' }}>{apostou}</span>
                    <span style={{ color: 'rgba(255,255,255,0.50)' }}>· real {j.resultado!.placar_real_a}×{j.resultado!.placar_real_b}</span>
                  </>
                ) : (
                  <span style={{ color: pj ? cor : 'rgba(255,255,255,0.25)', fontWeight: pj ? 600 : 400 }}>{apostou}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
