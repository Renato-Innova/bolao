import { createClient } from '@/lib/supabase/server'
import { FASES } from '@/utils/constants'
import { HeroCountdown } from './HeroCountdown'

export async function HeroStrip() {
  const supabase = await createClient()

  const [
    { count: totalJogos },
    { count: jogosRealizados },
    { data: ultimoJogo },
    { data: primeiroJogo },
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
    supabase.from('jogos_copa')
      .select('data, horario')
      .order('data')
      .order('horario')
      .limit(1)
      .maybeSingle(),
  ])

  const total      = totalJogos ?? 0
  const realizados = jogosRealizados ?? 0
  const fase       = ultimoJogo?.fase ?? 'GS'
  const faseLabel  = FASES[fase] ?? 'Fase de Grupos'

  // Build ISO datetime for first game (BRT = UTC-3)
  const firstGameISO = primeiroJogo
    ? `${primeiroJogo.data}T${primeiroJogo.horario}-03:00`
    : '2026-06-11T15:00:00-03:00'

  return (
    <div style={{
      background: 'linear-gradient(90deg, #04143a 0%, #091d50 50%, #0a1f4e 100%)',
      borderBottom: '1px solid rgba(74,144,217,0.18)',
      padding: '9px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'relative', zIndex: 1,
      width: '100%', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
        <HeroCountdown firstGameISO={firstGameISO} />
        <span style={{
          background: 'rgba(74,144,217,0.18)', border: '1px solid rgba(74,144,217,0.35)',
          color: '#7BB8F0', fontSize: 10, fontWeight: 700,
          padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {faseLabel}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {realizados} de {total} jogos realizados
        </span>
      </div>
      <span className="hero-date" style={{ color: 'rgba(255,255,255,0.50)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8 }}>11 jun – 19 jul 2026</span>
    </div>
  )
}
