import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

/* ── clientes ──────────────────────────────────────────────────────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/* ── helpers de data (BRT = UTC-3) ────────────────────────────────────────── */
function brtNow() { return new Date(Date.now() - 3 * 60 * 60 * 1000) }
function brtDate(d: Date) { return d.toISOString().slice(0, 10) }
function daysAgo(now: Date, n: number) {
  return brtDate(new Date(now.getTime() - n * 24 * 60 * 60 * 1000))
}
function daysAhead(now: Date, n: number) {
  return brtDate(new Date(now.getTime() + n * 24 * 60 * 60 * 1000))
}

/* ── UOL crawling ──────────────────────────────────────────────────────────── */
const SLUG_MAP: Record<string, string> = {
  'Costa do Marfim': 'costa-do-marfim',
  'Países Baixos':   'holanda',
  'Holanda':         'holanda',
  'Coreia do Sul':   'coreia-do-sul',
  'Estados Unidos':  'estados-unidos',
  'Arábia Saudita':  'arabia-saudita',
  'Nova Zelândia':   'nova-zelandia',
  'República Tcheca':'republica-tcheca',
  'Bósnia-Herzegovina': 'bosnia-herzegovina',
  'Cabo Verde':      'cabo-verde',
  'África do Sul':   'africa-do-sul',
  'Guiné Equatorial':'guine-equatorial',
  'Burkina Faso':    'burkina-faso',
  'Costa Rica':      'costa-rica',
  'El Salvador':     'el-salvador',
  'Trinidad e Tobago': 'trinidad-tobago',
}

function toSlug(name: string): string {
  return SLUG_MAP[name]
    ?? name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function uolPlacarUrl(timeA: string, timeB: string, data: string): string {
  const [y, m, d] = data.split('-')
  return `https://placar.uol.com.br/esporte/futebol/copa-do-mundo/${y}/${m}/${d}/${toSlug(timeA)}-x-${toSlug(timeB)}.htm`
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&ccedil;/g, 'ç').replace(/&Ccedil;/g, 'Ç')
    .replace(/&atilde;/g, 'ã').replace(/&otilde;/g, 'õ').replace(/&acirc;/g, 'â')
    .replace(/&ecirc;/g, 'ê').replace(/&ocirc;/g, 'ô').replace(/&agrave;/g, 'à')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í').replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú').replace(/&Atilde;/g, 'Ã').replace(/&Otilde;/g, 'Õ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '-').replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '').replace(/&[a-z]+;/g, '')
}

// Remove ruídos típicos do UOL: blocos de publicidade, rodapé, links de navegação
function cleanUol(text: string): string {
  return text
    .replace(/Publicidade\s*/gi, '')
    .replace(/Sobre o UOL[\s\S]*/i, '')
    .replace(/Conheça nossa história[\s\S]*/i, '')
    .replace(/Fale conosco[\s\S]*/i, '')
    .replace(/Leia também[\s\S]{0,200}/gi, '')
    .replace(/Deixe seu comentário[\s\S]*/i, '')
    .replace(/Comunicar erro[\s\S]*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function fetchUolPage(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return ''
    const html = await r.text()
    const raw = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return cleanUol(decodeHtml(raw))
  } catch {
    return ''
  }
}

// Extrai blocos "Pré-jogo" da página do placar UOL (para jogos pendentes)
function extractPreJogo(text: string, maxBlocks = 5, maxChars = 400): string {
  const blocks: string[] = []
  let idx = 0
  while (true) {
    const pos = text.indexOf('Pré-jogo', idx)
    if (pos === -1) break
    const next = text.indexOf('Pré-jogo', pos + 8)
    const chunk = text.slice(pos + 8, next === -1 ? pos + maxChars + 8 : next).trim().slice(0, maxChars)
    if (chunk.length > 40) blocks.push(chunk)
    idx = pos + 8
  }
  return blocks.slice(0, maxBlocks).join('\n')
}

// Extrai resumo pós-jogo da página do placar UOL (para jogos encerrados)
// O conteúdo pós-jogo fica ANTES dos blocos Pré-jogo na página
function extractPosJogo(text: string): string {
  const preJogoIdx = text.indexOf('Pré-jogo')
  const body = preJogoIdx > 0 ? text.slice(0, preJogoIdx) : text

  // Localiza onde começa o conteúdo real (resultado + lances)
  const startMarkers = ['Fim de jogo', 'FIM DE JOGO', 'APITA', 'ENCERRADO']
  let startIdx = body.length
  for (const m of startMarkers) {
    const i = body.indexOf(m)
    if (i > 0 && i < startIdx) startIdx = i
  }
  if (startIdx === body.length) {
    const m = body.search(/\d+' [12]º T/)
    startIdx = m > 0 ? Math.max(0, m - 200) : Math.max(0, body.length - 3000)
  }

  const trecho = body.slice(Math.max(0, startIdx - 100), startIdx + 3000)

  // Mantém apenas frases com eventos relevantes do jogo
  const frases = trecho.split(/(?<=[.!?])\s+|\d+' [12]º T\s*/)
    .filter(l => l.length > 30)
    .filter(l => /GOL|FIM|APITA|cartão|substituição|gol|placar|empat|vitória|derrota|defesa|chut|finaliz|escanteio|pênalti/i.test(l))
    .slice(0, 10)

  return frases.join(' ').slice(0, 900)
}

/* ── formatadores de jogo ──────────────────────────────────────────────────── */
function resolveResultado(j: Jogo): Record<string, unknown> | null {
  const r = j.resultado
  if (!r) return null
  if (Array.isArray(r)) return r.length > 0 ? r[0] as Record<string, unknown> : null
  return r as Record<string, unknown>
}

function fmtResultado(j: Record<string, unknown>): string {
  const r = resolveResultado(j)!
  const pen = r.placar_penalti_a != null
    ? ` (pên: ${r.placar_penalti_a}-${r.placar_penalti_b})`
    : ''
  return `${j.time_a} ${r.placar_real_a}-${r.placar_real_b} ${j.time_b}${pen} | ${(j.horario as string).slice(0, 5)}h`
}

/* ── monta o prompt ────────────────────────────────────────────────────────── */
function buildPrompt(params: {
  hoje: string
  ranking: string
  posJogo: string
  preJogo: string
}) {
  const { hoje, ranking, posJogo, preJogo } = params

  return `Você é o narrador oficial do Bolão Copa 2026 — um jornalista esportivo com o tom da ESPN Brasil: animado e com pitadas de ironia, mas sempre profissional e com análise técnica de verdade.

REGRAS DE TOM E LINGUAGEM:
- Ironia e humor sao bem-vindos, mas sempre leves e respeitosos — sem grosseria, sem palavras rudes, sem ofensas.
- As piadas e provocacoes devem ser sobre as escolhas (palpites), nunca sobre a pessoa.
- A analise esportiva precisa ser relevante e tecnicamente embasada — nao sacrifique a substancia pelo entretenimento.
- Cite participantes pelo nome de forma carinhosa e bem-humorada, como se fossem amigos de longa data.
- Jamais use xingamentos, apelidos pejorativos ou linguagem que possa constranger alguem.

O bolão é uma competição entre amigos onde cada participante registrou palpites para todos os jogos da Copa. Os pontos são somados conforme os acertos.

DATA: ${hoje} — EDICAO: MANHA

===== RANKING ATUAL =====

${ranking}

===== JOGOS ENCERRADOS DESDE O ULTIMO BOLETIM (analise pos-jogo) =====

${posJogo || 'Nenhum jogo encerrado desde o ultimo boletim.'}

===== JOGOS ATE O PROXIMO BOLETIM (analise pre-jogo) =====

${preJogo || 'Nenhum jogo previsto ate o proximo boletim.'}

===== INSTRUCAO =====

Analise mentalmente os dados (NAO escreva essa analise — ela e apenas para voce):
- qual resultado e qual placar sao os mais apostados em cada jogo pendente
- quem apostou contra a maioria em cada jogo
- quem fez o palpite mais ousado do dia (placar mais incomum ou resultado improvavel)
- quem esta sem palpites registrados
- que impacto os resultados possiveis teriam no ranking
- quem lidera ha quantos dias consecutivos e se a lideranca e confortavel ou ameacada
- quem esta em trajetoria ascendente ou descendente nos ultimos dias (usar as variacoes de 1, 2 e 3 dias)
- os palpites de hoje dos lideres e dos ultimos colocados: onde concordam, onde divergem

Com base nessa analise, escreva DIRETAMENTE o boletim em portugues brasileiro, SEM emojis e SEM icones de nenhum tipo.
NAO escreva introducoes, pensamentos, analises ou qualquer texto antes da saudacao.
Use subtitulos simples em letras maiusculas para separar as cinco secoes numeradas (1 a 5).
Entre o fim de uma secao e o subtitulo da proxima, deixe uma linha em branco.
IMPORTANTE: respeite rigorosamente os limites de palavras de cada secao — conte mentalmente antes de finalizar e corte o que ultrapassar.

0. [SEM SUBTITULO] — LIMITE RIGIDO: maximo 40 palavras. Nem uma a mais.
Comece diretamente com a saudacao, sem nenhum titulo ou rotulo antes dela. Uma saudacao matinal curta, engracada ou motivante para os participantes do bolao. Pode referenciar um resultado inesperado do dia anterior, uma variacao curiosa do ranking (quem subiu muito, quem caiu), ou simplesmente animar o dia. Tom leve, como um amigo acordando o grupo no WhatsApp. SEM emojis.

1. RODADA DE HOJE NO RANKING — LIMITE RIGIDO: maximo 100 palavras. Nem uma a mais.
Comente brevemente os resultados ja ocorridos e faca entre 2 e 4 provocacoes leves citando participantes pelo nome. Tom de mesa de bar, nao de tribunal. Se passar de 100 palavras, corte ate caber.

2. ANALISE DOS JOGOS ENCERRADOS — LIMITE RIGIDO: entre 120 e 150 palavras. Nem uma a menos, nem uma a mais.
Analise tecnica dos jogos encerrados: o que funcionou, o que surpreendeu, destaques individuais. Se houver mais de 3 jogos, priorize os mais impactantes e seja mais breve em cada um. Corte o que ultrapassar 150 palavras.

3. FIQUE DE OLHO — LIMITE RIGIDO: entre 120 e 150 palavras. Nem uma a menos, nem uma a mais.
Se houver jogos pendentes: para cada jogo, traga 1 fato relevante (forma, historico, desfalque) que possa justificar rever um palpite. Seja direto: "se voce apostou X, considere Y porque...".
Se nao houver jogos pendentes: escreva uma analise de 120 a 150 palavras sobre os impactos dos resultados de hoje nas proximas rodadas — quais times chegam com moral, quais estao em crise, o que os palpiteiros devem observar daqui para frente. Nao encurte esta secao mesmo sem jogos pendentes.

4. APOSTA CORAJOSA — LIMITE RIGIDO: maximo 70 palavras. Nem uma a mais.
Destaque o palpite mais ousado: quem fez, qual e, o que aconteceria no ranking se confirmar. Se nao houver jogos pendentes, destaque o palpite mais ousado dentre os jogos encerrados e quem acertou ou errou. Corte o que ultrapassar 70 palavras.

5. BRIGA PELO RANKING — LIMITE RIGIDO: entre 100 e 120 palavras. Nem uma a menos, nem uma a mais.
Cubra em ate 4 paragrafos curtos: (a) consistencia da lideranca, (b) quem sobe e quem cai com base nas variacoes de 1, 2 e 3 dias, (c) disputa pelo topo — onde lideres concordam ou divergem nos palpites de hoje, (d) fundo do poco — quem ainda pode recuperar. Crie expectativa para a proxima edicao. Corte o que ultrapassar 120 palavras.`
}

/* ── tipos compartilhados ──────────────────────────────────────────────────── */
type Jogo    = Record<string, unknown>
type HistRow = { palpite_id: number; total_pontos: number }

type RankingData = {
  rankingStr: string
  sorted:     number[]
  nomeMap:    Record<number, string>
  ptMap:      Record<number, number>
  palpiteIds: number[]
}

/* ── funções de coleta de dados ────────────────────────────────────────────── */

async function getJogosEncerrados(datas: string[]): Promise<Jogo[]> {
  const { data } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .in('data', datas)
    .order('data')
    .order('horario')
  // filtra client-side: tem resultado = encerrado (mesmo padrão de getJogosPendentes)
  return (data ?? []).filter((j: Jogo) => resolveResultado(j) !== null)
}

async function getJogosPendentes(datas: string[]): Promise<Jogo[]> {
  const { data } = await supabase
    .from('jogos_copa')
    .select('*, resultado:resultados(*)')
    .in('data', datas)
    .order('data')
    .order('horario')
  // filtra client-side: sem resultado = pendente
  return (data ?? []).filter(
    (j: Jogo) => !j.resultado || (Array.isArray(j.resultado) && j.resultado.length === 0)
  )
}

async function getRankingComVariacao(now: Date): Promise<RankingData> {
  const ontem = daysAgo(now, 1)

  const { data: palpitesAtivos } = await supabase
    .from('palpites')
    .select('id, nome')
    .eq('status', 'ativo')

  const palpiteIds = (palpitesAtivos ?? []).map((p: { id: number }) => p.id)

  const [{ data: pontos }, { data: h1 }, { data: h2 }, { data: h3 }] = await Promise.all([
    supabase.rpc('get_pontos_por_palpite', { p_ids: palpiteIds }) as unknown as Promise<{ data: HistRow[] | null }>,
    supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', ontem).in('palpite_id', palpiteIds),
    supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', daysAgo(now, 2)).in('palpite_id', palpiteIds),
    supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', daysAgo(now, 3)).in('palpite_id', palpiteIds),
  ])

  const nomeMap: Record<number, string> = {}
  for (const p of palpitesAtivos ?? []) nomeMap[p.id] = p.nome

  const ptMap: Record<number, number> = {}
  for (const r of pontos ?? []) ptMap[r.palpite_id] = Number(r.total_pontos ?? 0)

  const toHistMap = (rows: HistRow[] | null) => {
    const m: Record<number, number> = {}
    for (const r of rows ?? []) m[r.palpite_id] = Number(r.total_pontos ?? 0)
    return m
  }
  const h1m = toHistMap(h1 as HistRow[] | null)
  const h2m = toHistMap(h2 as HistRow[] | null)
  const h3m = toHistMap(h3 as HistRow[] | null)

  const sorted = [...palpiteIds].sort((a, b) => (ptMap[b] ?? 0) - (ptMap[a] ?? 0))
  const fmt    = (d: number) => d > 0 ? `+${d}` : String(d)

  const rankingStr = sorted.map((id, i) => {
    const pts = ptMap[id] ?? 0
    return `#${i + 1}  ${nomeMap[id]}  ${pts} pts  [1d:${fmt(pts - (h1m[id] ?? 0))} / 2d:${fmt(pts - (h2m[id] ?? 0))} / 3d:${fmt(pts - (h3m[id] ?? 0))}]`
  }).join('\n')

  return { rankingStr, sorted, nomeMap, ptMap, palpiteIds }
}

async function getTabelaPalpites(
  pendentes:  Jogo[],
  palpiteIds: number[],
  sorted:     number[],
  nomeMap:    Record<number, string>,
): Promise<string> {
  const pendentesIds = pendentes.map(j => j.id as number)
  if (pendentesIds.length === 0 || palpiteIds.length === 0) return ''

  const { data: pj } = await supabase
    .from('palpites_jogos')
    .select('palpite_id, jogo_id, placar_palpite_a, placar_palpite_b, submitted_at')
    .in('palpite_id', palpiteIds)
    .in('jogo_id', pendentesIds)

  const jogosOrd = pendentes.slice().sort(
    (a, b) =>
      (a.data as string) < (b.data as string) ? -1 : (a.data as string) > (b.data as string) ? 1 :
      (a.horario as string) < (b.horario as string) ? -1 : 1
  )

  const header = ['Nome'.padEnd(35), ...jogosOrd.map(j =>
    `${j.time_a} x ${j.time_b}`.slice(0, 20)
  )].join(' | ')

  const placarMap: Record<string, string> = {}
  for (const row of pj ?? []) {
    if (!row.submitted_at) continue
    placarMap[`${row.palpite_id}_${row.jogo_id}`] =
      row.placar_palpite_a != null && row.placar_palpite_b != null
        ? `${row.placar_palpite_a}x${row.placar_palpite_b}`
        : 'sem palpite'
  }

  const linhas = sorted.map(pid => {
    const cols = jogosOrd.map(j =>
      (placarMap[`${pid}_${j.id}`] ?? 'sem palpite').padEnd(20)
    )
    return [nomeMap[pid].slice(0, 34).padEnd(35), ...cols].join(' | ')
  })

  return '\nPALPITES DOS PARTICIPANTES:\n' + [header, ...linhas].join('\n')
}

async function getContextoUol(
  encerrados: Jogo[],
  pendentes:  Jogo[],
): Promise<{ encTexts: string[]; penTexts: string[] }> {
  const [encTexts, penTexts] = await Promise.all([
    Promise.all(encerrados.map(j =>
      fetchUolPage(uolPlacarUrl(j.time_a as string, j.time_b as string, j.data as string))
    )),
    Promise.all(pendentes.map(j =>
      fetchUolPage(uolPlacarUrl(j.time_a as string, j.time_b as string, j.data as string))
    )),
  ])
  return { encTexts, penTexts }
}

/* ── funções de montagem de texto ──────────────────────────────────────────── */

function buildPosJogo(encerrados: Jogo[], encTexts: string[]): string {
  let out = ''
  encerrados.forEach((j, i) => {
    out += `▶ ${fmtResultado(j)}\n`
    const ctx = extractPosJogo(encTexts[i])
    if (ctx) out += ctx + '\n'
    out += '\n'
  })
  return out.trim()
}

function buildPreJogo(pendentes: Jogo[], penTexts: string[], palpitesTabela: string): string {
  let out = ''
  pendentes.forEach((j, i) => {
    out += `▶ ${j.time_a} x ${j.time_b} | ${j.data} ${(j.horario as string).slice(0, 5)}h\n`
    const ctx = extractPreJogo(penTexts[i], 4, 380)
    if (ctx) out += ctx + '\n'
    else out += '(contexto UOL ainda nao disponivel — usar conhecimento proprio)\n'
    out += '\n'
  })
  return (out + palpitesTabela).trim()
}

/* ── handler principal ─────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now    = brtNow()
  const hoje   = brtDate(now)
  const ontem  = daysAgo(now, 1)
  const amanha = daysAhead(now, 1)

  // coleta de dados
  const encerrados                             = await getJogosEncerrados([ontem, hoje])
  const pendentes                              = await getJogosPendentes([hoje])
  const { rankingStr, sorted, nomeMap, ptMap,
          palpiteIds }                         = await getRankingComVariacao(now)
  const palpitesTabela                         = await getTabelaPalpites(pendentes, palpiteIds, sorted, nomeMap)
  const { encTexts, penTexts }                 = await getContextoUol(encerrados, pendentes)

  // montagem do prompt
  const posJogo = buildPosJogo(encerrados, encTexts)
  const preJogo = buildPreJogo(pendentes, penTexts, palpitesTabela)
  const prompt  = buildPrompt({ hoje, ranking: rankingStr, posJogo, preJogo })

  // geração do boletim
  const message  = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2400,
    messages:   [{ role: 'user', content: prompt }],
  })
  if (message.stop_reason === 'max_tokens') {
    console.warn('[boletim] geração cortada por max_tokens — considere aumentar o limite')
  }
  const conteudo = (message.content[0] as { type: string; text: string }).text.trim()
  const titulo   = 'Boletim da Copa 2026 · Edição da Manhã'

  // auditoria automática (Haiku) — fatos + português
  const fatosReais = [
    '=== RANKING REAL (posição, nome, pontos, variações 1d/2d/3d) ===',
    rankingStr,
    '',
    '=== RESULTADOS REAIS (jogos encerrados) ===',
    encerrados.map(j => fmtResultado(j)).join('\n') || 'Nenhum resultado disponível.',
    '',
    '=== JOGOS PENDENTES DE HOJE (ainda não ocorreram) ===',
    pendentes.length > 0
      ? pendentes.map(j => `${j.time_a} x ${j.time_b} | ${(j.horario as string).slice(0, 5)}h`).join('\n')
      : 'Nenhum jogo pendente.',
    palpitesTabela ? '\n=== PALPITES DOS PARTICIPANTES ===' : '',
    palpitesTabela,
  ].join('\n')

  const auditPrompt = `Você é um auditor rigoroso do boletim do Bolão Copa 2026. Analise o BOLETIM abaixo em duas dimensões:

1. ERROS FACTUAIS — compare com os FATOS REAIS:
   - Placares errados
   - Posições de ranking incorretas
   - Pontuações ou variações erradas (1d/2d/3d)
   - Nomes trocados ou distorcidos
   - Contagens de palpites incorretas (ex: "só 2 apostaram em empate" quando eram 5)
   - Afirmações sobre trajetória incorretas (ex: "subiu 3 posições" quando subiu 1)

2. ERROS DE PORTUGUÊS — identifique:
   - Erros de concordância verbal ou nominal
   - Erros de ortografia ou acentuação
   - Frases incoerentes ou com sentido ambíguo
   - Repetição excessiva de palavras no mesmo parágrafo

FORMATO DA RESPOSTA:
- Liste cada erro em uma linha, prefixado com [FATO] ou [PORTUGUÊS]
- Máximo 8 itens no total
- Se não houver nenhum erro em nenhuma das duas dimensões, responda exatamente: "SEM ERROS IDENTIFICADOS"
- Não comente estilo, tom, sugestões de melhoria ou opinião — apenas erros concretos

${fatosReais}

=== BOLETIM ===
${conteudo}`

  const conteudoOriginal = conteudo
  let auditoria = ''
  let conteudoFinal = conteudo

  try {
    const auditMsg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages:   [{ role: 'user', content: auditPrompt }],
    })
    auditoria = (auditMsg.content[0] as { type: string; text: string }).text.trim()
  } catch (e) {
    auditoria = `Auditoria falhou: ${e instanceof Error ? e.message : String(e)}`
  }

  // reescrita cirúrgica (Sonnet) — só se Haiku encontrou erros
  if (auditoria && auditoria !== 'SEM ERROS IDENTIFICADOS' && !auditoria.startsWith('Auditoria falhou')) {
    try {
      const rewritePrompt = `Você é um revisor. Corrija APENAS os erros listados abaixo no boletim.
Não altere tom, estrutura, humor, estilo ou qualquer trecho não mencionado nos erros.
Cada correção deve ser mínima — troque somente o que está errado.
Se não tiver certeza de que um trecho precisa de correção, deixe exatamente como está.
Retorne apenas o boletim corrigido, sem explicações.

ERROS A CORRIGIR:
${auditoria}

BOLETIM ORIGINAL:
${conteudoOriginal}`

      const rewriteMsg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1800,
        messages:   [{ role: 'user', content: rewritePrompt }],
      })
      conteudoFinal = (rewriteMsg.content[0] as { type: string; text: string }).text.trim()
    } catch (e) {
      // se a reescrita falhar, publica o original e registra no campo auditoria
      auditoria += `\n\n[Reescrita falhou: ${e instanceof Error ? e.message : String(e)}]`
    }
  }

  // salva
  const { error } = await supabase
    .from('boletim_copa')
    .insert({
      tipo: 'manha',
      titulo,
      conteudo:          conteudoFinal,
      conteudo_original: conteudoOriginal,
      prompt_texto:      prompt,
      auditoria,
    })

  if (error) {
    console.error('Erro ao salvar boletim:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const reescrito = conteudoFinal !== conteudoOriginal
  return NextResponse.json({ ok: true, titulo, auditoria, reescrito, gerado_em: new Date().toISOString() })
}
