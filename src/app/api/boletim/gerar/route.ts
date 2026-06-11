import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

/* ── clientes ──────────────────────────────────────────────────────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/* ── helpers de data (sempre no fuso BRT = UTC-3) ─────────────────────────── */
function brtNow() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000)
}
function brtDate(d: Date) {
  return d.toISOString().slice(0, 10)          // "YYYY-MM-DD"
}

/* ── prompts ───────────────────────────────────────────────────────────────── */
function promptManha(ontem: string, hoje: string, resultados: string, jogosDia: string) {
  return `Você é o repórter oficial do Bolão Copa 2026, um bolão de apostas entre amigos brasileiros.
Escreva o BOLETIM DA MANHÃ da Copa do Mundo 2026 de forma animada, bem-humorada e em português brasileiro.

DATA DE HOJE: ${hoje}

RESULTADOS DE ONTEM (${ontem}):
${resultados || 'Nenhum jogo foi realizado ontem.'}

JOGOS DE HOJE (${hoje}):
${jogosDia || 'Nenhum jogo hoje.'}

Estrutura obrigatória (use exatamente esses títulos em negrito):
**☀️ Bom dia, torcedor!**
(saudação animada, máx 2 linhas)

**📋 O que rolou ontem**
(resumo dos resultados com destaques, surpresas e placares — 3 a 5 linhas)

**⚽ Jogos de hoje**
(prévia dos jogos do dia com horários e times — 3 a 5 linhas)

**🎯 Dica do bolão**
(comentário rápido e divertido sobre como os jogos de hoje podem afetar o bolão — 2 a 3 linhas)

Seja conciso, divertido e use linguagem de torcedor brasileiro. Máximo 200 palavras no total.`
}

function promptTarde(hoje: string, resultadosParciais: string, jogoNoite: string) {
  return `Você é o repórter oficial do Bolão Copa 2026, um bolão de apostas entre amigos brasileiros.
Escreva o BOLETIM DA TARDE da Copa do Mundo 2026 de forma animada, bem-humorada e em português brasileiro.

DATA DE HOJE: ${hoje}

RESULTADOS DE HOJE ATÉ AGORA:
${resultadosParciais || 'Nenhum jogo encerrado ainda hoje.'}

JOGOS DA NOITE / RESTANTES HOJE:
${jogoNoite || 'Nenhum jogo restante hoje.'}

Estrutura obrigatória (use exatamente esses títulos em negrito):
**🌅 Boa tarde, torcedor!**
(saudação animada, máx 2 linhas)

**📊 O que já rolou hoje**
(resumo dos jogos do dia com destaques e placares — 3 a 5 linhas)

**🌙 O que vem pela frente**
(prévia dos jogos da noite com horários — 2 a 4 linhas)

**🔥 Esquenta do bolão**
(como os resultados de hoje movimentaram o bolão, quem pode subir/cair — 2 a 3 linhas)

Seja conciso, divertido e use linguagem de torcedor brasileiro. Máximo 200 palavras no total.`
}

/* ── formatadores de dados ─────────────────────────────────────────────────── */
function formatarResultados(jogos: Record<string, unknown>[]) {
  if (!jogos.length) return ''
  return jogos.map((j: Record<string, unknown>) => {
    const r = j.resultado as Record<string, unknown> | null
    if (!r) return `${j.time_a} x ${j.time_b} — sem resultado`
    const pen = r.placar_penalti_a != null
      ? ` (pên: ${r.placar_penalti_a}-${r.placar_penalti_b})`
      : ''
    return `${j.time_a} ${r.placar_real_a}-${r.placar_real_b} ${j.time_b}${pen} | ${j.horario?.toString().slice(0,5)}h | ${j.estadio}, ${j.cidade}`
  }).join('\n')
}

function formatarJogos(jogos: Record<string, unknown>[]) {
  if (!jogos.length) return ''
  return jogos.map((j: Record<string, unknown>) =>
    `${j.time_a} x ${j.time_b} | ${j.horario?.toString().slice(0,5)}h (BRT) | ${j.estadio}, ${j.cidade}`
  ).join('\n')
}

/* ── handler principal ─────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  // Proteção: Vercel injeta Authorization: Bearer <CRON_SECRET> nos cron jobs
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tipo = req.nextUrl.searchParams.get('tipo') as 'manha' | 'tarde' | null
  if (tipo !== 'manha' && tipo !== 'tarde') {
    return NextResponse.json({ error: 'tipo deve ser manha ou tarde' }, { status: 400 })
  }

  const now   = brtNow()
  const hoje  = brtDate(now)
  const ontem = brtDate(new Date(now.getTime() - 24 * 60 * 60 * 1000))

  /* ── busca jogos no Supabase ── */
  const { data: jogosOntem } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .eq('data', ontem)
    .order('horario')

  const { data: jogosHoje } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .eq('data', hoje)
    .order('horario')

  const jogosHojeEncerrados = (jogosHoje ?? []).filter(
    (j: Record<string, unknown>) => j.resultado !== null
  )
  const jogosHojePendentes = (jogosHoje ?? []).filter(
    (j: Record<string, unknown>) => j.resultado === null
  )

  /* ── monta prompt ── */
  const prompt = tipo === 'manha'
    ? promptManha(ontem, hoje, formatarResultados(jogosOntem ?? []), formatarJogos(jogosHoje ?? []))
    : promptTarde(hoje, formatarResultados(jogosHojeEncerrados), formatarJogos(jogosHojePendentes))

  /* ── chama Claude ── */
  const message = await anthropic.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 600,
    messages:   [{ role: 'user', content: prompt }],
  })

  const conteudo = (message.content[0] as { type: string; text: string }).text.trim()

  // Extrai o título da primeira linha em negrito
  const tituloMatch = conteudo.match(/\*\*(.*?)\*\*/)
  const titulo = tituloMatch
    ? tituloMatch[1]
    : tipo === 'manha' ? '☀️ Boletim da Manhã' : '🌅 Boletim da Tarde'

  /* ── salva no Supabase ── */
  const { error } = await supabase
    .from('boletim_copa')
    .insert({ tipo, titulo, conteudo })

  if (error) {
    console.error('Erro ao salvar boletim:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tipo, titulo, gerado_em: new Date().toISOString() })
}
