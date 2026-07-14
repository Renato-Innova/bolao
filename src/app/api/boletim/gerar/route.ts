import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'

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

  // A página do UOL lista os eventos do mais recente para o mais antigo, então
  // "FIM DE JOGO" (apito final) aparece ANTES de "0' 1º T" (pontapé inicial)
  // no texto. Cortamos exatamente entre essas duas marcações para capturar o
  // jogo todo, do início ao fim, sem depender de um tamanho fixo de janela.
  const fimMatch    = body.match(/fim de jogo/i)
  // (?<!\d) evita casar dentro de "10' 1º T", "20' 1º T" etc — sem essa
  // ancoragem, ".match" parava no minuto 40 do 1º tempo (a primeira
  // ocorrência de "0' 1º T" como substring), cortando quase todo o 1º tempo.
  const inicioMatch = body.match(/(?<!\d)0' 1º T/i)

  const trecho = (fimMatch?.index != null && inicioMatch?.index != null && inicioMatch.index > fimMatch.index)
    ? body.slice(fimMatch.index, inicioMatch.index + inicioMatch[0].length)
    : body.slice(Math.max(0, body.length - 12000))  // fallback se as marcações não forem encontradas

  // Mantém apenas frases com eventos relevantes do jogo
  // length > 30 descartava os gritos de gol mais curtos e diretos (ex:
  // "GOOOL!" tem 6 chars) — o filtro de palavra-chave abaixo já garante
  // relevância, então um corte bem baixo só tira ruído (pontuação solta).
  // "go+l" (em vez de "gol" fixo) casa "GOOOL"/"GOOOOOOOOL" — a narração ao
  // vivo estica o "O" do grito de gol, e "gol" sozinho não bate com isso.
  const frases = trecho.split(/(?<=[.!?])\s+|\d+' [12]º T\s*/)
    .filter(l => l.length > 4)
    .filter(l => /go+l|FIM|APITA|cartão|substituição|placar|empat|vitória|derrota|defesa|chut|finaliz|escanteio|pênalti/i.test(l))

  return frases.join(' ').slice(0, 4000)
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
    ? ` (pên: ${(r.placar_penalti_a as number) > (r.placar_penalti_b as number) ? j.time_a : j.time_b} venceu)`
    : ''
  return `${j.time_a} ${r.placar_real_a}-${r.placar_real_b} ${j.time_b}${pen} | ${(j.horario as string).slice(0, 5)}h`
}

/* ── monta o prompt ────────────────────────────────────────────────────────── */
function buildPrompt(params: {
  hoje: string
  ranking: string
  posJogo: string
  preJogo: string
  rodadaInfo: string
  meioRelevante: string
  artilharia: string
  boletinsRecentes: string
  diasRestantesInfo: string
  pontuacaoFaseInfo: string
}) {
  const { hoje, ranking, posJogo, preJogo, rodadaInfo, meioRelevante, artilharia, boletinsRecentes, diasRestantesInfo, pontuacaoFaseInfo } = params

  return `Você é o narrador oficial do Bolão Copa 2026 — um jornalista esportivo com o tom da ESPN Brasil: animado e com pitadas de ironia, mas sempre profissional e com análise técnica de verdade.

REGRAS DE TOM E LINGUAGEM:
- Ironia e humor sao bem-vindos, mas sempre leves e respeitosos — sem grosseria, sem palavras rudes, sem ofensas.
- As piadas e provocacoes devem ser sobre as escolhas (palpites), nunca sobre a pessoa.
- A analise esportiva precisa ser relevante e tecnicamente embasada — nao sacrifique a substancia pelo entretenimento.
- Cite participantes pelo nome de forma carinhosa e bem-humorada, como se fossem amigos de longa data.
- Jamais use xingamentos, apelidos pejorativos ou linguagem que possa constranger alguem.

O bolão é uma competição entre amigos onde cada participante registrou palpites para todos os jogos da Copa. Os pontos são somados conforme os acertos.

DATA: ${hoje} — EDICAO: MANHA — BOLAO NA ${rodadaInfo.toUpperCase()}
${diasRestantesInfo}

===== RANKING ATUAL =====

${ranking}

===== DESTAQUES DO MEIO DA TABELA (cite 3-4 destes se forem relevantes — NUNCA force uma mencao sem motivo, e nunca invente nomes fora desta lista) =====

${meioRelevante || 'Nenhum destaque relevante no meio da tabela hoje — não force menção a ninguém do meio.'}

===== RANKING DE ARTILHARIA (top 10 — use para comentar gols de jogos encerrados ou expectativa para jogos pendentes) =====

${artilharia || 'Sem dados de artilharia disponiveis ainda.'}

===== PONTUACAO RESTANTE POR FASE (quantos pontos ainda estao em jogo em cada fase futura — use para avaliar se quem esta atras no ranking ainda tem chance real de recuperacao, ja que fases posteriores valem MUITO mais pontos por jogo que a fase de grupos) =====

${pontuacaoFaseInfo || 'Todas as fases ja foram concluidas.'}

===== BOLETINS RECENTES (memoria interna — NAO repita as mesmas observacoes ou piadas; use so para dar continuidade narrativa quando fizer sentido, ex: retomar uma historia ja contada) =====

${boletinsRecentes || 'Nenhum boletim anterior disponivel.'}

===== JOGOS ENCERRADOS DESDE O ULTIMO BOLETIM (analise pos-jogo) =====

${posJogo || 'Nenhum jogo encerrado desde o ultimo boletim.'}

===== JOGOS DE HOJE E DE AMANHA (analise pre-jogo) =====

${preJogo || 'Nenhum jogo previsto.'}

===== INSTRUCAO =====

Analise mentalmente os dados (NAO escreva essa analise — ela e apenas para voce):
- qual resultado e qual placar sao os mais apostados em cada jogo pendente
- quem apostou contra a maioria em cada jogo
- quem fez o palpite mais ousado do dia (placar mais incomum ou resultado improvavel)
- quem esta sem palpites registrados — lembre-se: o usuario ainda pode registrar ou editar um palpite ate 1 hora antes do horario do jogo, entao trate isso como um alerta de prazo ("ainda da tempo, mas corre"), nao como uma falha ja consumada
- que impacto os resultados possiveis teriam no ranking
- quem lidera ha quantos dias consecutivos e se a lideranca e confortavel ou ameacada
- quem esta em trajetoria ascendente ou descendente: use a posicao historica de cada rodada (coluna "era #X") para narrar saltos e quedas concretos
- os palpites de hoje dos lideres e dos ultimos colocados: onde concordam, onde divergem
- os DESTAQUES DO MEIO DA TABELA acima, se houver algum relevante — o boletim nao deve falar so de quem lidera e de quem esta no fundo, o meio da tabela tambem faz parte da historia quando ha algo digno de nota
- a RANKING DE ARTILHARIA acima: jogadores de times que jogaram ou vao jogar podem subir no ranking de artilharia; conecte isso a expectativa dos jogos pendentes ou ao que aconteceu nos encerrados
- os BOLETINS RECENTES acima: evite repetir as mesmas piadas ou observacoes ja feitas; se um fato ainda for relevante hoje (ex: uma rivalidade ou trajetoria que comecou ha dias), pode retomar para dar continuidade, mas sem soar repetitivo
- a CONTAGEM REGRESSIVA acima: quanto mais perto do fim, mais isso deve aparecer no tom do boletim (urgencia, ultima chance, reta final) — nao ignore esse dado
- a PONTUACAO RESTANTE POR FASE acima: use para avaliar de verdade a capacidade de recuperacao de quem esta mal no ranking — como as fases finais valem muito mais pontos por jogo, alguem distante na pontuacao pode ainda vencer o bolao; nao trate uma diferenca grande de pontos como decisao encerrada sem checar quanto ainda esta em jogo

Com base nessa analise, escreva DIRETAMENTE o boletim em portugues brasileiro, SEM emojis e SEM icones de nenhum tipo.
NAO escreva introducoes, pensamentos, analises ou qualquer texto antes da saudacao.
Use subtitulos simples em letras maiusculas para separar as cinco secoes numeradas (1 a 5).
Entre o fim de uma secao e o subtitulo da proxima, deixe uma linha em branco.
IMPORTANTE: respeite rigorosamente os limites de palavras de cada secao — conte mentalmente antes de finalizar e corte o que ultrapassar.

REGRAS OBRIGATORIAS DE FORMATO:
- Numeros sempre em algarismos, NUNCA por extenso. Correto: "250 pontos", "5 a frente", "35 pontos". Errado: "duzentos e cinquenta pontos", "cinco a frente", "trinta e cinco pontos".
- Placares sempre no formato "AxB". Correto: "3x1", "2x0". Errado: "tres a um", "dois a zero".
- Ao mencionar um jogo ja encerrado, inclua sempre o placar. Correto: "Franca 3x1 Senegal". Errado: "Franca e Senegal".
- Ao mencionar um palpite de placar, use o formato numerico. Correto: "apostou 5x0". Errado: "apostou cinco a zero".

0. [SEM SUBTITULO] — LIMITE RIGIDO: maximo 40 palavras. Nem uma a mais.
Comece diretamente com a saudacao, sem nenhum titulo ou rotulo antes dela. Uma saudacao matinal curta, engracada ou motivante para os participantes do bolao. Pode referenciar um resultado inesperado do dia anterior, uma variacao curiosa do ranking (quem subiu muito, quem caiu), ou simplesmente animar o dia. Tom leve, como um amigo acordando o grupo no WhatsApp. SEM emojis.

1. RODADA DE HOJE NO RANKING — LIMITE RIGIDO: maximo 100 palavras. Nem uma a mais.
Comente brevemente os resultados ja ocorridos e faca entre 2 e 4 provocacoes leves citando participantes pelo nome. Nao cite so lideres e ultimos colocados — use os DESTAQUES DO MEIO DA TABELA quando houver algo relevante, para variar quem aparece no boletim. Tom de mesa de bar, nao de tribunal. Se passar de 100 palavras, corte ate caber.

2. ANALISE DOS JOGOS ENCERRADOS — LIMITE RIGIDO: entre 120 e 150 palavras. Nem uma a menos, nem uma a mais.
Analise tecnica dos jogos encerrados: o que funcionou, o que surpreendeu, destaques individuais. Se houver mais de 3 jogos, priorize os mais impactantes e seja mais breve em cada um. Corte o que ultrapassar 150 palavras.

3. FIQUE DE OLHO — LIMITE RIGIDO: entre 120 e 150 palavras. Nem uma a menos, nem uma a mais.
Se houver jogos pendentes: para cada jogo, traga 1 fato relevante (forma, historico, desfalque) que possa justificar rever um palpite. Seja direto: "se voce apostou X, considere Y porque...".
Se nao houver jogos pendentes: escreva uma analise de 120 a 150 palavras sobre os impactos dos resultados de hoje nas proximas rodadas — quais times chegam com moral, quais estao em crise, o que os palpiteiros devem observar daqui para frente. Nao encurte esta secao mesmo sem jogos pendentes.

4. APOSTA CORAJOSA — LIMITE RIGIDO: maximo 70 palavras. Nem uma a mais.
Destaque o palpite mais ousado: quem fez, qual e, o que aconteceria no ranking se confirmar. Se nao houver jogos pendentes, destaque o palpite mais ousado dentre os jogos encerrados e quem acertou ou errou. Corte o que ultrapassar 70 palavras.

5. BRIGA PELO RANKING — LIMITE RIGIDO: entre 100 e 120 palavras. Nem uma a menos, nem uma a mais.
Cubra em ate 4 paragrafos curtos: (a) consistencia da lideranca, (b) use as posicoes historicas por rodada para narrar quem subiu ou caiu (ex: "estava em #5 na R1, foi para #3 na R2, agora e #1"), (c) disputa pelo topo — onde lideres concordam ou divergem nos palpites de hoje, (d) use os DESTAQUES DO MEIO DA TABELA se houver algum caso relevante hoje; se nao houver nenhum, cubra o fundo do poco (quem ainda pode recuperar). Crie expectativa para o boletim de amanha. Corte o que ultrapassar 120 palavras.`
}

/* ── tipos compartilhados ──────────────────────────────────────────────────── */
type Jogo    = Record<string, unknown>
type HistRow = { palpite_id: number; total_pontos: number }

type RankingData = {
  rankingStr:    string
  sorted:        number[]
  nomeMap:       Record<number, string>
  ptMap:         Record<number, number>
  palpiteIds:    number[]
  rodadaInfo:    string
  meioRelevante: string
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

// Ordena um ptMap e retorna mapa de palpite_id → posição (#1, #2, …)
function buildPosMap(ptMap: Record<number, number>, ids: number[]): Record<number, number> {
  const sorted = [...ids].sort((a, b) => (ptMap[b] ?? 0) - (ptMap[a] ?? 0))
  const pos: Record<number, number> = {}
  sorted.forEach((id, i) => { pos[id] = i + 1 })
  return pos
}

async function getRankingComVariacao(now: Date): Promise<RankingData> {
  const hoje = brtDate(now)

  const { data: palpitesAtivos } = await supabase
    .from('palpites')
    .select('id, nome, pontos_especiais, pontos_classificacao')
    .eq('status', 'ativo')

  const palpiteIds = (palpitesAtivos ?? []).map((p: { id: number }) => p.id)

  // pontos_especiais e pontos_classificacao não entram em get_pontos_por_palpite
  // (essa RPC só soma palpites_jogos.pontos) — somamos aqui pra bater com o
  // ranking real exibido no site.
  const especiaisMap: Record<number, number> = {}
  const classifMap: Record<number, number> = {}
  for (const p of palpitesAtivos ?? []) {
    especiaisMap[p.id] = Number(p.pontos_especiais ?? 0)
    classifMap[p.id] = Number(p.pontos_classificacao ?? 0)
  }

  // "Rodada" = número de dias de jogo já realizados (datas distintas com pelo menos 1 resultado)
  // Isso é independente do campo `rodada` do banco, que agrupa vários dias numa mesma rodada da fase de grupos.
  const { data: datasComJogo } = await supabase
    .from('jogos_copa')
    .select('data, resultado:resultados(id)')
    .lte('data', hoje)
    .order('data')

  const datasComResultado = [...new Set(
    (datasComJogo ?? [])
      .filter((j: Record<string, unknown>) => {
        const r = j.resultado
        return Array.isArray(r) ? r.length > 0 : r != null
      })
      .map((j: Record<string, unknown>) => j.data as string)
  )]

  const diaDeJogoAtual = datasComResultado.length        // ex: 6 dias de jogo realizados
  const rodadaInfo = diaDeJogoAtual > 0
    ? `Rodada ${diaDeJogoAtual} (${diaDeJogoAtual}º dia de jogos da Copa)`
    : 'Copa ainda sem jogos realizados'

  // Snapshots históricos: busca as 3 datas de jogo imediatamente anteriores ao dia atual
  // (usa datas reais de jogo, não simplesmente D-1/D-2/D-3 do calendário)
  const datasHistoricas = datasComResultado.slice(-4, -1).reverse()  // [D-1, D-2, D-3] em datas de jogo
  const [dataH1, dataH2, dataH3] = [datasHistoricas[0], datasHistoricas[1], datasHistoricas[2]]

  const [{ data: pontos }, { data: h1 }, { data: h2 }, { data: h3 }] = await Promise.all([
    supabase.rpc('get_pontos_por_palpite', { p_ids: palpiteIds }) as unknown as Promise<{ data: HistRow[] | null }>,
    dataH1
      ? supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', dataH1).in('palpite_id', palpiteIds)
      : Promise.resolve({ data: null }),
    dataH2
      ? supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', dataH2).in('palpite_id', palpiteIds)
      : Promise.resolve({ data: null }),
    dataH3
      ? supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', dataH3).in('palpite_id', palpiteIds)
      : Promise.resolve({ data: null }),
  ])

  const nomeMap: Record<number, string> = {}
  for (const p of palpitesAtivos ?? []) nomeMap[p.id] = p.nome

  const ptMap: Record<number, number> = {}
  for (const r of pontos ?? []) ptMap[r.palpite_id] = Number(r.total_pontos ?? 0)
  for (const id of palpiteIds) ptMap[id] = (ptMap[id] ?? 0) + especiaisMap[id] + classifMap[id]

  const toHistMap = (rows: HistRow[] | null) => {
    const m: Record<number, number> = {}
    for (const r of rows ?? []) m[r.palpite_id] = Number(r.total_pontos ?? 0)
    return m
  }
  const h1m = toHistMap(h1 as HistRow[] | null)
  const h2m = toHistMap(h2 as HistRow[] | null)
  const h3m = toHistMap(h3 as HistRow[] | null)

  // Posições históricas (só calcula se há dados suficientes)
  const hasH1 = Object.keys(h1m).length > 0
  const hasH2 = Object.keys(h2m).length > 0
  const hasH3 = Object.keys(h3m).length > 0
  const posH1 = hasH1 ? buildPosMap(h1m, palpiteIds) : null
  const posH2 = hasH2 ? buildPosMap(h2m, palpiteIds) : null
  const posH3 = hasH3 ? buildPosMap(h3m, palpiteIds) : null

  const sorted = [...palpiteIds].sort((a, b) => (ptMap[b] ?? 0) - (ptMap[a] ?? 0))
  const fmtDelta = (d: number) => d > 0 ? `+${d}` : String(d)

  // Rótulos: "R5(ontem)", "R4(D-2)", "R3(D-3)" referenciando o número do dia de jogo
  const r1Label = diaDeJogoAtual > 1 && hasH1 ? `R${diaDeJogoAtual - 1}(ontem)` : 'ontem'
  const r2Label = diaDeJogoAtual > 2 && hasH2 ? `R${diaDeJogoAtual - 2}(D-2)`   : 'D-2'
  const r3Label = diaDeJogoAtual > 3 && hasH3 ? `R${diaDeJogoAtual - 3}(D-3)`   : 'D-3'

  const rankingStr = sorted.map((id, i) => {
    const pts = ptMap[id] ?? 0
    const hist: string[] = []

    if (hasH1 && posH1) {
      const delta = pts - (h1m[id] ?? 0)
      hist.push(`${r1Label}: era #${posH1[id] ?? '?'} ${fmtDelta(delta)}pts`)
    }
    if (hasH2 && posH2) {
      const delta = pts - (h2m[id] ?? 0)
      hist.push(`${r2Label}: era #${posH2[id] ?? '?'} ${fmtDelta(delta)}pts`)
    }
    if (hasH3 && posH3) {
      const delta = pts - (h3m[id] ?? 0)
      hist.push(`${r3Label}: era #${posH3[id] ?? '?'} ${fmtDelta(delta)}pts`)
    }

    const histStr = hist.length > 0 ? `  [${hist.join(' | ')}]` : ''
    return `#${i + 1}  ${nomeMap[id]}  ${pts} pts${histStr}`
  }).join('\n')

  // Destaques do meio de tabela: exclui top 10 e base 10, só entra quem teve
  // variação real (posição ou pontos na rodada) — nunca força menção sem motivo
  const posAtual: Record<number, number> = {}
  sorted.forEach((id, i) => { posAtual[id] = i + 1 })
  const faixaMeio = sorted.slice(10, Math.max(10, sorted.length - 10))
  const meioCandidatos = (hasH1 && posH1)
    ? faixaMeio
        .map(id => {
          const posOntem  = posH1![id] ?? posAtual[id]
          const deltaPos  = posOntem - posAtual[id]              // positivo = subiu
          const deltaPts  = (ptMap[id] ?? 0) - (h1m[id] ?? 0)    // pontos ganhos na rodada
          return { id, deltaPos, deltaPts }
        })
        .filter(c => Math.abs(c.deltaPos) >= 2 || c.deltaPts >= 15)
        .sort((a, b) => Math.abs(b.deltaPos) - Math.abs(a.deltaPos) || b.deltaPts - a.deltaPts)
        .slice(0, 10)  // manda mais candidatos — a IA escolhe 3-4 realmente relevantes
    : []
  const meioRelevante = meioCandidatos
    .map(c => `${nomeMap[c.id]} (#${posAtual[c.id]}, era #${c.id in (posH1 ?? {}) ? (posH1![c.id]) : '?'}, ${c.deltaPts >= 0 ? '+' : ''}${c.deltaPts}pts na rodada)`)
    .join('\n')

  return { rankingStr, sorted, nomeMap, ptMap, palpiteIds, rodadaInfo, meioRelevante }
}

// ── Contagem regressiva até a final ──────────────────────────────────────────
// A data da final é fixa no calendário (jogos_copa.fase='F'), mesmo antes dos
// times estarem definidos — usada para a IA entender que o bolão está
// chegando ao fim e ajustar o tom (urgência, reta final).
async function getDiasRestantesInfo(hoje: string): Promise<string> {
  const { data } = await supabase
    .from('jogos_copa')
    .select('data')
    .eq('fase', 'F')
    .maybeSingle()

  if (!data?.data) return ''

  const hojeDate  = new Date(`${hoje}T00:00:00`)
  const finalDate = new Date(`${data.data}T00:00:00`)
  const diasRestantes = Math.round((finalDate.getTime() - hojeDate.getTime()) / (24 * 60 * 60 * 1000))
  const dataFinalFmt = finalDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  if (diasRestantes < 0) return `CONTAGEM REGRESSIVA: a final da Copa (${dataFinalFmt}) ja aconteceu — o bolao esta encerrado.`
  if (diasRestantes === 0) return `CONTAGEM REGRESSIVA: e HOJE — dia da final da Copa (${dataFinalFmt})! Ultimo dia do bolao.`
  return `CONTAGEM REGRESSIVA: faltam ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} para a final da Copa (${dataFinalFmt}) — o bolao esta entrando na reta final.`
}

// ── Pontuação restante por fase ───────────────────────────────────────────────
// Quantos pontos ainda estão em disputa em cada fase com jogos pendentes —
// usa o valor de placar_exato por fase (configuracoes_pontuacao) x número de
// jogos daquela fase que ainda não têm resultado. Ajuda a IA a não tratar uma
// diferença grande de pontos como "decisão tomada", já que as fases finais
// valem muito mais por jogo que a fase de grupos.
const FASE_LABEL: Record<string, string> = {
  GS: 'Fase de Grupos', R32: 'Rodada de 32', R16: 'Oitavas de Final',
  QF: 'Quartas de Final', SF: 'Semifinal', TPL: 'Disputa de 3º Lugar', F: 'Final',
}
const FASE_ORDEM = ['GS', 'R32', 'R16', 'QF', 'SF', 'TPL', 'F']

async function getPontuacaoFaseInfo(): Promise<string> {
  const [{ data: configs }, { data: jogos }] = await Promise.all([
    supabase.from('configuracoes_pontuacao').select('fase, tipo_acerto, pontos'),
    supabase.from('jogos_copa').select('fase, resultado:resultados(id)'),
  ])

  const exatoPorFase: Record<string, number> = {}
  for (const c of (configs ?? []) as { fase: string; tipo_acerto: string; pontos: number }[]) {
    if (c.tipo_acerto === 'placar_exato') exatoPorFase[c.fase] = c.pontos
  }

  const pendentesPorFase: Record<string, number> = {}
  for (const j of (jogos ?? []) as Jogo[]) {
    const temResultado = resolveResultado(j) !== null
    if (!temResultado) {
      const fase = j.fase as string
      pendentesPorFase[fase] = (pendentesPorFase[fase] ?? 0) + 1
    }
  }

  return FASE_ORDEM
    .filter(fase => (pendentesPorFase[fase] ?? 0) > 0)
    .map(fase => {
      const pendentes = pendentesPorFase[fase]
      const exato = exatoPorFase[fase] ?? 0
      const maxFase = pendentes * exato
      return `${FASE_LABEL[fase]}: ${pendentes} jogo(s) pendente(s) — placar exato vale ${exato}pts/jogo — ate ${maxFase}pts ainda em disputa so nessa fase`
    })
    .join('\n')
}

// ── Boletins recentes (memória de contexto, não aparece no boletim de hoje) ─
// Subtítulos literais usados pelo prompt, na ordem em que aparecem no texto final
const SUBTITULOS = [
  'RODADA DE HOJE NO RANKING',
  'ANALISE DOS JOGOS ENCERRADOS',
  'FIQUE DE OLHO',
  'APOSTA CORAJOSA',
  'BRIGA PELO RANKING',
]

function extractSection(texto: string, header: string): string {
  const idx = texto.toUpperCase().indexOf(header)
  if (idx === -1) return ''
  const startContent = idx + header.length
  const proximosHeaders = SUBTITULOS
    .filter(h => h !== header)
    .map(h => texto.toUpperCase().indexOf(h, startContent))
    .filter(i => i !== -1)
  const fim = proximosHeaders.length > 0 ? Math.min(...proximosHeaders) : texto.length
  return texto.slice(startContent, fim).trim()
}

async function getBoletinsRecentes(limit = 3, hoje?: string): Promise<string> {
  // Busca uma margem extra de linhas porque pode haver mais de um boletim no
  // mesmo dia (regeração manual) — aqui ficamos só com o mais recente de cada
  // dia, para a IA nunca receber duas versões do mesmo dia como se fossem dias diferentes.
  const { data } = await supabase
    .from('boletim_copa')
    .select('gerado_em, conteudo')
    .eq('tipo', 'manha')
    .order('gerado_em', { ascending: false })
    .limit(Math.max(limit * 5, 15))

  if (!data || data.length === 0) return ''

  const porDia = new Map<string, { gerado_em: string; conteudo: string }>()
  for (const b of data as { gerado_em: string; conteudo: string }[]) {
    const dia = brtDate(new Date(b.gerado_em))
    // Exclui o próprio dia de hoje: se já existe um boletim de hoje e estamos
    // gerando outro agora, é porque o anterior não ficou bom — não deve
    // entrar como "memória" do boletim que está sendo gerado.
    if (dia === hoje) continue
    if (!porDia.has(dia)) porDia.set(dia, b)  // já vem ordenado desc, então o primeiro de cada dia é o mais recente
  }

  return [...porDia.entries()].slice(0, limit).map(([dia, b]) => {
    const ranking1 = extractSection(b.conteudo, 'RODADA DE HOJE NO RANKING')
    const ranking5 = extractSection(b.conteudo, 'BRIGA PELO RANKING')
    return `--- Boletim de ${dia} ---\n[RODADA DE HOJE NO RANKING]\n${ranking1}\n\n[BRIGA PELO RANKING]\n${ranking5}`
  }).join('\n\n')
}

// ── Artilharia ───────────────────────────────────────────────────────────────
// artilheiros_copa.seleção vem da football-data.org em ingles (shortName/name);
// jogos_copa.time_a/time_b usa nomes em portugues — precisa traduzir para cruzar os dois.
const SELECAO_EN_PARA_PT: Record<string, string> = {
  'Germany': 'Alemanha', 'Argentina': 'Argentina', 'Algeria': 'Argélia',
  'Saudi Arabia': 'Arábia Saudita', 'Australia': 'Austrália', 'Brazil': 'Brasil',
  'Belgium': 'Bélgica', 'Bosnia-H.': 'Bósnia e Herzegovina', 'Bosnia and Herzegovina': 'Bósnia e Herzegovina',
  'Cape Verde': 'Cabo Verde', 'Canada': 'Canadá', 'Qatar': 'Catar',
  'Colombia': 'Colômbia', 'Korea Republic': 'Coreia do Sul', 'South Korea': 'Coreia do Sul',
  'Ivory Coast': 'Costa do Marfim', "Côte d'Ivoire": 'Costa do Marfim', 'Croatia': 'Croácia',
  'Curaçao': 'Curaçao', 'Curacao': 'Curaçao', 'USA': 'EUA', 'United States': 'EUA',
  'Egypt': 'Egito', 'Ecuador': 'Equador', 'Scotland': 'Escócia', 'Spain': 'Espanha',
  'France': 'França', 'Ghana': 'Gana', 'Haiti': 'Haiti', 'Netherlands': 'Holanda',
  'England': 'Inglaterra', 'Iraq': 'Iraque', 'IR Iran': 'Irã', 'Iran': 'Irã',
  'Japan': 'Japão', 'Jordan': 'Jordânia', 'Morocco': 'Marrocos', 'Mexico': 'México',
  'Norway': 'Noruega', 'New Zealand': 'Nova Zelândia', 'Panama': 'Panamá',
  'Paraguay': 'Paraguai', 'Portugal': 'Portugal', 'DR Congo': 'Rep. Dem. do Congo',
  'Senegal': 'Senegal', 'Sweden': 'Suécia', 'Switzerland': 'Suíça', 'Czechia': 'Tchéquia',
  'Tunisia': 'Tunísia', 'Turkey': 'Turquia', 'Türkiye': 'Turquia', 'Uruguay': 'Uruguai',
  'Uzbekistan': 'Uzbequistão', 'South Africa': 'África do Sul', 'Austria': 'Áustria',
}
function seleçãoParaPt(en: string): string {
  return SELECAO_EN_PARA_PT[en] ?? en
}

type Artilheiro = { jogador: string; seleção: string; gols: number; assistencias: number; jogos: number }

async function getArtilheiros(): Promise<{ rankingStr: string; lista: Artilheiro[] }> {
  const { data } = await supabase
    .from('artilheiros_copa')
    .select('jogador, "seleção", gols, assistencias, jogos')
    .order('gols', { ascending: false })
    .order('assistencias', { ascending: false })

  const lista = ((data ?? []) as Artilheiro[]).map(a => ({ ...a, seleção: seleçãoParaPt(a.seleção) }))
  const rankingStr = lista.slice(0, 10)
    .map((a, i) => `${i + 1}. ${a.jogador} (${a.seleção}) — ${a.gols}G ${a.assistencias}A ${a.jogos}J`)
    .join('\n')

  return { rankingStr, lista }
}

function artilheirosDoTime(lista: Artilheiro[], time: string): string {
  // lista já vem ordenada por gols/assistências — usamos o índice como
  // posição real no ranking, para a IA não confundir "artilheiro do time"
  // com "líder da artilharia" (são coisas diferentes).
  const doTime = lista
    .map((a, i) => ({ ...a, posicao: i + 1 }))
    .filter(a => a.seleção === time)
  if (doTime.length === 0) return ''
  return doTime.map(a => `${a.jogador} (#${a.posicao} ${a.gols}G ${a.assistencias}A)`).join(', ')
}

// ── Forma dos times (retrospecto na própria Copa) ────────────────────────────
type FormaTime = { jogos: number; vitorias: number; empates: number; derrotas: number; golsPro: number; golsContra: number }

async function getFormaTimes(times: string[]): Promise<Record<string, FormaTime>> {
  const unicos = [...new Set(times)]
  if (unicos.length === 0) return {}

  const { data } = await supabase
    .from('jogos_copa')
    .select('time_a, time_b, resultado:resultados(placar_real_a, placar_real_b)')
    .or(`time_a.in.(${unicos.map(t => `"${t}"`).join(',')}),time_b.in.(${unicos.map(t => `"${t}"`).join(',')})`)

  const forma: Record<string, FormaTime> = {}
  for (const t of unicos) forma[t] = { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0 }

  for (const j of (data ?? []) as Jogo[]) {
    const r = resolveResultado(j)
    if (!r) continue
    const ra = r.placar_real_a as number, rb = r.placar_real_b as number
    const timeA = j.time_a as string, timeB = j.time_b as string

    if (forma[timeA]) {
      forma[timeA].jogos++; forma[timeA].golsPro += ra; forma[timeA].golsContra += rb
      if (ra > rb) forma[timeA].vitorias++; else if (ra === rb) forma[timeA].empates++; else forma[timeA].derrotas++
    }
    if (forma[timeB]) {
      forma[timeB].jogos++; forma[timeB].golsPro += rb; forma[timeB].golsContra += ra
      if (rb > ra) forma[timeB].vitorias++; else if (rb === ra) forma[timeB].empates++; else forma[timeB].derrotas++
    }
  }
  return forma
}

function fmtForma(f: FormaTime | undefined): string {
  if (!f || f.jogos === 0) return 'sem jogos disputados ainda'
  return `${f.jogos}J ${f.vitorias}V ${f.empates}E ${f.derrotas}D (${f.golsPro}-${f.golsContra})`
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

function buildPreJogo(
  pendentes:    Jogo[],
  penTexts:     string[],
  palpitesTabela: string,
  forma:        Record<string, FormaTime>,
  artilheiros:  Artilheiro[],
): string {
  let out = ''
  pendentes.forEach((j, i) => {
    const timeA = j.time_a as string, timeB = j.time_b as string
    out += `▶ ${timeA} x ${timeB} | ${j.data} ${(j.horario as string).slice(0, 5)}h\n`
    out += `Retrospecto na Copa — ${timeA}: ${fmtForma(forma[timeA])} | ${timeB}: ${fmtForma(forma[timeB])}\n`
    const artA = artilheirosDoTime(artilheiros, timeA)
    const artB = artilheirosDoTime(artilheiros, timeB)
    if (artA || artB) {
      out += `Artilheiros em campo — ${timeA}: ${artA || 'nenhum no ranking'} | ${timeB}: ${artB || 'nenhum no ranking'}\n`
    }
    const ctx = extractPreJogo(penTexts[i], 4, 380)
    if (ctx) out += ctx + '\n'
    else out += '(contexto UOL ainda nao disponivel — usar conhecimento proprio)\n'
    out += '\n'
  })
  return (out + palpitesTabela).trim()
}

/* ── handler principal ─────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  // Aceita o CRON_SECRET (chamada automática) OU uma sessão de admin logado
  // (botão "Gerar Novo Boletim" em Admin > Configurações) — antes só o
  // CRON_SECRET era aceito, então o botão manual sempre dava Unauthorized.
  const authHeader = req.headers.get('authorization')
  const hasCronSecret = !process.env.CRON_SECRET || authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!hasCronSecret) {
    const sessionSupabase = await createSessionClient()
    const { data: { user } } = await sessionSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: userData } = await sessionSupabase
      .from('users').select('is_admin').eq('id', user.id).single()
    if (!userData?.is_admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now    = brtNow()
  const hoje   = brtDate(now)
  const ontem  = daysAgo(now, 1)
  const amanha = daysAhead(now, 1)

  // coleta de dados
  const encerrados                             = await getJogosEncerrados([ontem, hoje])
  const pendentes                              = await getJogosPendentes([hoje])
  const { rankingStr, sorted, nomeMap, ptMap,
          palpiteIds, rodadaInfo, meioRelevante } = await getRankingComVariacao(now)

  const diasRestantesInfo                      = await getDiasRestantesInfo(hoje)
  const pontuacaoFaseInfo                      = await getPontuacaoFaseInfo()
  const palpitesTabela                         = await getTabelaPalpites(pendentes, palpiteIds, sorted, nomeMap)
  const { encTexts, penTexts }                 = await getContextoUol(encerrados, pendentes)
  const { rankingStr: artilhariaStr, lista: artilheirosLista } = await getArtilheiros()
  const formaTimes                             = await getFormaTimes(
    pendentes.flatMap(j => [j.time_a as string, j.time_b as string])
  )
  const boletinsRecentes                       = await getBoletinsRecentes(3, hoje)

  // montagem do prompt
  const posJogo = buildPosJogo(encerrados, encTexts)
  const preJogo = buildPreJogo(pendentes, penTexts, palpitesTabela, formaTimes, artilheirosLista)
  const prompt  = buildPrompt({
    hoje, ranking: rankingStr, posJogo, preJogo, rodadaInfo,
    meioRelevante, artilharia: artilhariaStr, boletinsRecentes, diasRestantesInfo, pontuacaoFaseInfo,
  })

  // ?preview=true — só monta e devolve o prompt, sem chamar a API da Anthropic
  // nem gravar nada no banco. Uso: testar mudanças no prompt sem custo nem
  // gerar um boletim duplicado para o dia.
  if (req.nextUrl.searchParams.get('preview') === 'true') {
    return NextResponse.json({ ok: true, preview: true, prompt })
  }

  // geração do boletim
  // Tokens reais de cada chamada (message.usage) — usados para calcular o
  // custo real de IA por boletim, em vez de uma estimativa fixa.
  let tokensInputSonnet = 0, tokensOutputSonnet = 0
  let tokensInputHaiku  = 0, tokensOutputHaiku  = 0

  const message  = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2400,
    messages:   [{ role: 'user', content: prompt }],
  })
  tokensInputSonnet  += message.usage.input_tokens
  tokensOutputSonnet += message.usage.output_tokens
  if (message.stop_reason === 'max_tokens') {
    console.warn('[boletim] geração cortada por max_tokens — considere aumentar o limite')
  }
  const conteudo = (message.content[0] as { type: string; text: string }).text.trim()
  const titulo   = 'Boletim da Copa 2026 · Edição da Manhã'

  // auditoria automática (Haiku) — fatos + português
  // fatosReais espelha exatamente o que o Sonnet recebeu: data, rodada, ranking,
  // meio de tabela, artilharia, pos-jogo (UOL), pre-jogo (UOL + forma + artilheiros + tabela de palpites)
  // (boletins recentes não entram aqui — são memória de continuidade, não fato a auditar)
  const fatosReais = [
    `=== DATA: ${hoje} — BOLÃO NA ${rodadaInfo.toUpperCase()} ===`,
    diasRestantesInfo,
    '',
    '=== RANKING REAL (posição atual, pontos e histórico por rodada) ===',
    rankingStr,
    '',
    '=== DESTAQUES DO MEIO DA TABELA (só estes podem ser citados como "meio") ===',
    meioRelevante || 'Nenhum destaque relevante no meio da tabela hoje.',
    '',
    '=== RANKING DE ARTILHARIA REAL ===',
    artilhariaStr || 'Sem dados de artilharia disponíveis ainda.',
    '',
    '=== PONTUAÇÃO RESTANTE POR FASE REAL ===',
    pontuacaoFaseInfo || 'Todas as fases já foram concluídas.',
    '',
    '=== JOGOS ENCERRADOS — RESULTADOS E CONTEXTO PÓS-JOGO (UOL) ===',
    posJogo || 'Nenhum resultado disponível.',
    '',
    '=== JOGOS PENDENTES — CONTEXTO PRÉ-JOGO (UOL), RETROSPECTO, ARTILHEIROS E PALPITES DOS PARTICIPANTES ===',
    // preJogo já contém forma + artilheiros + palpitesTabela concatenados dentro de buildPreJogo
    preJogo || 'Nenhum jogo pendente.',
  ].join('\n')

  const auditPrompt = `Você é um auditor rigoroso do boletim do Bolão Copa 2026. Analise o BOLETIM abaixo em duas dimensões:

1. ERROS FACTUAIS — compare com os FATOS REAIS:
   - Placares errados
   - Posições de ranking incorretas (posição atual ou histórica por rodada)
   - Pontuações ou variações de pontos erradas
   - Número da rodada/dia de jogo incorreto
   - Nomes trocados ou distorcidos
   - Contagens de palpites incorretas (ex: "só 2 apostaram em empate" quando eram 5)
   - Afirmações sobre trajetória incorretas (ex: "subiu 3 posições" quando subiu 1)
   - Menção a alguém do "meio da tabela" que NÃO está listado em DESTAQUES DO MEIO DA TABELA
   - Gols, assistências ou jogos de artilheiros que não batem com o RANKING DE ARTILHARIA REAL
   - Afirmações de liderança/posição na artilharia (ex: "lidera", "isolado na artilharia", "líder de gols") que não correspondem à posição real (#1, #2...) no RANKING DE ARTILHARIA REAL — um jogador citado como "artilheiro do time" não é necessariamente o líder geral
   - Retrospecto de time (vitórias/empates/derrotas/gols) que não bate com o contexto pré-jogo fornecido
   - Contagem regressiva de dias até a final incorreta (compare com a CONTAGEM REGRESSIVA nos fatos reais)
   - Pontuação restante por fase incorreta (compare com a PONTUAÇÃO RESTANTE POR FASE REAL — jogos pendentes, pontos por fase)

2. ERROS DE FORMATO — verifique cada ocorrência:
   - Número escrito por extenso onde deveria ser algarismo: "duzentos pontos" → deve ser "200 pontos", "cinco à frente" → "5 à frente", "trinta e cinco pontos" → "35 pontos"
   - Placar de jogo encerrado escrito por extenso: "três a um" → deve ser "3x1", "dois a zero" → "2x0"
   - Palpite de placar escrito por extenso: "apostou cinco a zero" → deve ser "apostou 5x0"
   - Jogo encerrado mencionado sem placar: "França e Senegal" ou "França contra Senegal" sem o resultado → deve incluir "França 3x1 Senegal"

3. ERROS DE PORTUGUÊS — identifique:
   - Erros de concordância verbal ou nominal
   - Erros de ortografia ou acentuação
   - Frases incoerentes ou com sentido ambíguo
   - Repetição excessiva de palavras no mesmo parágrafo

FORMATO DA RESPOSTA:
- Liste cada erro em uma linha, prefixado com [FATO], [FORMATO] ou [PORTUGUÊS]
- Máximo 10 itens no total
- Se não houver nenhum erro em nenhuma das dimensões, responda exatamente: "SEM ERROS IDENTIFICADOS"
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
    tokensInputHaiku  += auditMsg.usage.input_tokens
    tokensOutputHaiku += auditMsg.usage.output_tokens
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
      tokensInputSonnet  += rewriteMsg.usage.input_tokens
      tokensOutputSonnet += rewriteMsg.usage.output_tokens
      conteudoFinal = (rewriteMsg.content[0] as { type: string; text: string }).text.trim()
    } catch (e) {
      // se a reescrita falhar, publica o original e registra no campo auditoria
      auditoria += `\n\n[Reescrita falhou: ${e instanceof Error ? e.message : String(e)}]`
    }
  }

  // custo real de IA — preços por MTok: Sonnet 4.6 $3 in / $15 out, Haiku 4.5 $1 in / $5 out
  const custoUsd =
    (tokensInputSonnet  / 1_000_000) * 3  + (tokensOutputSonnet / 1_000_000) * 15 +
    (tokensInputHaiku   / 1_000_000) * 1  + (tokensOutputHaiku  / 1_000_000) * 5

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
      tokens_input_sonnet:  tokensInputSonnet,
      tokens_output_sonnet: tokensOutputSonnet,
      tokens_input_haiku:   tokensInputHaiku,
      tokens_output_haiku:  tokensOutputHaiku,
      custo_usd:            custoUsd,
    })

  if (error) {
    console.error('Erro ao salvar boletim:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag('dashboard', 'max')

  const reescrito = conteudoFinal !== conteudoOriginal
  return NextResponse.json({ ok: true, titulo, auditoria, reescrito, custoUsd, gerado_em: new Date().toISOString() })
}
