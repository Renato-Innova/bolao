import PDFDocument from 'pdfkit'
import { createAdminClient } from '@/lib/supabase/server'
import { getRanking } from '@/services/ranking'
import { SPECIAL_POINTS } from '@/utils/scoring'

const FASE_LABEL: Record<string, string> = {
  GS: 'Fase de Grupos', R32: '16 Avos de Final', R16: 'Oitavas de Final',
  QF: 'Quartas de Final', SF: 'Semifinal', TPL: 'Disputa de 3º Lugar', F: 'Final',
}
const FASE_ORDER = ['GS', 'R32', 'R16', 'QF', 'SF', 'TPL', 'F']

const ESPECIAIS_FIELDS = [
  { key: 'campeao', label: 'Campeão' },
  { key: 'vice_campeao', label: 'Vice-Campeão' },
  { key: 'artilheiro', label: 'Artilheiro' },
  { key: 'melhor_jogador', label: 'Melhor Jogador' },
  { key: 'melhor_goleiro', label: 'Melhor Goleiro' },
] as const

const MESES = ['', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtData(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)}/${MESES[parseInt(m)]}`
}

// ── Cores (mesma paleta do app — ver globals.css) ───────────────────────────
const BG = '#020F2A'
const CARD = '#0D1E3D'
const BORDER = 'rgba(74,144,217,0.15)'
const ACCENT = '#4A90D9'
const ACCENT_L = '#7BB8F0'
const GREEN = '#4ade80'
const ORANGE = '#f97316'
const GOLD = '#FFC850'
const RED = 'rgba(255,100,100,0.85)'
const WHITE = '#FFFFFF'
const MUTED = 'rgba(255,255,255,0.55)'
const MUTED2 = 'rgba(255,255,255,0.35)'
const TRACK = 'rgba(255,255,255,0.08)'

// pdfkit's fillColor/strokeColor only understand hex, named colors or [r,g,b]
// arrays — NOT CSS "rgba(...)" strings (they're silently ignored, leaving the
// previous color in place). Patch both methods on the instance so every
// rgba(...) constant used throughout this file works transparently, including
// via the .fill(color)/.stroke(color) shorthands (which call fillColor/
// strokeColor internally, so patching those two methods covers everything).
function patchRgbaColors(doc: PDFKit.PDFDocument): PDFKit.PDFDocument {
  const anyDoc = doc as unknown as Record<string, (...args: unknown[]) => unknown>
  const origFillColor = anyDoc.fillColor.bind(doc)
  const origStrokeColor = anyDoc.strokeColor.bind(doc)

  function resolve(color: unknown, opacity: unknown): [unknown, unknown] {
    // pdfkit's fillOpacity/strokeOpacity is stateful and a no-op when passed
    // undefined — so an earlier rgba(...) call's alpha would otherwise "leak"
    // into every later opaque fillColor/strokeColor call. Default to opacity
    // 1 whenever the caller isn't explicitly setting a transparent color.
    if (typeof color === 'string' && !color.startsWith('#')) {
      const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/)
      if (m) {
        const hex = '#' + [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('')
        const a = m[4] !== undefined ? Number(m[4]) : 1
        return [hex, opacity ?? a]
      }
    }
    return [color, opacity ?? 1]
  }

  anyDoc.fillColor = (...args: unknown[]) => {
    const [color, opacity] = resolve(args[0], args[1])
    return origFillColor(color, opacity)
  }
  anyDoc.strokeColor = (...args: unknown[]) => {
    const [color, opacity] = resolve(args[0], args[1])
    return origStrokeColor(color, opacity)
  }
  return doc
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const ML = 24
const MR = 24
const CW = PAGE_W - ML - MR

type GameRow = {
  numero_jogo: number
  fase: string
  data: string
  time_a: string
  time_b: string
  placar_palpite_a: number | null
  placar_palpite_b: number | null
  placar_real_a: number
  placar_real_b: number
  placar_penalti_a: number | null
  placar_penalti_b: number | null
  pontos: number
  submitted: boolean
}

interface RelatorioData {
  palpiteNome: string
  usuarioNome: string
  posicao: number | null
  totalAtivos: number
  totalEarned: number
  totalMax: number
  porFase: Record<string, { earned: number; max: number; exatos: number; parciais: number }>
  subtotalJogos: { earned: number; max: number }
  classif: { earned: number; max: number; corretos: number; total: number }
  especiais: {
    earned: number
    max: number
    itens: { label: string; apostou: string; oficial: string | null; acertou: boolean; pts: number }[]
  }
  exatosTotal: number
  parciaisTotal: number
  maiorJogo: { pontos: number; fase: string; confronto: string } | null
  jogos: GameRow[]
}

// ── Coleta de dados ──────────────────────────────────────────────────────────
async function coletarDados(palpiteId: number): Promise<RelatorioData> {
  const admin = createAdminClient()

  const { data: palpite } = await admin
    .from('palpites')
    .select('nome, usuario_id, campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro, pontos_especiais, pontos_classificacao')
    .eq('id', palpiteId)
    .single()
  if (!palpite) throw new Error('Palpite não encontrado')

  const { data: usuario } = await admin.from('users').select('nome').eq('id', palpite.usuario_id).single()

  const { data: jogosRaw } = await admin
    .from('jogos_copa')
    .select('id, numero_jogo, fase, data, horario, time_a, time_b, resultado:resultados(placar_real_a, placar_real_b, placar_penalti_a, placar_penalti_b)')
    .order('data')
    .order('horario')
    .order('numero_jogo')

  const { data: palpitesJogos } = await admin
    .from('palpites_jogos')
    .select('jogo_id, placar_palpite_a, placar_palpite_b, pontos, submitted_at')
    .eq('palpite_id', palpiteId)

  const { data: resumoRows } = await admin.from('pontuacao_resumo').select('fase, tipo, pontos_max')

  const { data: especiaisOficial } = await admin.from('resultados_especiais').select('*').eq('id', 1).single()

  const { data: configEspeciais } = await admin
    .from('configuracoes_pontuacao')
    .select('tipo_acerto, pontos')
    .eq('fase', 'ESP')

  const { data: classifConfig } = await admin
    .from('configuracoes_pontuacao')
    .select('pontos')
    .eq('fase', 'GS')
    .eq('tipo_acerto', 'classificacao')
    .single()

  const pjMap = new Map((palpitesJogos ?? []).map(pj => [pj.jogo_id, pj]))

  type JogoJoined = {
    id: number; numero_jogo: number; fase: string; data: string; time_a: string; time_b: string
    resultado: { placar_real_a: number; placar_real_b: number; placar_penalti_a: number | null; placar_penalti_b: number | null } | null
  }

  const jogos: GameRow[] = ((jogosRaw ?? []) as unknown as JogoJoined[])
    .filter(j => j.resultado)
    .map(j => {
      const pj = pjMap.get(j.id)
      return {
        numero_jogo: j.numero_jogo,
        fase: j.fase,
        data: j.data,
        time_a: j.time_a,
        time_b: j.time_b,
        placar_palpite_a: pj?.placar_palpite_a ?? null,
        placar_palpite_b: pj?.placar_palpite_b ?? null,
        placar_real_a: j.resultado!.placar_real_a,
        placar_real_b: j.resultado!.placar_real_b,
        placar_penalti_a: j.resultado!.placar_penalti_a,
        placar_penalti_b: j.resultado!.placar_penalti_b,
        pontos: pj?.pontos ?? 0,
        submitted: !!pj?.submitted_at,
      }
    })

  // ── Por fase ──
  const porFase: RelatorioData['porFase'] = {}
  for (const fase of FASE_ORDER) porFase[fase] = { earned: 0, max: 0, exatos: 0, parciais: 0 }
  for (const j of jogos) {
    const exato = j.placar_palpite_a !== null && j.placar_palpite_a === j.placar_real_a && j.placar_palpite_b === j.placar_real_b
    porFase[j.fase].earned += j.pontos
    if (exato) porFase[j.fase].exatos++
    else if (j.pontos > 0) porFase[j.fase].parciais++
  }
  for (const r of (resumoRows ?? [])) {
    if (r.tipo === 'jogos' && porFase[r.fase]) porFase[r.fase].max = r.pontos_max
  }

  const subtotalJogos = {
    earned: Object.values(porFase).reduce((s, f) => s + f.earned, 0),
    max: Object.values(porFase).reduce((s, f) => s + f.max, 0),
  }
  const exatosTotal = Object.values(porFase).reduce((s, f) => s + f.exatos, 0)
  const parciaisTotal = Object.values(porFase).reduce((s, f) => s + f.parciais, 0)

  // ── Classificação de grupos ──
  const classifMax = (resumoRows ?? []).find(r => r.tipo === 'classificacao')?.pontos_max ?? 640
  const pontosPorAcerto = classifConfig?.pontos ?? 20
  const classif = {
    earned: palpite.pontos_classificacao ?? 0,
    max: classifMax,
    corretos: Math.round((palpite.pontos_classificacao ?? 0) / pontosPorAcerto),
    total: Math.round(classifMax / pontosPorAcerto),
  }

  // ── Especiais ──
  const configMap: Record<string, number> = {}
  for (const c of (configEspeciais ?? [])) configMap[c.tipo_acerto] = c.pontos
  const especiaisMax = (resumoRows ?? []).find(r => r.tipo === 'especiais')?.pontos_max ?? 320

  const itens = ESPECIAIS_FIELDS.map(({ key, label }) => {
    const apostou = (palpite as Record<string, unknown>)[key] as string | null ?? '—'
    const oficial = especiaisOficial ? (especiaisOficial as Record<string, unknown>)[key] as string | null : null
    const acertou = !!(oficial && apostou && oficial.trim().toLowerCase() === apostou.trim().toLowerCase())
    const pts = configMap[key] ?? SPECIAL_POINTS[key as keyof typeof SPECIAL_POINTS]
    return { label, apostou, oficial, acertou, pts }
  })

  const especiais = { earned: palpite.pontos_especiais ?? 0, max: especiaisMax, itens }

  // ── Maior pontuação em 1 jogo ──
  let maiorJogo: RelatorioData['maiorJogo'] = null
  for (const j of jogos) {
    if (!maiorJogo || j.pontos > maiorJogo.pontos) {
      maiorJogo = { pontos: j.pontos, fase: FASE_LABEL[j.fase] ?? j.fase, confronto: `${j.time_a} x ${j.time_b}` }
    }
  }

  // ── Posição no ranking ──
  // (não usa getRankingCached — evita unstable_cache fora do runtime de request
  // do Next, e este endpoint é sob demanda/pouco frequente o suficiente pra
  // não precisar do cache de 24h usado no dashboard)
  const ranking = await getRanking()
  const meuRanking = ranking.find(r => r.palpite_id === palpiteId)
  const totalEarned = subtotalJogos.earned + especiais.earned + classif.earned
  const totalMax = (resumoRows ?? []).reduce((s, r) => s + r.pontos_max, 0) || 3820

  return {
    palpiteNome: palpite.nome,
    usuarioNome: usuario?.nome ?? '',
    posicao: meuRanking?.posicao ?? null,
    totalAtivos: ranking.length,
    totalEarned: meuRanking?.total_pontos ?? totalEarned,
    totalMax,
    porFase,
    subtotalJogos,
    classif,
    especiais,
    exatosTotal,
    parciaisTotal,
    maiorJogo,
    jogos,
  }
}

// ── Narrativa (gerada a partir dos dados, sem prosa fixa) ───────────────────
function gerarNarrativa(d: RelatorioData): string {
  const pctTotal = Math.round((d.totalEarned / d.totalMax) * 100)
  const pctJogos = Math.round((d.subtotalJogos.earned / d.subtotalJogos.max) * 100)

  const acertosEspeciais = d.especiais.itens.filter(i => i.acertou).map(i => i.label)
  const especiaisTexto = acertosEspeciais.length === 0
    ? 'não acertou nenhuma das cinco categorias'
    : acertosEspeciais.length === 1
      ? `acertou ${acertosEspeciais[0]}`
      : `acertou ${acertosEspeciais.slice(0, -1).join(', ')} e ${acertosEspeciais[acertosEspeciais.length - 1]}`

  const posicaoTexto = d.posicao === 1
    ? `1º lugar geral do Bolão Copa 2026, entre ${d.totalAtivos} participantes`
    : d.posicao
      ? `${d.posicao}º colocado geral, entre ${d.totalAtivos} participantes`
      : 'fora da lista de palpites ativos no momento'

  const maiorTexto = d.maiorJogo
    ? ` A maior pontuação em um único jogo foi de ${d.maiorJogo.pontos} pts, na partida ${d.maiorJogo.confronto} (${d.maiorJogo.fase}).`
    : ''

  return (
    `${d.exatosTotal} acertos exatos e ${d.parciaisTotal} acertos parciais ao longo dos 104 jogos, ` +
    `com ${d.subtotalJogos.earned} de ${d.subtotalJogos.max} pts possíveis nos jogos (${pctJogos}%). ` +
    `No bônus de classificação de grupos, acertou ${d.classif.corretos} dos ${d.classif.total} times classificados ` +
    `(${d.classif.earned} de ${d.classif.max} pts). Nos palpites especiais, ${especiaisTexto}.` +
    maiorTexto +
    ` Resultado final: ${d.totalEarned} pontos, ${pctTotal}% do máximo possível — ${posicaoTexto}.`
  )
}

// ── Desenho ──────────────────────────────────────────────────────────────────
function bar(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, pct: number, color: string) {
  doc.roundedRect(x, y, w, h, h / 2).fill(TRACK)
  const fw = Math.max((w * Math.min(pct, 100)) / 100, pct > 0 ? h : 0)
  if (pct > 0) doc.roundedRect(x, y, fw, h, h / 2).fill(color)
}

function pageChrome(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(BG)
}

function drawPagina1(doc: PDFKit.PDFDocument, d: RelatorioData) {
  pageChrome(doc)
  let y = 34

  // ── Cabeçalho ──
  doc.font('Helvetica-Bold').fontSize(9).fillColor(ACCENT_L)
    .text('BOLÃO COPA 2026 · RELATÓRIO FINAL DO PALPITE', ML, y)

  doc.font('Helvetica-Bold').fontSize(28).fillColor(WHITE)
    .text(d.palpiteNome, ML, y + 16)

  const badgeTexto = d.posicao === 1 ? 'Campeão do Bolão'
    : d.posicao === 2 ? 'Vice-Campeão do Bolão'
    : d.posicao === 3 ? '3º Lugar no Bolão'
    : d.posicao ? `${d.posicao}º Lugar Geral` : null
  const badgeCor = d.posicao && d.posicao <= 3 ? GOLD : ACCENT_L

  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
  const prefixo = `${d.usuarioNome}  ·  104 jogos apostados` + (badgeTexto ? '  ·  ' : '')
  doc.text(prefixo, ML, y + 52, { continued: !!badgeTexto, lineBreak: false })
  if (badgeTexto) {
    doc.font('Helvetica-Bold').fillColor(badgeCor).text(badgeTexto, { lineBreak: false })
  }

  const pctTotal = Math.round((d.totalEarned / d.totalMax) * 100)
  doc.font('Helvetica-Bold').fontSize(36).fillColor(GREEN)
    .text(String(d.totalEarned), ML, y - 6, { width: CW, align: 'right' })
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(`de ${d.totalMax.toLocaleString('pt-BR')} pts possíveis (${pctTotal}%)`, ML, y + 34, { width: CW, align: 'right' })
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED2)
    .text('PONTUAÇÃO FINAL', ML, y + 46, { width: CW, align: 'right' })

  y += 76
  doc.moveTo(ML, y).lineTo(PAGE_W - MR, y).lineWidth(0.75).strokeColor(BORDER).stroke()
  y += 16

  // ── Painéis ──
  const colGap = 12
  const colLW = CW * 0.52
  const colRW = CW - colLW - colGap
  const colLX = ML
  const colRX = ML + colLW + colGap
  const panelTop = y
  const rowH = 33

  const fasesList = FASE_ORDER.map(f => ({ fase: f, label: FASE_LABEL[f], ...d.porFase[f] }))
  const panelLH = 26 + (fasesList.length + 1) * rowH + 6
  doc.roundedRect(colLX, panelTop, colLW, panelLH, 8).fill(CARD)
  doc.rect(colLX, panelTop, colLW, 2).fill(ACCENT)

  let py = panelTop + 20
  doc.rect(colLX + 14, py, 6, 6).fill(ACCENT)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text('PONTOS POR FASE', colLX + 26, py - 2)
  py += 22

  for (const f of fasesList) {
    const p = f.max ? Math.round((f.earned / f.max) * 100) : 0
    doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text(f.label, colLX + 14, py, { lineBreak: false })
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(`${f.earned} / ${f.max} pts`, colLX + 14, py, { width: colLW - 28, align: 'right' })
    const barY = py + 15
    bar(doc, colLX + 14, barY, colLW - 28, 5, p, p >= 60 ? GREEN : p >= 30 ? ACCENT : ORANGE)
    doc.font('Helvetica').fontSize(6.5).fillColor(MUTED2)
      .text(`${p}%`, colLX + 14, barY + 8, { width: colLW - 28, align: 'right' })
    py += rowH
  }

  doc.moveTo(colLX + 14, py + 2).lineTo(colLX + colLW - 14, py + 2).lineWidth(0.5).strokeColor('rgba(255,255,255,0.08)').stroke()
  const spJogos = d.subtotalJogos.max ? Math.round((d.subtotalJogos.earned / d.subtotalJogos.max) * 100) : 0
  doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text('SUBTOTAL JOGOS', colLX + 14, py + 10, { lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ACCENT_L)
    .text(`${d.subtotalJogos.earned} / ${d.subtotalJogos.max} pts (${spJogos}%)`, colLX + 14, py + 10, { width: colLW - 28, align: 'right' })

  // painel direito superior — classificação
  const panelR1H = 74
  doc.roundedRect(colRX, panelTop, colRW, panelR1H, 8).fill(CARD)
  doc.rect(colRX, panelTop, colRW, 2).fill(GREEN)
  let ry = panelTop + 20
  doc.rect(colRX + 14, ry, 6, 6).fill(GREEN)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text('BÔNUS DE CLASSIFICAÇÃO DE GRUPOS', colRX + 26, ry - 2)
  ry += 24
  doc.font('Helvetica').fontSize(10).fillColor(WHITE)
    .text(`${d.classif.corretos} de ${d.classif.total} classificados corretos`, colRX + 14, ry, { lineBreak: false })
  const pClassif = d.classif.max ? Math.round((d.classif.earned / d.classif.max) * 100) : 0
  doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN)
    .text(`${d.classif.earned} / ${d.classif.max} pts`, colRX + 14, ry, { width: colRW - 28, align: 'right' })
  const barY2 = ry + 14
  bar(doc, colRX + 14, barY2, colRW - 28, 5, pClassif, GREEN)
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED2)
    .text(`${pClassif}%`, colRX + 14, barY2 + 8, { width: colRW - 28, align: 'right' })

  // painel direito inferior — especiais
  const panelR2Top = panelTop + panelR1H + 10
  const panelR2H = 26 + d.especiais.itens.length * 26 + 20
  doc.roundedRect(colRX, panelR2Top, colRW, panelR2H, 8).fill(CARD)
  doc.rect(colRX, panelR2Top, colRW, 2).fill(GOLD)
  let ey = panelR2Top + 20
  doc.rect(colRX + 14, ey, 6, 6).fill(GOLD)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text('PALPITES ESPECIAIS', colRX + 26, ey - 2)
  ey += 22

  for (const item of d.especiais.itens) {
    const cor = item.acertou ? GREEN : RED
    doc.circle(colRX + 17, ey + 5, 3.2).fill(cor)
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(`${item.label}:`, colRX + 27, ey, { lineBreak: false })
    doc.font('Helvetica-Bold').fontSize(9).fillColor(cor)
      .text(item.acertou ? `+${item.pts} pts` : '0 pts', colRX + 14, ey, { width: colRW - 28, align: 'right' })
    ey += 11
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
      .text(item.acertou ? item.apostou : `${item.apostou}  (oficial: ${item.oficial ?? '—'})`, colRX + 27, ey, { width: colRW - 40, lineBreak: false })
    ey += 15
  }

  doc.moveTo(colRX + 14, ey + 2).lineTo(colRX + colRW - 14, ey + 2).lineWidth(0.5).strokeColor('rgba(255,255,255,0.08)').stroke()
  const pEsp = d.especiais.max ? Math.round((d.especiais.earned / d.especiais.max) * 100) : 0
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text('SUBTOTAL ESPECIAIS', colRX + 14, ey + 10, { lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GOLD)
    .text(`${d.especiais.earned} / ${d.especiais.max} pts (${pEsp}%)`, colRX + 14, ey + 10, { width: colRW - 28, align: 'right' })

  y = panelTop + Math.max(panelLH, panelR1H + panelR2H + 10) + 14

  // ── Gráfico de evolução ──
  const chartH = 165
  doc.roundedRect(ML, y, CW, chartH, 8).fill(CARD)
  doc.rect(ML, y, CW, 2).fill(ACCENT)
  let cy = y + 20
  doc.rect(ML + 14, cy, 6, 6).fill(ACCENT)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text('EVOLUÇÃO DIÁRIA DE PONTOS', ML + 26, cy - 2)

  const porDia = new Map<string, number>()
  let acc = 0
  const ordemDias: string[] = []
  const exatosPorDia = new Set<string>()
  for (const j of d.jogos) {
    acc += j.pontos
    if (!porDia.has(j.data)) ordemDias.push(j.data)
    porDia.set(j.data, acc)
    if (j.placar_palpite_a !== null && j.placar_palpite_a === j.placar_real_a && j.placar_palpite_b === j.placar_real_b) {
      exatosPorDia.add(j.data)
    }
  }
  const serie = ordemDias.map(dd => ({ data: dd, valor: porDia.get(dd)! }))
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text(`${fmtData(serie[0].data)} - ${fmtData(serie[serie.length - 1].data)}`, ML, cy - 2, { width: CW - 28, align: 'right' })

  const plotX0 = ML + 20, plotX1 = ML + CW - 50
  const plotY0 = y + chartH - 24, plotY1 = cy + 34
  const maxV = Math.max(...serie.map(s => s.valor))
  const n = serie.length
  const px = (i: number) => plotX0 + ((plotX1 - plotX0) * i) / (n - 1)
  const pyy = (v: number) => plotY0 - ((plotY0 - plotY1) * v) / maxV

  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    const yy = plotY0 - (plotY0 - plotY1) * frac
    doc.moveTo(plotX0, yy).lineTo(plotX1, yy).lineWidth(0.5).strokeColor('rgba(255,255,255,0.05)').stroke()
    doc.font('Helvetica').fontSize(6.5).fillColor(MUTED2).text(String(Math.round(maxV * frac)), plotX1 + 4, yy - 3, { lineBreak: false })
  }

  doc.moveTo(px(0), pyy(serie[0].valor))
  for (let i = 1; i < n; i++) doc.lineTo(px(i), pyy(serie[i].valor))
  doc.lineWidth(1.6).strokeColor(ACCENT).stroke()

  for (let i = 0; i < n; i++) {
    if (exatosPorDia.has(serie[i].data)) {
      doc.circle(px(i), pyy(serie[i].valor), 2.6).fill(GOLD)
    }
  }
  doc.circle(px(n - 1), pyy(serie[n - 1].valor), 3).fill(GREEN)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
    .text(`${serie[n - 1].valor} pts`, plotX0, pyy(serie[n - 1].valor) - 16, { width: plotX1 - plotX0, align: 'right' })

  y += chartH + 14

  // ── Tiles de destaque ──
  const tilesH = 60
  const tileW = (CW - 2 * 10) / 3
  const tiles: [string, string, string][] = [
    [String(d.exatosTotal), 'ACERTOS EXATOS', GREEN],
    [String(d.parciaisTotal), 'ACERTOS PARCIAIS', ACCENT],
    [d.maiorJogo ? `${d.maiorJogo.pontos} pts` : '—', 'MAIOR PONTUAÇÃO (1 JOGO)', GOLD],
  ]
  tiles.forEach(([val, label, color], i) => {
    const tx = ML + i * (tileW + 10)
    doc.roundedRect(tx, y, tileW, tilesH, 8).fill(CARD)
    doc.font('Helvetica-Bold').fontSize(19).fillColor(color).text(val, tx, y + 12, { width: tileW, align: 'center' })
    doc.font('Helvetica-Bold').fontSize(7.2).fillColor(MUTED).text(label, tx, y + 38, { width: tileW, align: 'center' })
  })

  y += tilesH + 16

  // ── Narrativa ──
  doc.font('Helvetica').fontSize(8.8).fillColor('rgba(255,255,255,0.75)')
    .text(gerarNarrativa(d), ML, y, { width: CW, lineGap: 2.5 })

  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED2)
    .text('Bolão Copa 2026 · gerado automaticamente', ML, PAGE_H - 26, { width: CW, align: 'center' })
}

// ── Extrato completo (páginas seguintes) ────────────────────────────────────
const COL_W = [22, 42, 34, 190, 60, 86, 34, 58]
const COL_X: number[] = []
{
  let acc = ML
  for (const w of COL_W) { COL_X.push(acc); acc += w }
}
const HEADERS = ['#', 'Data', 'Fase', 'Confronto', 'Apostou', 'Resultado', 'Pts', 'Acumulado']

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.rect(ML, y, CW, 20).fill(CARD)
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED)
  HEADERS.forEach((h, i) => {
    const align = i === 0 ? 'center' : i <= 2 ? 'center' : i >= 4 ? 'center' : 'left'
    doc.text(h, COL_X[i] + 4, y + 6, { width: COL_W[i] - 8, align: align as 'center' | 'left' })
  })
  doc.moveTo(ML, y + 20).lineTo(PAGE_W - MR, y + 20).lineWidth(0.75).strokeColor(BORDER).stroke()
  return y + 20
}

function drawPageHeaderExtrato(doc: PDFKit.PDFDocument, d: RelatorioData, pageNum: number) {
  pageChrome(doc)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(ACCENT_L).text('BOLÃO COPA 2026 · EXTRATO DE JOGOS', ML, 20)
  doc.font('Helvetica-Bold').fontSize(15).fillColor(WHITE).text(d.palpiteNome, ML, 33)
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(`${d.usuarioNome} · todos os 104 jogos, na ordem cronológica`, ML, 51)
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED2)
    .text(`Bolão Copa 2026 · Extrato de Jogos · ${d.palpiteNome} · página ${pageNum}`, ML, PAGE_H - 20, { width: CW, align: 'center' })
}

type Row = { kind: 'normal' | 'subtotal' | 'total'; cells: string[] }

function montarLinhasExtrato(d: RelatorioData): Row[] {
  const rows: Row[] = []
  let acumulado = 0
  let faseAtual: string | null = null
  let subtotalFase = 0

  function flush(fase: string | null) {
    if (fase === null) return
    rows.push({ kind: 'subtotal', cells: ['', '', '', `Subtotal — ${FASE_LABEL[fase]}`, '', '', (subtotalFase >= 0 ? '+' : '') + subtotalFase, String(acumulado)] })
    subtotalFase = 0
  }

  for (const j of d.jogos) {
    if (j.fase !== faseAtual) { flush(faseAtual); faseAtual = j.fase }
    const aposta = j.placar_palpite_a !== null ? `${j.placar_palpite_a}x${j.placar_palpite_b}` : '—'
    let real = `${j.placar_real_a}x${j.placar_real_b}`
    if (j.placar_penalti_a !== null && j.placar_penalti_b !== null) {
      const vencedorPen = j.placar_penalti_a > j.placar_penalti_b ? j.time_a : j.time_b
      real += ` (pên: ${vencedorPen})`
    }
    acumulado += j.pontos
    subtotalFase += j.pontos
    rows.push({
      kind: 'normal',
      cells: [String(j.numero_jogo), fmtData(j.data), j.fase, `${j.time_a} x ${j.time_b}`, aposta, real, j.pontos ? `+${j.pontos}` : '0', String(acumulado)],
    })
  }
  flush(faseAtual)

  rows.push({ kind: 'subtotal', cells: ['', '', '', 'Palpites Especiais', '', '', `+${d.especiais.earned}`, String(acumulado + d.especiais.earned)] })
  acumulado += d.especiais.earned
  rows.push({ kind: 'subtotal', cells: ['', '', '', 'Bônus Classificação de Grupos', '', '', `+${d.classif.earned}`, String(acumulado + d.classif.earned)] })
  acumulado += d.classif.earned
  rows.push({ kind: 'total', cells: ['', '', '', 'TOTAL GERAL (BOLÃO)', '', '', '', String(acumulado)] })

  return rows
}

function drawExtratoPages(doc: PDFKit.PDFDocument, d: RelatorioData) {
  const rows = montarLinhasExtrato(d)
  const ROW_H = 15.5
  const TOP = 76
  const BOTTOM_LIMIT = PAGE_H - 30

  let pageNum = 1
  doc.addPage({ size: 'A4', margin: 0 })
  drawPageHeaderExtrato(doc, d, pageNum)
  let y = drawTableHeader(doc, TOP)

  for (const row of rows) {
    if (y + ROW_H > BOTTOM_LIMIT) {
      pageNum++
      doc.addPage({ size: 'A4', margin: 0 })
      drawPageHeaderExtrato(doc, d, pageNum)
      y = drawTableHeader(doc, TOP)
    }

    if (row.kind === 'subtotal') {
      doc.rect(ML, y, CW, ROW_H).fill('rgba(74,144,217,0.14)')
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(ACCENT_L)
    } else if (row.kind === 'total') {
      doc.rect(ML, y, CW, ROW_H).fill('rgba(74,222,128,0.14)')
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
    } else {
      doc.font('Helvetica').fontSize(7.6).fillColor('rgba(255,255,255,0.85)')
    }

    const cells = row.cells
    if (row.kind !== 'normal') {
      // label ocupa colunas 0–3 mescladas
      doc.text(cells[3], COL_X[0] + 4, y + 4, { width: COL_W[0] + COL_W[1] + COL_W[2] + COL_W[3] - 8 })
      doc.text(cells[6], COL_X[6] + 4, y + 4, { width: COL_W[6] - 8, align: 'center' })
      doc.text(cells[7], COL_X[7] + 4, y + 4, { width: COL_W[7] - 8, align: 'right' })
    } else {
      doc.text(cells[0], COL_X[0] + 4, y + 4, { width: COL_W[0] - 8, align: 'center' })
      doc.text(cells[1], COL_X[1] + 4, y + 4, { width: COL_W[1] - 8, align: 'center' })
      doc.text(cells[2], COL_X[2] + 4, y + 4, { width: COL_W[2] - 8, align: 'center' })
      doc.text(cells[3], COL_X[3] + 4, y + 4, { width: COL_W[3] - 8, lineBreak: false })
      doc.text(cells[4], COL_X[4] + 4, y + 4, { width: COL_W[4] - 8, align: 'center' })
      doc.text(cells[5], COL_X[5] + 4, y + 4, { width: COL_W[5] - 8, align: 'center', lineBreak: false })
      doc.text(cells[6], COL_X[6] + 4, y + 4, { width: COL_W[6] - 8, align: 'center' })
      doc.text(cells[7], COL_X[7] + 4, y + 4, { width: COL_W[7] - 8, align: 'right' })
    }
    doc.moveTo(ML, y + ROW_H).lineTo(PAGE_W - MR, y + ROW_H).lineWidth(0.4).strokeColor('rgba(255,255,255,0.05)').stroke()
    y += ROW_H
  }
}

// ── Entrada pública ──────────────────────────────────────────────────────────
export async function gerarRelatorioPdf(palpiteId: number): Promise<Buffer> {
  const dados = await coletarDados(palpiteId)

  const doc = patchRgbaColors(new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false }))
  const chunks: Buffer[] = []
  doc.on('data', c => chunks.push(c))
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))))

  doc.addPage({ size: 'A4', margin: 0 })
  drawPagina1(doc, dados)
  drawExtratoPages(doc, dados)

  doc.end()
  return done
}
