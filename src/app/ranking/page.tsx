// v2
import { createClient } from '@/lib/supabase/server'
import { getRanking } from '@/services/ranking'
import type { RankingEntry } from '@/types'

import { PalpiteAvatar } from '@/components/ui/PalpiteAvatar'
import { RankingEvolutionChart, type ChartSeries } from '@/components/ranking/RankingEvolutionChart'
import { RankingBarChart } from '@/components/ranking/RankingBarChart'

export const dynamic = 'force-dynamic'

const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s

/* ─── Pódio Opçao 4 — plataforma de altura ─────────────────────────────────── */
function Podium({ top3, myIds }: { top3: RankingEntry[]; myIds: number[] }) {
  // ordem visual: 2º, 1º, 3º
  const order  = [1, 0, 2]
  const medals = ['🥇', '🥈', '🥉']
  const platformH = [28, 42, 18] // 2º, 1º, 3º
  const platformColors = [
    'rgba(192,192,192,0.12)',
    'rgba(255,215,0,0.12)',
    'rgba(205,127,50,0.12)',
  ]
  const platformBorders = [
    'rgba(192,192,192,0.20)',
    'rgba(255,215,0,0.25)',
    'rgba(205,127,50,0.20)',
  ]
  const topBarColors = [
    'rgba(192,192,192,0.45)',
    'linear-gradient(90deg,#b8860b,#FFD700,#b8860b)',
    'rgba(205,127,50,0.45)',
  ]
  const cardBorders = [
    'rgba(74,144,217,0.15)',
    'rgba(255,215,0,0.30)',
    'rgba(74,144,217,0.15)',
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'flex-end', gap: 0, marginBottom: 20 }}>
      {order.map((idx) => {
        const entry  = top3[idx]
        if (!entry) return <div key={idx} />
        const isFirst = idx === 0
        const isMe    = myIds.includes(entry.palpite_id)
        const vi      = order.indexOf(idx) // visual index (0=left=2nd, 1=center=1st, 2=right=3rd)

        return (
          <div key={entry.palpite_id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {/* card */}
            <div style={{
              width: '100%',
              background: '#0D1E3D',
              border: `1px solid ${cardBorders[vi]}`,
              borderRadius: '10px 10px 0 0',
              padding: '12px 10px 10px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'visible',
            }}>
              {/* barra topo */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: topBarColors[vi],
              }} />
              {/* coroa */}
              {isFirst && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', fontSize: 16, lineHeight: 1 }}>
                  👑
                </div>
              )}
              {/* medalha */}
              <div style={{ fontSize: 16, marginBottom: 5 }}>{medals[idx]}</div>
              {/* avatar */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                <PalpiteAvatar
                  nome={entry.nome}
                  avatarType={entry.avatar_type}
                  avatarValue={entry.avatar_value}
                  size={32}
                />
              </div>
              {/* nome + usuário — uma linha */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'nowrap', maxWidth: '100%' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>
                  {trunc(entry.nome, 20)}
                </span>
                {isMe && (
                  <span style={{ fontSize: 7, background: 'rgba(74,144,217,0.2)', color: '#7BB8F0', padding: '1px 4px', borderRadius: 5, flexShrink: 0 }}>
                    você
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {trunc(entry.usuario_nome, 30)}
              </div>
              {/* divisor */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '7px 0' }} />
              {/* pontos */}
              <div style={{ fontSize: 15, fontWeight: 800, color: '#4A90D9', lineHeight: 1 }}>
                {entry.total_pontos}
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>pts</div>
              {/* variação */}
              {entry.variacao !== 0 && (
                <div style={{ fontSize: 8, fontWeight: 700, marginTop: 3, color: entry.variacao > 0 ? '#4ade80' : 'rgba(255,100,100,0.85)' }}>
                  {entry.variacao > 0 ? `▲ +${entry.variacao}` : `▼ ${entry.variacao}`}
                </div>
              )}
            </div>

            {/* plataforma */}
            <div style={{
              width: '100%',
              height: platformH[vi],
              background: platformColors[vi],
              border: `1px solid ${platformBorders[vi]}`,
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {idx + 1}°
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export default async function RankingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ranking = await getRanking()

  let myPalpiteIds: number[] = []
  if (user) {
    const { data: myPalpites } = await supabase
      .from('palpites').select('id').eq('usuario_id', user.id)
    myPalpiteIds = (myPalpites ?? []).map((p: { id: number }) => p.id)
  }

  /* ── histórico para o gráfico ────────────────────────────────────────────── */
  const activeIds = ranking.map(r => r.palpite_id)
  let chartSeries: ChartSeries[] = []
  let chartDatas:  string[]      = []

  // Data de hoje em BRT (UTC-3) para injetar como ponto ao vivo
  const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

  if (activeIds.length > 0) {
    const { data: historico } = await supabase
      .from('ranking_historico')
      .select('palpite_id, data, total_pontos')
      .in('palpite_id', activeIds)
      .order('data', { ascending: true })

    // posição oficial por dia (desempatada por acertos exatos) — tabela aditiva nova
    const { data: historicoCompleto } = await supabase
      .from('ranking_historico_completo')
      .select('palpite_id, data, posicao')
      .in('palpite_id', activeIds)
    const posicaoPorDiaMap: Record<string, number> = {}
    for (const h of (historicoCompleto ?? []) as { palpite_id: number; data: string; posicao: number }[]) {
      posicaoPorDiaMap[`${h.palpite_id}|${h.data}`] = h.posicao
    }

    // Monta mapa de pontos ao vivo por palpite_id (do ranking em tempo real)
    const livePontos: Record<number, number> = {}
    for (const r of ranking) livePontos[r.palpite_id] = r.total_pontos

    // Combina histórico + ponto ao vivo de hoje
    // Se já existe snapshot de hoje no historico, o ponto ao vivo o substitui
    const historicoFiltrado = (historico ?? []).filter(
      (h: { data: string }) => h.data !== todayBRT
    )
    const liveRows = activeIds.map(id => ({
      palpite_id:   id,
      data:         todayBRT,
      total_pontos: livePontos[id] ?? 0,
    }))
    const historicoComHoje = [...historicoFiltrado, ...liveRows]

    /* datas únicas (inclui hoje) */
    chartDatas = [...new Set(historicoComHoje.map((h: { data: string }) => h.data))].sort()

    // Garante pelo menos 2 pontos para o chart renderizar:
    // se só existe hoje, injeta ontem com zero como baseline
    if (chartDatas.length === 1) {
      const ontem = new Date(Date.now() - 3 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10)
      chartDatas = [ontem, ...chartDatas]
    }

    /* top 20 + palpites do usuário logado (sem duplicar) */
    const top20Ids  = ranking.slice(0, 20).map(r => r.palpite_id)
    const chartIds  = [...new Set([...top20Ids, ...myPalpiteIds])]
    const chartRank = ranking.filter(r => chartIds.includes(r.palpite_id))

    chartSeries = chartRank.map(r => ({
      palpite_id:     r.palpite_id,
      nome:           r.nome,
      isMe:           myPalpiteIds.includes(r.palpite_id),
      avatar_type:    r.avatar_type,
      avatar_value:   r.avatar_value,
      posicaoOficial: r.posicao,
      historico:      historicoComHoje
        .filter((h: { palpite_id: number }) => h.palpite_id === r.palpite_id)
        .map((h: { data: string; total_pontos: number }) => ({
          data: h.data,
          total_pontos: h.total_pontos,
          // hoje usa a posição ao vivo (sempre atualizada); dias passados usam o
          // snapshot de ranking_historico_completo quando existir
          posicao: h.data === todayBRT ? r.posicao : posicaoPorDiaMap[`${r.palpite_id}|${h.data}`],
        })),
    }))
  }

  return (
    <div className="page-main" style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Ranking geral</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
            {ranking.length} palpite{ranking.length !== 1 ? 's' : ''} ativo{ranking.length !== 1 ? 's' : ''} · atualizado em tempo real
          </div>
        </div>
        <div style={{ background: 'rgba(74,144,217,0.18)', border: '1px solid rgba(74,144,217,0.35)', color: '#7BB8F0', fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, background: '#4ade80', borderRadius: '50%', display: 'inline-block' }} />
          Fase de grupos
        </div>
      </div>

      {ranking.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          Nenhum palpite ativo ainda.
        </div>
      ) : (
        <>
          {/* pódio */}
          {ranking.length >= 3 && (
            <Podium top3={ranking.slice(0, 3)} myIds={myPalpiteIds} />
          )}

          {/* gráfico de evolução */}
          {chartSeries.length >= 2 && chartDatas.length >= 2 && (
            <RankingEvolutionChart series={chartSeries} datas={chartDatas} />
          )}

          {/* gráfico de barras */}
          <RankingBarChart ranking={ranking} myIds={myPalpiteIds} />

          {/* tabela ranking */}
          <div className="rank-table-wrap" style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
            {/* cabeçalho desktop */}
            <div className="rank-header" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 80px 100px', padding: '8px 18px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
              <span style={{ textAlign: 'center' }}>#</span>
              <span>Palpite</span>
              <span className="rank-acertos" style={{ textAlign: 'center' }}>Acertos</span>
              <span style={{ textAlign: 'right' }}>Pontos</span>
            </div>

            <div className="rank-table-body">
              {ranking.map((entry, idx) => {
                const isMe    = myPalpiteIds.includes(entry.palpite_id)
                const posColor = entry.posicao === 1 ? '#FFD700'
                  : entry.posicao === 2 ? '#C0C0C0'
                  : entry.posicao === 3 ? '#CD7F32'
                  : isMe ? '#4A90D9'
                  : 'rgba(255,255,255,0.25)'
                const maxPts = ranking[0]?.total_pontos ?? 0
                const pct    = maxPts > 0 ? Math.round((entry.total_pontos / maxPts) * 100) : 0

                return (
                  <div key={entry.palpite_id}
                    className={`rank-row${isMe ? ' rank-me' : ''}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '50px 1fr 80px 100px',
                      padding: '11px 18px 13px', alignItems: 'center', fontSize: 13,
                      borderBottom: idx < ranking.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      background: isMe ? 'rgba(74,144,217,0.07)' : 'transparent',
                      borderLeft: isMe ? '2px solid #4A90D9' : '2px solid transparent',
                      position: 'relative', overflow: 'hidden',
                    }}>

                    {/* posição + variação */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span className="rank-pos" style={{ fontSize: 14, fontWeight: 700, color: posColor, textAlign: 'center' }}>
                        {entry.posicao}
                      </span>
                      {entry.variacao_posicao !== 0 && (
                        <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, color: entry.variacao_posicao > 0 ? '#4ade80' : 'rgba(255,100,100,0.85)' }}>
                          {entry.variacao_posicao > 0 ? `▲${entry.variacao_posicao}` : `▼${Math.abs(entry.variacao_posicao)}`}
                        </span>
                      )}
                    </div>

                    {/* nome + usuário */}
                    <div className="rank-info" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <span className="rank-avatar-mobile" style={{ display: 'none' }}>
                        <PalpiteAvatar nome={entry.nome} avatarType={entry.avatar_type} avatarValue={entry.avatar_value} size={28} />
                      </span>
                      <span className="rank-avatar-desktop" style={{ display: 'inline-flex' }}>
                        <PalpiteAvatar nome={entry.nome} avatarType={entry.avatar_type} avatarValue={entry.avatar_value} size={36} />
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="rank-nome" style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                            {entry.nome}
                          </span>
                          {isMe && <span style={{ fontSize: 8, background: 'rgba(74,144,217,0.2)', color: '#7BB8F0', padding: '1px 5px', borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>você</span>}
                        </div>
                        <span className="rank-usuario" style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                          {entry.usuario_nome}
                        </span>
                      </div>
                    </div>

                    {/* acertos */}
                    <span className="rank-acertos" style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                      {entry.acertos_exatos + entry.acertos_vencedor}
                    </span>

                    {/* pontos + variação */}
                    <div style={{ textAlign: 'right' }}>
                      <div className="rank-pts" style={{ fontSize: 15, fontWeight: 800, color: '#4A90D9' }}>
                        {entry.total_pontos} pts
                      </div>
                      {entry.variacao !== 0 && (
                        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: entry.variacao > 0 ? '#4ade80' : 'rgba(255,100,100,0.85)' }}>
                          {entry.variacao > 0 ? `▲ +${entry.variacao} pts` : `▼ ${entry.variacao} pts`}
                        </div>
                      )}
                      {/* acertos exatos — só mobile, onde a coluna dedicada fica oculta */}
                      <div className="rank-acertos-mobile">
                        {entry.acertos_exatos} acerto{entry.acertos_exatos !== 1 ? 's' : ''}
                      </div>
                    </div>

                    {/* barra de desempenho — borda inferior da linha */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 }}>
                      <div style={{ height: 2, background: 'linear-gradient(90deg, rgba(74,222,128,0.55), rgba(74,222,128,0.15))', width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
