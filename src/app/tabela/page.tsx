import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { GRUPOS } from '@/utils/constants'
import type { ClassificacaoGrupo } from '@/types'

export const dynamic = 'force-dynamic'

function Flag({ codigo }: { codigo: string }) {
  return (
    <Image src={`https://flagcdn.com/w40/${codigo}.png`} alt={codigo} width={18} height={12}
      style={{ borderRadius: 1 }} unoptimized draggable={false} />
  )
}

export default async function TabelaPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('classificacao_grupos')
    .select('*')
    .order('grupo')
    .order('pts', { ascending: false })
    .order('dg',  { ascending: false })
    .order('m',   { ascending: false })

  const rows = (data ?? []) as ClassificacaoGrupo[]

  // Group by grupo letter, preserving sorted order
  const grupoMap: Record<string, ClassificacaoGrupo[]> = {}
  for (const row of rows) {
    if (!grupoMap[row.grupo]) grupoMap[row.grupo] = []
    grupoMap[row.grupo].push(row)
  }

  const grupos = GRUPOS.map(g => ({ grupo: g, times: grupoMap[g] ?? [] })).filter(g => g.times.length > 0)

  return (
    <div className="page-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px 40px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 4 }}>Tabela oficial</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 18 }}>Classificação atualizada após cada rodada · Critérios FIFA</div>

      {grupos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          Os jogos serão carregados em breve.
        </div>
      ) : (
        <div className="grupos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {grupos.map(({ grupo, times }) => (
            <div key={grupo} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(90deg, #0a1f4e, #091a42)', padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(74,144,217,0.2)' }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: 'white', letterSpacing: 1 }}>Grupo {grupo}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fase de grupos</span>
              </div>
              <div className="mobile-scroll">
                <div className="mobile-scroll-inner">
                  <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '5px 10px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>#</span><span style={{ textAlign: 'left' }}>Seleção</span><span>J</span><span>V</span><span>SG</span><span>GP</span><span>Pts</span>
                  </div>
                  {times.map((t, idx) => {
                    const q = idx < 2
                    const sgPos = t.dg > 0
                    const sgNeg = t.dg < 0
                    return (
                      <div key={t.pais_nome} style={{ display: 'grid', gridTemplateColumns: '16px 1fr 22px 22px 22px 22px 28px', gap: 2, padding: '6px 10px', alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.85)', textAlign: 'center', borderBottom: idx < times.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: q ? 'rgba(74,144,217,0.07)' : 'transparent' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: q ? '#4A90D9' : 'rgba(255,255,255,0.25)' }}>{idx + 1}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left' }}>
                          <Flag codigo={t.pais_codigo} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'white' }}>{t.pais_nome}</span>
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t.j}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t.c}</span>
                        <span style={{ fontSize: 10, color: sgPos ? 'rgba(255,255,255,0.6)' : sgNeg ? 'rgba(255,100,100,0.75)' : 'rgba(255,255,255,0.5)' }}>
                          {sgPos ? `+${t.dg}` : t.dg}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{t.m}</span>
                        <span style={{ fontWeight: 700, color: '#4A90D9', fontSize: 11 }}>{t.pts}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="legend-row" style={{ marginTop: 14, padding: '10px 16px', background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(74,144,217,0.5)' }} />
            Classifica para o mata-mata (1º e 2º de cada grupo)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }} />
            Disputa vaga (8 melhores 3ºs colocados)
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Critérios FIFA: Pts → SG → GP → Confronto direto → Fair play</span>
      </div>
    </div>
  )
}
