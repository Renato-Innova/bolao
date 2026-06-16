import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

// carrega .env.local
const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

/* ── helpers ── */
const SLUG_MAP = {
  'Costa do Marfim': 'costa-do-marfim', 'Países Baixos': 'holanda', 'Holanda': 'holanda',
  'Coreia do Sul': 'coreia-do-sul', 'Estados Unidos': 'estados-unidos',
  'Arábia Saudita': 'arabia-saudita', 'Nova Zelândia': 'nova-zelandia',
  'República Tcheca': 'republica-tcheca', 'Bósnia-Herzegovina': 'bosnia-herzegovina',
  'Cabo Verde': 'cabo-verde', 'África do Sul': 'africa-do-sul',
  'Guiné Equatorial': 'guine-equatorial', 'Burkina Faso': 'burkina-faso',
  'Costa Rica': 'costa-rica', 'El Salvador': 'el-salvador',
  'Trinidad e Tobago': 'trinidad-tobago',
}
function toSlug(n) {
  return SLUG_MAP[n] ?? n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
function uolUrl(a, b, data) {
  const [y, m, d] = data.split('-')
  return `https://placar.uol.com.br/esporte/futebol/copa-do-mundo/${y}/${m}/${d}/${toSlug(a)}-x-${toSlug(b)}.htm`
}
function decodeHtml(s) {
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
function cleanUol(text) {
  return text
    .replace(/Publicidade\s*/gi, '')
    .replace(/Sobre o UOL[\s\S]*/i, '')
    .replace(/Conheça nossa história[\s\S]*/i, '')
    .replace(/Fale conosco[\s\S]*/i, '')
    .replace(/Leia também[\s\S]{0,200}/gi, '')
    .replace(/Deixe seu comentário[\s\S]*/i, '')
    .replace(/Comunicar erro[\s\S]*/i, '')
    .replace(/\s{2,}/g, ' ').trim()
}
async function fetchUolPage(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const raw = await r.text()
    const text = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return decodeHtml(cleanUol(text))
  } catch { return null }
}
function extractPreJogo(text, maxBlocks = 4, maxChars = 420) {
  if (!text) return ''
  const blocks = []; let idx = 0
  while (true) {
    const pos = text.indexOf('Pré-jogo', idx); if (pos === -1) break
    const next = text.indexOf('Pré-jogo', pos + 8)
    const chunk = text.slice(pos + 8, next === -1 ? pos + maxChars + 8 : next).trim().slice(0, maxChars)
    if (chunk.length > 40) blocks.push(chunk)
    idx = pos + 8
  }
  return blocks.slice(0, maxBlocks).join('\n')
}
function extractPosJogo(text) {
  if (!text) return ''
  const preJogoIdx = text.indexOf('Pré-jogo')
  const body = preJogoIdx > 0 ? text.slice(0, preJogoIdx) : text
  const startMarkers = ['Fim de jogo', 'FIM DE JOGO', 'APITA', 'ENCERRADO', 'Encerrado']
  let start = -1
  for (const m of startMarkers) { const i = body.indexOf(m); if (i !== -1 && (start === -1 || i < start)) start = i }
  const relevant = start > 0 ? body.slice(start) : body
  const frases = relevant.split(/[.!?]/).map(s => s.trim()).filter(s =>
    s.length > 20 && /gol|placar|vitória|empat|derrota|marca|defesa|substitui|cartão|pênalti|FIM|APITA|goleada|encerr/i.test(s)
  )
  return frases.join('. ').slice(0, 900)
}

/* ── datas BRT ── */
const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
const hoje = now.toISOString().slice(0, 10)
const ontem = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
const amanha = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)
const doisDiasAtras = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10)
const tresDiasAtras = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10)

console.log(`Datas: hoje=${hoje} | ontem=${ontem} | amanha=${amanha}`)

/* ── queries ── */
const [
  { data: encerrados },
  { data: jogosPeriodo },
  { data: palpitesAtivos },
] = await Promise.all([
  supabase.from('jogos_copa').select('*, resultado:resultados(*)').in('data', [ontem, hoje]).not('resultado', 'is', null).order('data').order('horario'),
  supabase.from('jogos_copa').select('*, resultado:resultados(*)').in('data', [hoje, amanha]).order('data').order('horario'),
  supabase.from('palpites').select('id,nome').eq('status', 'ativo'),
])

const pendentes = (jogosPeriodo ?? []).filter(j => !j.resultado || (Array.isArray(j.resultado) && j.resultado.length === 0))

console.log(`Encerrados: ${encerrados?.length ?? 0} | Pendentes: ${pendentes.length}`)
pendentes.forEach(j => console.log(` + pendente: ${j.data} ${j.horario?.slice(0,5)} ${j.time_a} x ${j.time_b}`))

const ids = (palpitesAtivos ?? []).map(p => p.id)
const [{ data: pontos }, { data: h1 }, { data: h2 }, { data: h3 }] = await Promise.all([
  supabase.rpc('get_pontos_por_palpite', { p_ids: ids }),
  supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', ontem).in('palpite_id', ids),
  supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', doisDiasAtras).in('palpite_id', ids),
  supabase.from('ranking_historico').select('palpite_id,total_pontos').eq('data', tresDiasAtras).in('palpite_id', ids),
])
const nomeMap = {}; for (const p of palpitesAtivos ?? []) nomeMap[p.id] = p.nome
const ptMap  = {}; for (const r of pontos ?? []) ptMap[r.palpite_id] = Number(r.total_pontos ?? 0)
const hm = rows => { const m = {}; for (const r of rows ?? []) m[r.palpite_id] = Number(r.total_pontos ?? 0); return m }
const h1m = hm(h1), h2m = hm(h2), h3m = hm(h3)
const sorted = [...ids].sort((a, b) => (ptMap[b] ?? 0) - (ptMap[a] ?? 0))
const fmt = d => d > 0 ? `+${d}` : String(d)
const rankingStr = sorted.map((id, i) => {
  const pts = ptMap[id] ?? 0
  return `#${i + 1}  ${nomeMap[id]}  ${pts} pts  [1d:${fmt(pts - (h1m[id] ?? 0))} / 2d:${fmt(pts - (h2m[id] ?? 0))} / 3d:${fmt(pts - (h3m[id] ?? 0))}]`
}).join('\n')

/* ── UOL crawling ── */
console.log('Buscando páginas UOL...')
const [encTexts, penTexts] = await Promise.all([
  Promise.all((encerrados ?? []).map(j => fetchUolPage(uolUrl(j.time_a, j.time_b, j.data)))),
  Promise.all(pendentes.map(j => fetchUolPage(uolUrl(j.time_a, j.time_b, j.data)))),
])

let posJogo = ''
;(encerrados ?? []).forEach((j, i) => {
  const r = Array.isArray(j.resultado) ? j.resultado[0] : j.resultado
  const pen = r?.placar_penalti_a != null ? ` (pên: ${r.placar_penalti_a}-${r.placar_penalti_b})` : ''
  posJogo += `▶ ${j.time_a} ${r?.placar_real_a}-${r?.placar_real_b} ${j.time_b}${pen} | ${j.data} ${j.horario?.slice(0, 5)}h\n`
  const ctx = extractPosJogo(encTexts[i])
  if (ctx) posJogo += ctx + '\n'
  posJogo += '\n'
})

let preJogo = ''
pendentes.forEach((j, i) => {
  preJogo += `▶ ${j.time_a} x ${j.time_b} | ${j.data} ${j.horario?.slice(0, 5)}h\n`
  const ctx = extractPreJogo(penTexts[i])
  if (ctx) preJogo += ctx + '\n'
  else preJogo += '(contexto UOL ainda nao disponivel para este jogo)\n'
  preJogo += '\n'
})

/* ── monta prompt ── */
const prompt = `Você é o narrador oficial do Bolão Copa 2026 — um jornalista esportivo com o tom da ESPN Brasil: animado e com pitadas de ironia, mas sempre profissional e com análise técnica de verdade.

REGRAS DE TOM E LINGUAGEM:
- Ironia e humor sao bem-vindos, mas sempre leves e respeitosos — sem grosseria, sem palavras rudes, sem ofensas.
- As piadas e provocacoes devem ser sobre as escolhas (palpites), nunca sobre a pessoa.
- A analise esportiva precisa ser relevante e tecnicamente embasada — nao sacrifique a substancia pelo entretenimento.
- Cite participantes pelo nome de forma carinhosa e bem-humorada, como se fossem amigos de longa data.
- Jamais use xingamentos, apelidos pejorativos ou linguagem que possa constranger alguem.

O bolão é uma competição entre amigos onde cada participante registrou palpites para todos os jogos da Copa. Os pontos são somados conforme os acertos.

DATA: ${hoje} — EDICAO: MANHA

===== RANKING ATUAL =====

${rankingStr}

===== JOGOS ENCERRADOS DESDE O ULTIMO BOLETIM (analise pos-jogo) =====

${posJogo.trim() || 'Nenhum jogo encerrado desde o ultimo boletim.'}

===== JOGOS ATE O PROXIMO BOLETIM (analise pre-jogo) =====

${preJogo.trim() || 'Nenhum jogo previsto ate o proximo boletim.'}

===== INSTRUCAO =====

Antes de escrever, analise os dados e identifique internamente:
- qual resultado e qual placar sao os mais apostados em cada jogo pendente
- quem apostou contra a maioria em cada jogo
- quem fez o palpite mais ousado do dia (placar mais incomum ou resultado improvavel)
- quem esta sem palpites registrados
- que impacto os resultados possiveis teriam no ranking
- quem lidera ha quantos dias consecutivos e se a lideranca e confortavel ou ameacada
- quem esta em trajetoria ascendente ou descendente nos ultimos dias (usar as variacoes de 1, 2 e 3 dias)
- os palpites de hoje dos lideres e dos ultimos colocados: onde concordam, onde divergem

Use essa analise para escrever um boletim em portugues brasileiro, SEM emojis e SEM icones de nenhum tipo.
Use subtitulos simples em letras maiusculas para separar as cinco secoes obrigatorias.
IMPORTANTE: respeite rigorosamente os limites de palavras de cada secao — conte mentalmente antes de finalizar e corte o que ultrapassar.

1. RODADA DE HOJE — LIMITE RIGIDO: maximo 100 palavras. Nem uma a mais.
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

/* ── salva .md ── */
const chars = prompt.length
const tokens = Math.round(chars / 4)
const ts = now.toISOString().slice(0, 16).replace('T', ' ')

const md = `# Simulação de Prompt — Boletim Copa 2026
**Gerado em:** ${ts} BRT
**Tamanho:** ${chars} caracteres / ~${tokens} tokens
**Encerrados:** ${encerrados?.length ?? 0} jogos | **Pendentes:** ${pendentes.length} jogos

---

\`\`\`
${prompt}
\`\`\`
`

writeFileSync('scripts/boletim-prompt-teste.md', md, 'utf8')
console.log(`\nPrompt salvo em scripts/boletim-prompt-teste.md`)
console.log(`Tamanho: ${chars} caracteres / ~${tokens} tokens`)
