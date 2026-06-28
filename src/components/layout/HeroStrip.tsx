import { createClient } from '@/lib/supabase/server'
import { FASES, FASES_ORDER } from '@/utils/constants'
import { HeroCountdown } from './HeroCountdown'

export async function HeroStrip() {
  const supabase = await createClient()

  const [
    { count: totalJogos },
    { count: jogosRealizados },
    { data: primeiroJogo },
    { data: jogosFases },
  ] = await Promise.all([
    supabase.from('jogos_copa').select('*', { count: 'exact', head: true }),
    supabase.from('resultados').select('*', { count: 'exact', head: true }),
    supabase.from('jogos_copa')
      .select('data, horario')
      .order('data')
      .order('horario')
      .limit(1)
      .maybeSingle(),
    // Usado para descobrir a fase atual pelo horário de início dos jogos
    // (não pelo último resultado) — assim o badge já troca no minuto em que
    // a primeira partida da fase seguinte começa, mesmo sem resultado ainda.
    supabase.from('jogos_copa').select('fase, data, horario'),
  ])

  const total      = totalJogos ?? 0
  const realizados = jogosRealizados ?? 0

  // "Agora" em horário de Brasília (BRT = UTC-3), no mesmo fuso em que
  // data/horario são gravados no banco.
  const nowBRT  = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const hojeBRT = nowBRT.toISOString().slice(0, 10)
  const horaBRT = nowBRT.toISOString().slice(11, 16)

  const faseJaComecou = (faseCode: string) =>
    (jogosFases ?? []).some(j =>
      j.fase === faseCode && (j.data < hojeBRT || (j.data === hojeBRT && j.horario.slice(0, 5) <= horaBRT))
    )

  // Última fase (na ordem do torneio) cujo primeiro jogo já começou
  const fasesIniciadas = FASES_ORDER.filter(faseJaComecou)
  const fase      = fasesIniciadas[fasesIniciadas.length - 1] ?? 'GS'
  const faseLabel = FASES[fase] ?? 'Fase de Grupos'

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

        {/* Desktop: breadcrumb com todas as fases já iniciadas, atual em destaque */}
        <span className="hero-fase-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {fasesIniciadas.map((f, i) => (
            <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>›</span>}
              <span style={{
                background: f === fase ? 'rgba(74,144,217,0.18)' : 'transparent',
                border: f === fase ? '1px solid rgba(74,144,217,0.35)' : '1px solid transparent',
                color: f === fase ? '#7BB8F0' : 'rgba(255,255,255,0.35)',
                fontSize: 10, fontWeight: 700,
                padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5,
                whiteSpace: 'nowrap',
              }}>
                {FASES[f] ?? f}
              </span>
            </span>
          ))}
        </span>

        {/* Mobile: só a fase atual (largura limitada) */}
        <span className="hero-fase-atual" style={{
          background: 'rgba(74,144,217,0.18)', border: '1px solid rgba(74,144,217,0.35)',
          color: '#7BB8F0', fontSize: 10, fontWeight: 700,
          padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.5,
          whiteSpace: 'nowrap', flexShrink: 0, display: 'none',
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
