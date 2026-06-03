import { createClient } from '@/lib/supabase/server'
import { FASES } from '@/utils/constants'

export async function HeroStrip() {
  const supabase = await createClient()

  const [
    { count: totalJogos },
    { count: jogosRealizados },
    { data: ultimoJogo },
  ] = await Promise.all([
    supabase.from('jogos_copa').select('*', { count: 'exact', head: true }),
    supabase.from('resultados').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa')
      .select('fase')
      .not('resultado', 'is', null)
      .order('data', { ascending: false })
      .order('horario', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const total      = totalJogos ?? 0
  const realizados = jogosRealizados ?? 0
  // Derive current phase from the most recent played game
  const fase       = ultimoJogo?.fase ?? 'GS'
  const faseLabel  = FASES[fase] ?? 'Fase de Grupos'

  return (
    <div style={{
      background: 'linear-gradient(90deg, #04143a 0%, #091d50 50%, #0a1f4e 100%)',
      borderBottom: '1px solid rgba(74,144,217,0.18)',
      padding: '9px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 6, height: 6, background: '#4ade80', borderRadius: '50%', flexShrink: 0 }} />
        <span style={{
          background: 'rgba(74,144,217,0.18)', border: '1px solid rgba(74,144,217,0.35)',
          color: '#7BB8F0', fontSize: 10, fontWeight: 700,
          padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {faseLabel}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
          {realizados} de {total} jogos realizados
        </span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>11 jun – 19 jul 2026</span>
    </div>
  )
}
