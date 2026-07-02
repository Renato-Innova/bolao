import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/admin/reset-resultados
//
// Clears ALL official results and resets all point counters.
// Also restores KO bracket games to their original placeholder team names.
//
// Resets:
//   • resultados                     → all rows deleted
//   • resultados_especiais           → all fields set to null
//   • palpites_jogos.pontos          → 0
//   • palpites.pontos_especiais      → 0
//   • palpites.pontos_classificacao  → 0
//   • jogos_copa (KO phases)         → restored to original placeholder names

// Original bracket structure indexed by numero_jogo.
// These are the placeholder team names from the initial seed (06_schema_v2.sql).
const BRACKET_PLACEHOLDERS: Record<number, { time_a: string; time_b: string; codigo_pais_a: null; codigo_pais_b: null }> = {
  // R32 — Oitavas
  73: { time_a: '2º Grupo A',              time_b: '2º Grupo B',              codigo_pais_a: null, codigo_pais_b: null },
  74: { time_a: '1º Grupo E',              time_b: 'Melhor 3º (A/B/C/D/F)',   codigo_pais_a: null, codigo_pais_b: null },
  75: { time_a: '1º Grupo F',              time_b: '2º Grupo C',              codigo_pais_a: null, codigo_pais_b: null },
  76: { time_a: '1º Grupo C',              time_b: '2º Grupo F',              codigo_pais_a: null, codigo_pais_b: null },
  77: { time_a: '1º Grupo I',              time_b: 'Melhor 3º (C/D/F/G/H)',   codigo_pais_a: null, codigo_pais_b: null },
  78: { time_a: '2º Grupo E',              time_b: '2º Grupo I',              codigo_pais_a: null, codigo_pais_b: null },
  79: { time_a: '1º Grupo A',              time_b: 'Melhor 3º (C/E/F/H/I)',   codigo_pais_a: null, codigo_pais_b: null },
  80: { time_a: '1º Grupo L',              time_b: 'Melhor 3º (E/H/I/J/K)',   codigo_pais_a: null, codigo_pais_b: null },
  81: { time_a: '1º Grupo D',              time_b: 'Melhor 3º (B/E/F/I/J)',   codigo_pais_a: null, codigo_pais_b: null },
  82: { time_a: '1º Grupo G',              time_b: 'Melhor 3º (A/E/H/I/J)',   codigo_pais_a: null, codigo_pais_b: null },
  83: { time_a: '2º Grupo K',              time_b: '2º Grupo L',              codigo_pais_a: null, codigo_pais_b: null },
  84: { time_a: '1º Grupo H',              time_b: '2º Grupo J',              codigo_pais_a: null, codigo_pais_b: null },
  85: { time_a: '1º Grupo B',              time_b: 'Melhor 3º (E/F/G/I/J)',   codigo_pais_a: null, codigo_pais_b: null },
  86: { time_a: '1º Grupo J',              time_b: '2º Grupo H',              codigo_pais_a: null, codigo_pais_b: null },
  87: { time_a: '1º Grupo K',              time_b: 'Melhor 3º (D/E/I/J/L)',   codigo_pais_a: null, codigo_pais_b: null },
  88: { time_a: '2º Grupo D',              time_b: '2º Grupo G',              codigo_pais_a: null, codigo_pais_b: null },
  // R16 — Quartas
  89: { time_a: 'Vencedor Jogo 74',        time_b: 'Vencedor Jogo 77',        codigo_pais_a: null, codigo_pais_b: null },
  90: { time_a: 'Vencedor Jogo 73',        time_b: 'Vencedor Jogo 75',        codigo_pais_a: null, codigo_pais_b: null },
  91: { time_a: 'Vencedor Jogo 76',        time_b: 'Vencedor Jogo 78',        codigo_pais_a: null, codigo_pais_b: null },
  92: { time_a: 'Vencedor Jogo 79',        time_b: 'Vencedor Jogo 80',        codigo_pais_a: null, codigo_pais_b: null },
  93: { time_a: 'Vencedor Jogo 83',        time_b: 'Vencedor Jogo 84',        codigo_pais_a: null, codigo_pais_b: null },
  94: { time_a: 'Vencedor Jogo 81',        time_b: 'Vencedor Jogo 82',        codigo_pais_a: null, codigo_pais_b: null },
  95: { time_a: 'Vencedor Jogo 86',        time_b: 'Vencedor Jogo 88',        codigo_pais_a: null, codigo_pais_b: null },
  96: { time_a: 'Vencedor Jogo 85',        time_b: 'Vencedor Jogo 87',        codigo_pais_a: null, codigo_pais_b: null },
  // QF — Semi
  97:  { time_a: 'Vencedor Jogo 89',       time_b: 'Vencedor Jogo 90',        codigo_pais_a: null, codigo_pais_b: null },
  98:  { time_a: 'Vencedor Jogo 93',       time_b: 'Vencedor Jogo 94',        codigo_pais_a: null, codigo_pais_b: null },
  99:  { time_a: 'Vencedor Jogo 91',       time_b: 'Vencedor Jogo 92',        codigo_pais_a: null, codigo_pais_b: null },
  100: { time_a: 'Vencedor Jogo 95',       time_b: 'Vencedor Jogo 96',        codigo_pais_a: null, codigo_pais_b: null },
  // SF — Final e 3º lugar
  101: { time_a: 'Vencedor Jogo 97',       time_b: 'Vencedor Jogo 98',        codigo_pais_a: null, codigo_pais_b: null },
  102: { time_a: 'Vencedor Jogo 99',       time_b: 'Vencedor Jogo 100',       codigo_pais_a: null, codigo_pais_b: null },
  // TPL — 3º lugar
  103: { time_a: 'Perdedor Jogo 101',      time_b: 'Perdedor Jogo 102',       codigo_pais_a: null, codigo_pais_b: null },
  // F — Final
  104: { time_a: 'Vencedor Jogo 101',      time_b: 'Vencedor Jogo 102',       codigo_pais_a: null, codigo_pais_b: null },
}

export async function POST() {
  // Auth check via anon client (reads session cookie)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!userData?.is_admin) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  // All DB writes use admin client (service role) to bypass RLS
  const admin = createAdminClient()

  // 1 — Delete all official match results
  const { error: e1 } = await admin.from('resultados').delete().neq('id', 0)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // 2 — Clear special results (keep the single row, null all fields)
  const { error: e2 } = await admin
    .from('resultados_especiais')
    .update({ campeao: null, vice_campeao: null, artilheiro: null, melhor_jogador: null, melhor_goleiro: null })
    .eq('id', 1)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // 3 — Zero all game points
  const { error: e3 } = await admin
    .from('palpites_jogos').update({ pontos: 0 }).neq('id', 0)
  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })

  // 4 — Zero special + classification bonus points on every palpite
  const { error: e4 } = await admin
    .from('palpites').update({ pontos_especiais: 0, pontos_classificacao: 0 }).neq('id', 0)
  if (e4) return NextResponse.json({ error: e4.message }, { status: 500 })

  // 5 — Restore KO bracket games to original placeholder names
  //     Fetch KO games to get their ids by numero_jogo
  const { data: koJogos, error: e5 } = await admin
    .from('jogos_copa')
    .select('id, numero_jogo')
    .in('fase', ['R32', 'R16', 'QF', 'SF', 'TPL', 'F'])
  if (e5) return NextResponse.json({ error: e5.message }, { status: 500 })

  for (const jogo of koJogos ?? []) {
    const placeholder = BRACKET_PLACEHOLDERS[jogo.numero_jogo]
    if (!placeholder) continue
    const { error: eu } = await admin
      .from('jogos_copa')
      .update(placeholder)
      .eq('id', jogo.id)
    if (eu) return NextResponse.json({ error: `Erro ao restaurar jogo ${jogo.numero_jogo}: ${eu.message}` }, { status: 500 })
  }

  revalidateTag('ranking', 'max')
  revalidateTag('dashboard', 'max')
  revalidateTag('tabela', 'max')
  revalidatePath('/tabela')

  return NextResponse.json({ ok: true })
}
