import { getWCScorers, type FDScorer } from '@/lib/football-data'

export const revalidate = 3600 // regenera a cada 1h (artilharia)

export default async function CopaPage() {
  const artilheiros = await getWCScorers(10)

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

      {/* ── artilharia ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.40)' }}>
            ⚽ Artilharia
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)' }}>atualiza a cada hora</div>
        </div>

        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
          {artilheiros.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>
              Ainda não há gols marcados.
            </div>
          ) : artilheiros.map((s: FDScorer, i: number) => (
            <div key={s.player.id} style={{
              display: 'grid', gridTemplateColumns: '28px 30px 1fr auto',
              alignItems: 'center', gap: 10, padding: '11px 14px',
              borderBottom: i < artilheiros.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: i === 0 ? 'rgba(255,215,0,0.04)' : 'transparent',
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, textAlign: 'center',
                color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.30)',
              }}>{i + 1}°</span>
              <img src={s.team.crest} width={24} height={24} style={{ objectFit: 'contain' }} alt={s.team.shortName} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{s.player.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 1 }}>{s.team.shortName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#4A90D9', lineHeight: 1 }}>{s.goals}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', marginLeft: 3 }}>gols</span>
                {s.assists > 0 && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{s.assists} assist.</div>
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
        <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.10)', borderRadius: 10, padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✍️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 8 }}>Em breve</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
            Boletim diário com curiosidades, bastidores e análises da Copa — gerado pelo Claude 2× ao dia.
          </div>
        </div>
      </section>

    </div>
  )
}
