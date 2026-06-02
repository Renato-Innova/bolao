import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getRanking } from '@/services/ranking'
import type { JogoCopa } from '@/types'

export const dynamic = 'force-dynamic'

function Flag({ codigo, size = 18 }: { codigo: string; size?: number }) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${codigo}.png`}
      alt={codigo} width={size} height={Math.round(size * 0.67)}
      style={{ borderRadius: 1 }} unoptimized draggable={false}
    />
  )
}

function MetricCard({ label, value, sub, subBlue }: { label: string; value: React.ReactNode; sub?: string; subBlue?: boolean }) {
  return (
    <div style={{
      background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)',
      borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)' }} />
      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'white', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: subBlue ? '#4A90D9' : 'rgba(255,255,255,0.25)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalPalpites },
    { count: totalJogos },
    { count: jogosRealizados },
    { data: proximosJogos },
    { data: ultimosResultados },
    ranking,
  ] = await Promise.all([
    supabase.from('palpites').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('jogos_copa').select('*', { count: 'exact', head: true }),
    supabase.from('resultados').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').gte('data', new Date().toISOString().split('T')[0]).order('data').order('horario').limit(5),
    supabase.from('jogos_copa').select('*, resultado:resultados(*)').lt('data', new Date().toISOString().split('T')[0]).not('resultado', 'is', null).order('data', { ascending: false }).order('horario', { ascending: false }).limit(4),
    getRanking(),
  ])

  const lider = ranking[0]
  const hoje = new Date().toISOString().split('T')[0]

  function formatDate(d: string) {
    const parts = d.split('-')
    return `${parts[2]} ${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(parts[1])-1]}`
  }
  function formatTime(t: string) { return t.slice(0, 5) }

  return (
    <div className="page-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* 4-column metrics */}
      <div className="dash-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Palpites ativos" value={totalPalpites ?? 0} sub={`de ${(totalPalpites ?? 0)} cadastrados`} />
        <MetricCard
          label="Jogos realizados"
          value={<>{jogosRealizados ?? 0}<span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>/{totalJogos ?? 104}</span></>}
          sub="fase de grupos"
        />
        <MetricCard
          label="Líder do bolão"
          value={<span style={{ fontSize: 15, paddingTop: 3, display: 'block' }}>{lider?.nome ?? '—'}</span>}
          sub={lider ? `${lider.total_pontos} pts · ${lider.usuario_nome}` : 'Sem palpites ativos'}
          subBlue={!!lider}
        />
        <MetricCard
          label="Próxima partida"
          value={
            proximosJogos?.[0]
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Flag codigo={(proximosJogos[0] as JogoCopa).codigo_pais_a} size={20} />
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>×</span>
                  <Flag codigo={(proximosJogos[0] as JogoCopa).codigo_pais_b} size={20} />
                </div>
              : <span style={{ fontSize: 14 }}>—</span>
          }
          sub={proximosJogos?.[0] ? `${formatDate((proximosJogos[0] as JogoCopa).data)} · ${formatTime((proximosJogos[0] as JogoCopa).horario)}h` : undefined}
          subBlue={!!proximosJogos?.[0]}
        />
      </div>

      {/* 2-column: standings preview + matches */}
      <div className="dash-two" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Tabela grupo snapshot */}
        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            Tabela oficial — grupos
            <Link href="/tabela" style={{ fontSize: 10, color: '#4A90D9', fontWeight: 500, textDecoration: 'none', textTransform: 'none', letterSpacing: 0 }}>ver todos →</Link>
          </div>
          {/* Table header */}
          <div className="dash-table-cols" style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '0 4px 5px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span>#</span><span style={{ textAlign: 'left' }}>Seleção</span><span>J</span><span>V</span><span>SG</span><span className="rank-acertos">GP</span><span>Pts</span>
          </div>
          {/* Placeholder rows */}
          {[
            { pos: 1, time: 'Brasil', codigo: 'br', j:2, v:2, sg:'+4', gp:5, pts:6, q:true },
            { pos: 2, time: 'Marrocos', codigo: 'ma', j:2, v:1, sg:'0', gp:2, pts:3, q:true },
            { pos: 3, time: 'Croácia', codigo: 'hr', j:2, v:0, sg:'-1', gp:2, pts:2, q:false },
            { pos: 4, time: 'Uzbequistão', codigo: 'uz', j:2, v:0, sg:'-3', gp:1, pts:0, q:false },
          ].map(row => (
            <div key={row.time} className="dash-table-cols" style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '6px 4px', alignItems: 'center', fontSize: 11, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', background: row.q ? 'rgba(74,144,217,0.07)' : 'transparent', borderRadius: row.q ? 4 : 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: row.q ? '#4A90D9' : 'rgba(255,255,255,0.25)' }}>{row.pos}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left' }}>
                <Flag codigo={row.codigo} size={18} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'white' }}>{row.time}</span>
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{row.j}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{row.v}</span>
              <span style={{ fontSize: 10, color: row.sg.startsWith('-') ? 'rgba(255,100,100,0.75)' : 'rgba(255,255,255,0.6)' }}>{row.sg}</span>
              <span className="rank-acertos" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{row.gp}</span>
              <span style={{ fontWeight: 700, color: '#4A90D9', fontSize: 11 }}>{row.pts}</span>
            </div>
          ))}
        </div>

        {/* Matches */}
        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Partidas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...( ultimosResultados ?? []), ...(proximosJogos ?? [])].slice(0, 5).map((j: JogoCopa) => {
              const isToday = j.data === hoje
              const hasPlacar = !!j.resultado
              return (
                <div key={j.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: isToday ? 'rgba(74,144,217,0.06)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isToday ? 'rgba(74,144,217,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 7,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                      <Flag codigo={j.codigo_pais_a} size={16} /> {j.time_a.split(' ')[0].slice(0,3).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{formatDate(j.data)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4A90D9', minWidth: 38, textAlign: 'center' }}>
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
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, justifyContent: 'flex-end' }}>
                      {j.time_b.split(' ')[0].slice(0,3).toUpperCase()} <Flag codigo={j.codigo_pais_b} size={16} />
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{j.cidade}</div>
                  </div>
                </div>
              )
            })}
            {(!proximosJogos?.length && !ultimosResultados?.length) && (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12, padding: '20px 0' }}>Nenhuma partida ainda</p>
            )}
          </div>
        </div>
      </div>

      {/* Ranking parcial */}
      <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          Ranking do bolão
          <Link href="/ranking" style={{ fontSize: 10, color: '#4A90D9', fontWeight: 500, textDecoration: 'none', textTransform: 'none', letterSpacing: 0 }}>ranking completo →</Link>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {ranking.length === 0 && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12, padding: '12px 0' }}>Nenhum palpite ativo ainda</p>
          )}
          {ranking.slice(0, 5).map((entry, idx) => {
            const maxPts = ranking[0]?.total_pontos || 1
            const pct = Math.round((entry.total_pontos / maxPts) * 100)
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : String(entry.posicao)
            return (
              <div key={entry.palpite_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7 }}>
                <span style={{ fontSize: idx < 3 ? 13 : 13, fontWeight: 700, minWidth: 22, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>{medal}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{entry.nome}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{entry.usuario_nome}</div>
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
    </div>
  )
}
