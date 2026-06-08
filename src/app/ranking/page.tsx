import { createClient } from '@/lib/supabase/server'
import { getRanking } from '@/services/ranking'
import type { RankingEntry } from '@/types'
import { PalpiteAvatar } from '@/components/ui/PalpiteAvatar'

export const dynamic = 'force-dynamic'

function Podium({ top3 }: { top3: RankingEntry[] }) {
  const order = [1, 0, 2]
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="podium-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: 10, marginBottom: 20, alignItems: 'end' }}>
      {order.map(idx => {
        const entry = top3[idx]
        if (!entry) return <div key={idx} />
        const isFirst = idx === 0
        return (
          <div key={entry.palpite_id}
            className={`podium-card${isFirst ? ' podium-first' : ''}`}
            style={{
              background: '#0D1E3D',
              border: `1px solid ${isFirst ? 'rgba(255,215,0,0.35)' : 'rgba(74,144,217,0.15)'}`,
              borderRadius: 10, padding: isFirst ? '22px 14px 16px' : '16px 14px',
              textAlign: 'center', position: 'relative', overflow: 'visible',
            }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: isFirst ? 'linear-gradient(90deg,#b8860b,#FFD700,#b8860b)' : 'rgba(74,144,217,0.3)' }} />
            {isFirst && <div className="podium-crown" style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', fontSize: 22 }}>👑</div>}
            <div className="podium-medal" style={{ fontSize: 26, marginBottom: 6 }}>{medals[idx]}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <PalpiteAvatar nome={entry.nome} avatarType={entry.avatar_type} avatarValue={entry.avatar_value} size={32} />
              <div className="podium-name" style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{entry.nome}</div>
            </div>
            <div className="podium-user" style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', margin: '2px 0 8px' }}>{entry.usuario_nome}</div>
            <div className="podium-pts" style={{ fontSize: 26, fontWeight: 800, color: '#4A90D9', lineHeight: 1 }}>{entry.total_pontos}</div>
            <div className="podium-pts-l" style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>pontos</div>
          </div>
        )
      })}
    </div>
  )
}

export default async function RankingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ranking = await getRanking()

  let myPalpiteIds: number[] = []
  if (user) {
    const { data: myPalpites } = await supabase.from('palpites').select('id').eq('usuario_id', user.id)
    myPalpiteIds = (myPalpites ?? []).map((p: { id: number }) => p.id)
  }

  return (
    <div className="page-main" style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 40px' }}>
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
          {ranking.length >= 3 && <Podium top3={ranking.slice(0, 3)} />}

          {/* Desktop table / Mobile card list */}
          <div className="rank-table-wrap" style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Desktop header */}
            <div className="rank-header" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 80px 90px 70px', padding: '8px 18px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
              <span style={{ textAlign: 'center' }}>#</span>
              <span>Palpite</span>
              <span className="rank-acertos" style={{ textAlign: 'center' }}>Acertos</span>
              <span style={{ textAlign: 'center' }}>Pontos</span>
              <span style={{ textAlign: 'center' }}>Variação</span>
            </div>

            {/* Rows — desktop: table grid; mobile: flex cards via CSS */}
            <div className="rank-table-body" style={{ display: 'contents' }}>
              {ranking.map((entry, idx) => {
                const isMe = myPalpiteIds.includes(entry.palpite_id)
                const posColor = entry.posicao === 1 ? '#FFD700' : entry.posicao === 2 ? '#C0C0C0' : entry.posicao === 3 ? '#CD7F32' : isMe ? '#4A90D9' : 'rgba(255,255,255,0.25)'
                return (
                  <div key={entry.palpite_id}
                    className={`rank-row${isMe ? ' rank-me' : ''}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '50px 1fr 80px 90px 70px',
                      padding: '11px 18px', alignItems: 'center', fontSize: 13,
                      borderBottom: idx < ranking.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      background: isMe ? 'rgba(74,144,217,0.07)' : 'transparent',
                      borderLeft: isMe ? '2px solid #4A90D9' : '2px solid transparent',
                    }}>
                    {/* pos */}
                    <span className="rank-pos" style={{ fontSize: 14, fontWeight: 700, color: posColor, textAlign: 'center' }}>{entry.posicao}</span>
                    {/* name + user */}
                    <div className="rank-info" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <PalpiteAvatar nome={entry.nome} avatarType={entry.avatar_type} avatarValue={entry.avatar_value} size={28} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                        {entry.nome}
                        {isMe && <span style={{ fontSize: 8, background: 'rgba(74,144,217,0.2)', color: '#7BB8F0', padding: '1px 5px', borderRadius: 6, fontWeight: 600, marginLeft: 5 }}>você</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)' }}>{entry.usuario_nome}</div>
                      </div>
                    </div>
                    {/* acertos — hidden on mobile */}
                    <span className="rank-acertos" style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                      {entry.acertos_exatos + entry.acertos_vencedor}
                    </span>
                    {/* pts */}
                    <div className="rank-right" style={{ display: 'contents' }}>
                      <span className="rank-pts" style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#4A90D9' }}>{entry.total_pontos}</span>
                      {/* variação */}
                      <span className="rank-var eq" style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.50)' }}>—</span>
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
