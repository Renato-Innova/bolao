'use client'

import React, { useState, useEffect, useRef } from 'react'
import { FlagImg } from '@/components/ui/FlagImg'
import { PalpiteAvatar } from '@/components/ui/PalpiteAvatar'
import { AvatarPicker } from '@/components/ui/AvatarPicker'
import { createClient } from '@/lib/supabase/client'
import { PIX_VALOR, PIX_CHAVE, GRUPOS, TEAM_ABBR, FASES, TEAM_QUAL, ALL_TEAMS, ARTILHEIRO_OPTIONS, GOLEIRO_OPTIONS, getConfrontoHistorico } from '@/utils/constants'
import type { Palpite, JogoCopa, PalpiteJogo } from '@/types'

/* ─── helpers ──────────────────────────────────────────────── */

const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const WEEKDAYS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']

function getMatchTime(date: string, horario: string): Date {
  return new Date(`${date}T${horario.slice(0, 5)}:00-03:00`)
}
function isLocked(date: string, horario: string) {
  return new Date() >= getMatchTime(date, horario)
}
function canEditWithLock(date: string, horario: string, minutosLock: number) {
  return new Date() < new Date(getMatchTime(date, horario).getTime() - minutosLock * 60 * 1000)
}

interface DayGroup {
  dayNum: number
  date: string
  label: string
  labelShort: string
  matches: JogoCopa[]
}

function groupByDay(matches: JogoCopa[]): DayGroup[] {
  const map: Record<string, JogoCopa[]> = {}
  for (const m of matches) {
    if (!map[m.data]) map[m.data] = []
    map[m.data].push(m)
  }
  return Object.keys(map).sort().map((date, i) => {
    const d = new Date(date + 'T12:00:00')
    return {
      dayNum: i + 1,
      date,
      label: `${d.getDate()} de ${MONTHS[d.getMonth()]} · ${WEEKDAYS[d.getDay()]}`,
      labelShort: `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`,
      matches: map[date],
    }
  })
}

function abbr(name: string): string {
  return TEAM_ABBR[name] ?? name.replace(/\s+/g, '').slice(0, 3).toUpperCase()
}



/* ─── match state ───────────────────────────────────────────── */

interface MatchState {
  scoreA: number
  scoreB: number
  penaltiA: number   // KO only — used when scoreA === scoreB
  penaltiB: number
  submitted: boolean
  submittedAt: string | null
  saving: boolean
  error: string | null
}

function initStates(pjs: PalpiteJogo[]): Record<string, MatchState> {
  const out: Record<string, MatchState> = {}
  for (const pj of pjs) {
    out[String(pj.jogo_id)] = {
      // Use -1 as "not entered" sentinel — displayed as '—' in the UI
      scoreA:    pj.placar_palpite_a ?? -1,
      scoreB:    pj.placar_palpite_b ?? -1,
      penaltiA:  pj.placar_penalti_a ?? 0,
      penaltiB:  pj.placar_penalti_b ?? 0,
      submitted: !!pj.submitted_at,
      submittedAt: pj.submitted_at ?? null,
      saving: false,
      error: null,
    }
  }
  return out
}

/* ─── KO team helpers ────────────────────────────────────────── */

// Returns true when the team slot in jogos_copa has not yet been filled
// by the admin (still holds a bracket placeholder).
function isPlaceholder(name: string): boolean {
  return /^\d+º Grupo [A-L]$/.test(name) ||
         /^Melhor 3º/.test(name) ||
         name.startsWith('Vencedor') ||
         name.startsWith('Perdedor')
}

/* ─── main component ─────────────────────────────────────────── */

interface Props {
  userId: string
  userName: string
  palpitesIniciais: Palpite[]
  todosJogos: JogoCopa[]
  scoringConfigs: { fase: string; tipo_acerto: string; pontos: number }[]
  especiaisDeadline?: string | null   // ISO — prazo para editar palpites especiais
  novoPalpiteDeadline?: string | null // ISO — prazo para criar novo palpite
  minutosLockJogo?: number            // minutos antes do jogo para travar edição
}

const VISIBLE = 3

export function PalpitesClient({ userId, userName, palpitesIniciais, todosJogos, scoringConfigs, especiaisDeadline, novoPalpiteDeadline, minutosLockJogo = 60 }: Props) {
  const supabase = createClient()

  /* ─── deadline flags (recalculated on each render — lightweight) ─── */
  const especiaisLocked    = especiaisDeadline    ? new Date() >= new Date(especiaisDeadline)    : false
  const novoPalpiteLocked  = novoPalpiteDeadline  ? new Date() >= new Date(novoPalpiteDeadline)  : false

  /* core */
  const [palpites, setPalpites] = useState<Palpite[]>(palpitesIniciais)
  const [selectedId, setSelectedId] = useState<number | null>(palpitesIniciais[0]?.id ?? null)

  /* create */
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [criarError, setCriarError] = useState('')
  const [showNovo, setShowNovo] = useState(false)

  /* pix */
  const [showPix, setShowPix] = useState(false)

  /* delete menu */
  const [cardMenuOpen,  setCardMenuOpen]  = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const cardMenuRef = useRef<HTMLDivElement>(null)

  /* rename */
  const [renameId,    setRenameId]    = useState<number | null>(null)
  const [renameNome,  setRenameNome]  = useState('')
  const [renameSaving,setRenameSaving]= useState(false)
  const [renameError, setRenameError] = useState('')

  /* cascade edit modal */
  const [cascadeModal, setCascadeModal] = useState<{
    jogoId: string
    affectedCount: number
    affectedPhases: string[]
    confirming: boolean
  } | null>(null)

  /* match editing */
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({})
  const [visibleDays, setVisibleDays] = useState(1)
  const [campeao, setCampeao] = useState('')
  const [viceCampeao, setViceCampeao] = useState('')
  const [artilheiro, setArtilheiro] = useState('')
  const [melhorJogador, setMelhorJogador] = useState('')
  const [melhorGoleiro, setMelhorGoleiro] = useState('')
  const [specialSaving, setSpecialSaving] = useState(false)
  const [specialSaved,  setSpecialSaved]  = useState(false)
  const [specialError,  setSpecialError]  = useState('')
  const [accOpen, setAccOpen] = useState<Record<string, boolean>>({})

  /* tabs */
  const [activeTab, setActiveTab] = useState(0)
  const [mataMataSubTab, setMataMataSubTab] = useState(0)  // 0=list, 1=chave
  const [phaseSectionOpen, setPhaseSectionOpen] = useState<Record<string, boolean>>({})
  const [chaveView, setChaveView] = useState<'oficial' | 'palpite'>('oficial')
  const [chavePillIdx, setChavePillIdx] = useState(0)   // mobile: active bracket column index
  const chaveOuterRef = useRef<HTMLDivElement>(null)
  const chaveTrackRef = useRef<HTMLDivElement>(null)

  /* avatar picker */
  const [avatarPickerId, setAvatarPickerId] = useState<number | null>(null)
  const [avatarSaving,   setAvatarSaving]   = useState(false)

  /* carousel */
  const [carOffset, setCarOffset] = useState(0)   // desktop: first visible index
  const [mobileIdx, setMobileIdx] = useState(0)   // mobile: current index
  const mobileOuterRef = useRef<HTMLDivElement>(null)
  const mobileTrackRef = useRef<HTMLDivElement>(null)
  const touchStartXRef = useRef(0)

  /* derived */
  const selected = palpites.find(p => p.id === selectedId)
  const jogosGS = todosJogos.filter(j => j.fase === 'GS')
  const jogosKO = todosJogos.filter(j => j.fase !== 'GS')

  // Lookup pontos for a given game in the selected palpite
  function getPontos(jogoId: number): number | null {
    return selected?.palpites_jogos?.find(pj => pj.jogo_id === jogoId)?.pontos ?? null
  }
  const days = groupByDay(jogosGS)
  const carItems = [...palpites, 'new' as const]
  const totalCards = carItems.length
  const selIdx = palpites.findIndex(p => p.id === selectedId)
  const totalJogos = todosJogos.length  // all 104 for progress bar
  const nextDay = days[visibleDays]
  const hasMore = visibleDays < days.length

  /* ─── effects ─────────────────────────────────────────────── */

  useEffect(() => {
    // Don't reset the active tab — user stays where they were when switching palpites
    setMataMataSubTab(0)
    setPhaseSectionOpen({})
    const palpite = palpites.find(p => p.id === selectedId)
    if (palpite?.palpites_jogos) {
      const states = initStates(palpite.palpites_jogos)
      setMatchStates(states)
      setCampeao(palpite.campeao ?? '')
      setViceCampeao(palpite.vice_campeao ?? '')
      setArtilheiro(palpite.artilheiro ?? '')
      setMelhorJogador(palpite.melhor_jogador ?? '')
      setMelhorGoleiro(palpite.melhor_goleiro ?? '')
      const dayGroups = groupByDay(jogosGS)
      let targetDay = 1
      for (let i = 0; i < dayGroups.length; i++) {
        if (dayGroups[i].matches.some(m => !states[String(m.id)]?.submitted)) { targetDay = i + 1; break }
      }
      setVisibleDays(targetDay)
    } else {
      setMatchStates({})
      setCampeao('')
      setViceCampeao('')
      setArtilheiro('')
      setMelhorJogador('')
      setMelhorGoleiro('')
      setVisibleDays(1)
    }
    setAccOpen({})
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync carousel position when selection changes
  useEffect(() => {
    const idx = palpites.findIndex(p => p.id === selectedId)
    if (idx < 0) return
    if (idx < carOffset) setCarOffset(idx)
    else if (idx >= carOffset + VISIBLE) setCarOffset(Math.max(0, idx - VISIBLE + 1))
    setMobileIdx(idx)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply mobile carousel transform
  useEffect(() => {
    const outer = mobileOuterRef.current
    const track = mobileTrackRef.current
    if (!outer || !track) return
    // card = outer - 20px wide, gap = 10px → step = outer - 20 + 10 = outer - 10
    const step = outer.offsetWidth - 10
    track.style.transform = `translateX(-${mobileIdx * step}px)`
  }, [mobileIdx])

  // Click-outside for card delete menu
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) setCardMenuOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ─── carousel handlers ────────────────────────────────────── */

  function selectCard(idx: number) {
    if (idx >= palpites.length) { setShowNovo(true); return }
    const p = palpites[idx]
    if (!p) return
    setSelectedId(p.id)
    if (idx < carOffset) setCarOffset(idx)
    else if (idx >= carOffset + VISIBLE) setCarOffset(Math.max(0, idx - VISIBLE + 1))
    setMobileIdx(idx)
  }

  function onTouchStart(e: React.TouchEvent) { touchStartXRef.current = e.touches[0].clientX }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartXRef.current
    if (Math.abs(dx) > 40) {
      const newIdx = Math.max(0, Math.min(mobileIdx + (dx < 0 ? 1 : -1), carItems.length - 1))
      setMobileIdx(newIdx)
      if (newIdx < palpites.length) setSelectedId(palpites[newIdx].id)
    }
  }

  /* ─── other handlers ───────────────────────────────────────── */

  function updateState(jogoId: string, patch: Partial<MatchState>) {
    setMatchStates(prev => ({
      ...prev,
      [jogoId]: { ...(prev[jogoId] ?? DEFAULT_MATCH_STATE), ...patch },
    }))
  }

  function toggleAcc(date: string) {
    setAccOpen(prev => ({ ...prev, [date]: !prev[date] }))
  }

  async function deletePalpite(id: number) {
    setDeleting(true)
    const res = await fetch(`/api/palpites/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) return
    setConfirmDelete(null)
    setCardMenuOpen(null)
    setPalpites(prev => {
      const next = prev.filter(p => p.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  // Normaliza nome para comparação: minúsculo + remove acentos + ç→c
  // "João" === "joao" === "JOAO", "Cangaço" === "cangaco"
  function normalizarNome(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')                      // decompõe letras acentuadas (ã → a + combining)
      .replace(/[̀-ͯ]/g, '')       // remove os diacríticos (combining marks)
      .replace(/[^a-z0-9\s]/g, '')          // remove qualquer outro caractere especial restante
      .replace(/\s+/g, ' ')                 // colapsa espaços múltiplos
      .trim()
  }

  async function saveAvatar(palpiteId: number, type: string, value: string) {
    setAvatarSaving(true)
    try {
      const res = await fetch(`/api/palpites/${palpiteId}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarType: type, avatarValue: value }),
      })
      if (res.ok) {
        setPalpites(prev => prev.map(p =>
          p.id === palpiteId ? { ...p, avatar_type: type, avatar_value: value } : p
        ))
      }
    } finally {
      setAvatarSaving(false)
      setAvatarPickerId(null)
    }
  }

  async function checarDuplicidadeNome(nomeTrimmed: string, ignorarId?: number): Promise<boolean> {
    // Busca todos os nomes e compara normalizados — única forma confiável com acentos/ç
    const { data: todos } = await supabase.from('palpites').select('id, nome')
    if (!todos) return false
    const chave = normalizarNome(nomeTrimmed)
    return todos.some(p => p.id !== ignorarId && normalizarNome(p.nome) === chave)
  }

  async function criarPalpite() {
    if (!novoNome.trim()) return
    if (novoPalpiteLocked) { setCriarError('Prazo para criação de novos palpites encerrado.'); return }
    setCriando(true); setCriarError('')

    const nomeTrimmed = novoNome.trim()

    // Checa duplicidade normalizando acentos, ç, maiúsculas/minúsculas
    const duplicado = await checarDuplicidadeNome(nomeTrimmed)
    if (duplicado) {
      setCriarError(`❌ O nome "${nomeTrimmed}" já está em uso (ou é muito similar a um existente). Escolha outro.`)
      setCriando(false)
      return
    }

    const { data: p, error: insertError } = await supabase
      .from('palpites')
      .insert({ usuario_id: userId, nome: nomeTrimmed, status: 'inativo', artilheiro: '' })
      .select().single()
    if (insertError || !p) {
      // Catch the rare race-condition where two users submit the same name simultaneously
      const isDuplicate = insertError?.code === '23505'
      setCriarError(isDuplicate
        ? `❌ O nome "${nomeTrimmed}" acabou de ser registrado por outro participante. Escolha um nome diferente.`
        : (insertError?.message ?? 'Erro ao criar palpite. Tente novamente.'))
      setCriando(false); return
    }
    if (todosJogos.length > 0) {
      const rows = todosJogos.map(j => ({ palpite_id: p.id, jogo_id: j.id, pontos: 0 }))
      await supabase.from('palpites_jogos').insert(rows)
    }
    const { data: full } = await supabase
      .from('palpites')
      .select('*, palpites_jogos(*, jogo:jogos_copa(*, resultado:resultados(*)))')
      .eq('id', p.id).single()
    if (full) { setPalpites(prev => [full as Palpite, ...prev]); setSelectedId(full.id) }
    setNovoNome(''); setShowNovo(false); setCriando(false)
  }

  async function renamePalpite() {
    if (!renameId) return
    const nomeTrimmed = renameNome.trim()
    if (!nomeTrimmed) { setRenameError('O nome não pode ser vazio.'); return }
    setRenameSaving(true); setRenameError('')

    // Se o nome normalizado não mudou, fecha sem chamar o DB
    const current = palpites.find(p => p.id === renameId)
    if (current && normalizarNome(current.nome) === normalizarNome(nomeTrimmed)) {
      setRenameId(null); setRenameSaving(false); return
    }

    // Checa duplicidade global normalizando acentos, ç, case — ignora o próprio palpite
    const duplicado = await checarDuplicidadeNome(nomeTrimmed, renameId)
    if (duplicado) {
      setRenameError('Este nome já está em uso (ou é muito similar). Escolha outro.')
      setRenameSaving(false)
      return
    }

    const { error } = await supabase
      .from('palpites')
      .update({ nome: nomeTrimmed })
      .eq('id', renameId)

    if (error) {
      // 23505 = unique_violation race condition
      setRenameError(error.code === '23505' ? 'Nome já em uso (conflito). Tente outro.' : 'Erro ao salvar.')
    } else {
      setPalpites(prev => prev.map(p => p.id === renameId ? { ...p, nome: nomeTrimmed } : p))
      setRenameId(null)
    }
    setRenameSaving(false)
  }

  // Keeps palpites.palpites_jogos in sync so TabelaDoPalpite re-renders
  // immediately without a page reload whenever a match is submitted or cleared.
  function syncPalpiteJogo(
    jogoId: string,
    patch: { placar_a?: number; placar_b?: number; penalti_a?: number | null; penalti_b?: number | null; submitted_at: string | null }
  ) {
    if (!selectedId) return
    const jogoIdNum = parseInt(jogoId, 10)
    setPalpites(prev => prev.map(p => {
      if (p.id !== selectedId) return p
      const pjs = p.palpites_jogos ?? []
      const exists = pjs.some(pj => pj.jogo_id === jogoIdNum)
      const updated = exists
        ? pjs.map(pj => pj.jogo_id !== jogoIdNum ? pj : {
            ...pj,
            placar_palpite_a: patch.placar_a ?? pj.placar_palpite_a,
            placar_palpite_b: patch.placar_b ?? pj.placar_palpite_b,
            placar_penalti_a: patch.penalti_a !== undefined ? patch.penalti_a : pj.placar_penalti_a,
            placar_penalti_b: patch.penalti_b !== undefined ? patch.penalti_b : pj.placar_penalti_b,
            submitted_at: patch.submitted_at,
          })
        : [...pjs, {
            id: 0, palpite_id: selectedId, jogo_id: jogoIdNum,
            placar_palpite_a: patch.placar_a ?? 0,
            placar_palpite_b: patch.placar_b ?? 0,
            placar_penalti_a: patch.penalti_a ?? null,
            placar_penalti_b: patch.penalti_b ?? null,
            pontos: 0,
            submitted_at: patch.submitted_at,
            criado_em: '', atualizado_em: '',
          }]
      return { ...p, palpites_jogos: updated }
    }))
  }

  async function submitMatch(jogoId: string) {
    const st = matchStates[jogoId]
    if (!st || !selectedId) return
    updateState(jogoId, { saving: true, error: null })

    const jogo = todosJogos.find(j => j.id === parseInt(jogoId, 10))
    const isKO = jogo?.fase !== 'GS'
    const isDraw = st.scoreA === st.scoreB
    const penaltiA = isKO && isDraw ? st.penaltiA : null
    const penaltiB = isKO && isDraw ? st.penaltiB : null

    // Use the API route so points are calculated immediately if the official
    // result is already in the database (e.g. late submission or post-edit).
    const res = await fetch(`/api/palpites/${selectedId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jogoId: parseInt(jogoId, 10),
        placarA: st.scoreA, placarB: st.scoreB,
        penaltiA, penaltiB,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Erro ao salvar.' }))
      updateState(jogoId, { saving: false, error: error ?? 'Erro ao salvar. Tente novamente.' })
      return
    }

    const { pontos, submittedAt } = await res.json() as { pontos: number; submittedAt: string }

    updateState(jogoId, { saving: false, submitted: true, submittedAt })

    // Keep the day accordion open after submission so the card stays visible
    const dayDate = days.find(d => d.matches.some(m => String(m.id) === jogoId))?.date
    if (dayDate) setAccOpen(prev => ({ ...prev, [dayDate]: true }))

    // Sync palpites state (points + submitted_at) so the card footer and the
    // TabelaDoPalpite re-render immediately without a page reload.
    syncPalpiteJogo(jogoId, {
      placar_a: st.scoreA, placar_b: st.scoreB,
      penalti_a: penaltiA, penalti_b: penaltiB,
      submitted_at: submittedAt,
    })

    // Update pontos in palpites state so the carousel card score is live
    if (selectedId) {
      setPalpites(prev => prev.map(p => {
        if (p.id !== selectedId) return p
        const pjs = (p.palpites_jogos ?? []).map(pj =>
          pj.jogo_id === parseInt(jogoId, 10) ? { ...pj, pontos } : pj
        )
        return { ...p, palpites_jogos: pjs }
      }))
    }
  }

  async function editMatch(jogoId: string) {
    if (!selectedId) return

    // Collapse the accordion for this day so only pending games remain visible
    const dayDate = days.find(d => d.matches.some(m => String(m.id) === jogoId))?.date
    if (dayDate) setAccOpen(prev => ({ ...prev, [dayDate]: false }))

    const res = await fetch(`/api/palpites/${selectedId}/downstream-impact?jogoId=${jogoId}`)
    if (!res.ok) {
      updateState(jogoId, { submitted: false })
      syncPalpiteJogo(jogoId, { submitted_at: null })
      return
    }
    const { affectedCount, affectedPhases } = await res.json()
    if (affectedCount === 0) {
      updateState(jogoId, { submitted: false })
      syncPalpiteJogo(jogoId, { submitted_at: null })
    } else {
      setCascadeModal({ jogoId, affectedCount, affectedPhases, confirming: false })
    }
  }

  async function confirmCascadeEdit() {
    if (!cascadeModal || !selectedId) return
    setCascadeModal(m => m ? { ...m, confirming: true } : null)
    const res = await fetch(`/api/palpites/${selectedId}/cascade-clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogoId: parseInt(cascadeModal.jogoId, 10) }),
    })
    if (res.ok) {
      const { clearedJogoIds } = await res.json() as { clearedJogoIds: number[] }
      // Clear matchStates
      setMatchStates(prev => {
        const next = { ...prev }
        next[cascadeModal.jogoId] = { ...next[cascadeModal.jogoId], submitted: false }
        for (const id of clearedJogoIds) {
          const key = String(id)
          if (next[key]) next[key] = { ...next[key], submitted: false, submittedAt: null, scoreA: 0, scoreB: 0 }
        }
        return next
      })
      // Sync palpites state so TabelaDoPalpite re-renders immediately
      syncPalpiteJogo(cascadeModal.jogoId, { submitted_at: null })
      for (const id of clearedJogoIds) {
        syncPalpiteJogo(String(id), { submitted_at: null })
      }
    }
    setCascadeModal(null)
  }

  // Saves all three special palpites at once; called whenever any of the three changes
  async function saveSpecialPalpites(
    nextCampeao      = campeao,
    nextViceCampeao  = viceCampeao,
    nextArtilheiro   = artilheiro,
    nextMelhorJogador= melhorJogador,
    nextMelhorGoleiro= melhorGoleiro,
  ) {
    if (!selectedId) return
    // Não salva se campeão e vice forem iguais — preserva configuração anterior
    if (nextCampeao && nextViceCampeao && nextCampeao === nextViceCampeao) return
    setSpecialSaving(true)
    setSpecialError('')

    // Usa API route (service role) para garantir que o RLS não bloqueia silenciosamente
    let res: Response
    try {
      res = await fetch(`/api/palpites/${selectedId}/especiais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campeao:        nextCampeao,
          vice_campeao:   nextViceCampeao,
          artilheiro:     nextArtilheiro,
          melhor_jogador: nextMelhorJogador,
          melhor_goleiro: nextMelhorGoleiro,
        }),
      })
    } catch {
      setSpecialError('Erro de rede. Verifique sua conexão.')
      setSpecialSaving(false)
      return
    }

    if (!res.ok) {
      // Mostra o erro real para diagnóstico
      const body = await res.json().catch(() => ({}))
      setSpecialError(`Erro ${res.status}: ${body.error ?? 'Falha ao salvar'}`)
      setSpecialSaving(false)
      return
    }

    // Sync palpites state so the checklist card reflects the new values immediately
    setPalpites(prev => prev.map(p => p.id === selectedId ? {
      ...p,
      campeao:        nextCampeao,
      vice_campeao:   nextViceCampeao,
      artilheiro:     nextArtilheiro,
      melhor_jogador: nextMelhorJogador,
      melhor_goleiro: nextMelhorGoleiro,
    } : p))
    setSpecialSaving(false)
    setSpecialSaved(true)
    setTimeout(() => setSpecialSaved(false), 2000)
  }

  /* ─── card renderer (shared desktop + mobile) ────────────── */

  function renderCard(p: Palpite, keyPrefix: string, extraStyle?: React.CSSProperties) {
    const isSel = p.id === selectedId
    const isInativo = p.status === 'inativo'
    const isMenuOpen = cardMenuOpen === p.id
    const isConfirming = confirmDelete === p.id
    const pts = p.palpites_jogos?.reduce((s, pj) => s + (pj.pontos ?? 0), 0) ?? 0
    const preenchi = p.palpites_jogos?.filter(pj => pj.submitted_at).length ?? 0
    const pct = totalJogos > 0 ? Math.round((preenchi / totalJogos) * 100) : 0

    // Checklist counts
    const gsTotal   = todosJogos.filter(j => j.fase === 'GS').length
    const koTotal   = todosJogos.filter(j => j.fase !== 'GS').length
    const gsDone    = p.palpites_jogos?.filter(pj => pj.submitted_at && (pj.jogo as JogoCopa | undefined)?.fase === 'GS').length ?? 0
    const koDone    = p.palpites_jogos?.filter(pj => pj.submitted_at && (pj.jogo as JogoCopa | undefined)?.fase !== 'GS').length ?? 0
    const specials  = [p.campeao, p.vice_campeao, p.artilheiro, p.melhor_jogador, p.melhor_goleiro]
    const specDone  = specials.filter(Boolean).length
    const specTotal = specials.length

    type CheckStatus = 'done' | 'partial' | 'empty'
    function status(done: number, total: number): CheckStatus {
      if (total === 0) return 'empty'
      if (done === total) return 'done'
      if (done > 0) return 'partial'
      return 'empty'
    }
    const statusColor: Record<CheckStatus, string> = {
      done:    '#4ade80',
      partial: '#f97316',
      empty:   'rgba(255,255,255,0.2)',
    }
    const statusIcon: Record<CheckStatus, string> = {
      done:    '✓',
      partial: '!',
      empty:   '○',
    }
    const gsStatus  = status(gsDone,    gsTotal)
    const koStatus  = status(koDone,    koTotal)
    const spStatus  = status(specDone,  specTotal)

    return (
      <div key={`${keyPrefix}${p.id}`}
        onClick={() => { if (!isMenuOpen && !isConfirming) setSelectedId(p.id) }}
        style={{
          background: '#0D1E3D', border: `1px solid ${isSel ? '#4A90D9' : 'rgba(74,144,217,0.15)'}`,
          borderRadius: 10, padding: '13px 15px', cursor: 'pointer',
          position: 'relative', overflow: 'visible',
          opacity: isSel ? 1 : 0.65, transition: 'opacity 0.2s, border-color 0.2s',
          flex: extraStyle ? undefined : 1, minWidth: extraStyle ? undefined : 0,
          ...extraStyle,
        }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: '10px 10px 0 0', background: isSel ? 'linear-gradient(90deg,#4A90D9,#7BB8F0)' : 'rgba(74,144,217,0.2)', transition: 'background 0.2s' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <PalpiteAvatar nome={p.nome} avatarType={p.avatar_type} avatarValue={p.avatar_value} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>{userName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.3, background: isInativo ? 'rgba(255,255,255,0.07)' : 'rgba(74,222,128,0.15)', color: isInativo ? 'rgba(255,255,255,0.4)' : '#4ade80' }}>
              {isInativo ? 'Inativo' : 'Ativo'}
            </span>
            <div ref={isMenuOpen ? cardMenuRef : null} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setCardMenuOpen(isMenuOpen ? null : p.id); setConfirmDelete(null); setRenameId(null) }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 14, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>
                ⋮
              </button>
              {isMenuOpen && !isConfirming && (
                <div style={{ position: 'absolute', top: 26, right: 0, background: '#1a2d50', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 8, padding: 4, minWidth: 160, zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                  {/* Avatar */}
                  <div
                    onMouseDown={e => { e.stopPropagation(); setAvatarPickerId(p.id); setCardMenuOpen(null) }}
                    style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,144,217,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    🎨 Escolher avatar
                  </div>
                  {/* Renomear */}
                  <div
                    onMouseDown={e => { e.stopPropagation(); setRenameId(p.id); setRenameNome(p.nome); setRenameError(''); setCardMenuOpen(null) }}
                    style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,144,217,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    ✏️ Renomear
                  </div>
                  {/* Excluir — somente inativos */}
                  {isInativo && (
                    <div
                      onMouseDown={e => { e.stopPropagation(); setConfirmDelete(p.id); setCardMenuOpen(null) }}
                      style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'rgba(255,130,130,0.85)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      🗑 Excluir palpite
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Rename inline input */}
        {renameId === p.id && (
          <div style={{ marginBottom: 8 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={renameNome}
                onChange={e => { setRenameNome(e.target.value); setRenameError('') }}
                onKeyDown={e => { if (e.key === 'Enter') renamePalpite(); if (e.key === 'Escape') setRenameId(null) }}
                maxLength={40}
                placeholder="Novo nome..."
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(74,144,217,0.5)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }}
              />
              <button onClick={renamePalpite} disabled={renameSaving || !renameNome.trim()}
                style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: renameSaving ? 'not-allowed' : 'pointer', flexShrink: 0, fontFamily: 'Inter,sans-serif' }}>
                {renameSaving ? '...' : '✓'}
              </button>
              <button onClick={() => setRenameId(null)}
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0, fontFamily: 'Inter,sans-serif' }}>
                ×
              </button>
            </div>
            {renameError && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,130,130,0.9)', fontWeight: 600 }}>
                ⚠️ {renameError}
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 22, fontWeight: 800, color: isInativo ? 'rgba(255,255,255,0.2)' : '#4A90D9', lineHeight: 1 }}>
          {isInativo ? '—' : pts} <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.50)' }}>pts</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{ height: 3, background: isInativo ? 'rgba(255,255,255,0.15)' : 'linear-gradient(90deg,#4A90D9,#7BB8F0)', borderRadius: 2, width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap' }}>{preenchi}/{totalJogos}</span>
        </div>

        {/* Checklist */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            { icon: '⚽', label: 'Fase de Grupos', done: gsDone,   total: gsTotal,  st: gsStatus },
            { icon: '🌟', label: 'Palpites Especiais', done: specDone, total: specTotal, st: spStatus },
            { icon: '🏆', label: 'Mata-Mata', done: koDone,   total: koTotal,  st: koStatus },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, width: 14, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', flex: 1, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: 600 }}>{item.done}/{item.total}</span>
              <span style={{
                fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: `${statusColor[item.st]}18`,
                color: statusColor[item.st],
                border: `1px solid ${statusColor[item.st]}40`,
              }}>
                {statusIcon[item.st]}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderNewCard(keyPrefix: string, extraStyle?: React.CSSProperties) {
    return (
      <div key={`${keyPrefix}new`} onClick={() => { if (!novoPalpiteLocked) setShowNovo(true) }}
        style={{
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 5,
          minHeight: 90, cursor: 'pointer', opacity: 0.7,
          flex: extraStyle ? undefined : 1, minWidth: extraStyle ? undefined : 0,
          ...extraStyle,
        }}>
        <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.2)' }}>+</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: 500 }}>Criar novo palpite</span>
      </div>
    )
  }

  const activeDot = selIdx >= 0 ? selIdx : palpites.length

  /* ─── render ─────────────────────────────────────────────── */

  return (
    <div className="page-main palpites-main" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 40px' }}>

      {/* Avatar Picker modal */}
      {avatarPickerId !== null && (() => {
        const p = palpites.find(x => x.id === avatarPickerId)
        if (!p) return null
        return (
          <AvatarPicker
            nome={p.nome}
            palpiteId={p.id}
            currentType={p.avatar_type}
            currentValue={p.avatar_value}
            saving={avatarSaving}
            onClose={() => setAvatarPickerId(null)}
            onSave={(type, value) => saveAvatar(avatarPickerId, type, value)}
          />
        )
      })()}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Meus palpites</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Navegue entre seus palpites ou crie um novo</div>
        </div>
        {novoPalpiteLocked ? (
          <div style={{ fontSize: 10, color: 'rgba(255,150,150,0.8)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            🔒 Novos palpites encerrados
          </div>
        ) : (
          <button onClick={() => setShowNovo(true)}
            style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Novo palpite
          </button>
        )}
      </div>

      {/* Create form */}
      {showNovo && (
        <>
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, fontWeight: 600 }}>Nome do palpite</label>
              <input type="text" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Família Pereira..." maxLength={40}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 7, padding: '9px 12px', fontSize: 14, color: 'white', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
            </div>
            <button onClick={criarPalpite} disabled={criando || !novoNome.trim()}
              style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>
              {criando ? 'Criando...' : 'Criar'}
            </button>
            <button onClick={() => { setShowNovo(false); setCriarError('') }}
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: 'none', padding: '10px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>×</button>
          </div>
          {criarError && (
            <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 8, fontSize: 12, color: 'rgba(255,130,130,0.9)' }}>
              {criarError}
            </div>
          )}
        </>
      )}

      {/* ── DESKTOP CAROUSEL ─────────────────────────────────── */}
      <div className="car-desktop" style={{ position: 'relative', padding: '0 18px', marginBottom: 6 }}>
        <button onClick={() => setCarOffset(o => Math.max(0, o - 1))}
          style={{ display: carOffset === 0 ? 'none' : 'flex', position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 4, zIndex: 5, width: 28, height: 28, borderRadius: '50%', background: 'rgba(13,30,61,0.92)', border: '1px solid rgba(74,144,217,0.3)', color: '#7BB8F0', fontSize: 15, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', padding: 0, lineHeight: 1 }}>‹</button>

        <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
          {carItems.map((item, idx) => {
            if (idx < carOffset || idx >= carOffset + VISIBLE) return null
            return item === 'new' ? renderNewCard('d-') : renderCard(item, 'd-')
          })}
          {Array.from({ length: Math.max(0, carOffset + VISIBLE - totalCards) }).map((_, i) => (
            <div key={`fill-${i}`} style={{ flex: 1, minWidth: 0 }} />
          ))}
        </div>

        <button onClick={() => setCarOffset(o => Math.min(o + 1, Math.max(0, totalCards - VISIBLE)))}
          style={{ display: carOffset + VISIBLE >= totalCards ? 'none' : 'flex', position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 4, zIndex: 5, width: 28, height: 28, borderRadius: '50%', background: 'rgba(13,30,61,0.92)', border: '1px solid rgba(74,144,217,0.3)', color: '#7BB8F0', fontSize: 15, cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,sans-serif', padding: 0, lineHeight: 1 }}>›</button>
      </div>

      {/* ── MOBILE CAROUSEL ──────────────────────────────────── */}
      <div className="car-mobile" ref={mobileOuterRef} style={{ overflow: 'hidden', marginBottom: 4, paddingBottom: 4 }}>
        <div ref={mobileTrackRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          style={{ display: 'flex', gap: 10, transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)', willChange: 'transform' }}>
          {carItems.map(item =>
            item === 'new'
              ? renderNewCard('m-', { flexShrink: 0, width: 'calc(100% - 20px)' })
              : renderCard(item, 'm-', { flexShrink: 0, width: 'calc(100% - 20px)' })
          )}
        </div>
      </div>

      {/* ── DOTS ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, margin: '8px 0 16px' }}>
        {carItems.map((_, idx) => (
          <div key={idx} onClick={() => selectCard(idx)} style={{
            width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
            background: idx === activeDot ? '#4A90D9' : 'rgba(255,255,255,0.15)',
            transform: idx === activeDot ? 'scale(1.3)' : 'scale(1)',
            transition: 'background 0.2s, transform 0.2s',
          }} />
        ))}
      </div>

      {/* ── TABS + CONTENT ────────────────────────────────────── */}
      {selected && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 18, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
            {(['Fase de Grupos', 'Palpites Especiais', 'Tabela do Palpite', 'Mata-Mata', 'Pontuação'] as const).map((label, i) => {
              const active = activeTab === i
              return (
                <div key={i} onClick={() => setActiveTab(i)} style={{
                  padding: '10px 20px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  color: active ? 'white' : 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase', letterSpacing: 0.5, userSelect: 'none',
                  cursor: 'pointer',
                  borderBottom: `2px solid ${active ? '#4A90D9' : 'transparent'}`,
                  marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
                }}>
                  {label}
                </div>
              )
            })}
          </div>

          {/* Tab 1: Fase de Grupos */}
          {activeTab === 0 && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
                  <button
                    onClick={() => {
                      const open: Record<string, boolean> = {}
                      days.slice(0, visibleDays).forEach(g => { open[g.date] = true })
                      setAccOpen(open)
                    }}
                    style={{ background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', color: '#7BB8F0', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                    Expandir todos
                  </button>
                  <button
                    onClick={() => setAccOpen({})}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                    Recolher todos
                  </button>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Jogos em ordem cronológica — envie cada placar individualmente
                </div>
              </div>

              {days.slice(0, visibleDays).map(group => {
                const submitted = group.matches.filter(m => matchStates[String(m.id)]?.submitted)
                const pending   = group.matches.filter(m => !matchStates[String(m.id)]?.submitted)
                const allDone   = pending.length === 0
                const hasSome   = submitted.length > 0
                const isOpen    = !!accOpen[group.date]
                const green  = { border: 'rgba(74,222,128,0.25)', bg: 'rgba(74,222,128,0.04)', line: 'rgba(74,222,128,0.15)', chevron: 'rgba(74,222,128,0.7)' }
                const orange = { border: 'rgba(249,115,22,0.35)',  bg: 'rgba(249,115,22,0.04)',  line: 'rgba(249,115,22,0.2)',  chevron: 'rgba(249,115,22,0.8)' }
                const col = allDone ? green : orange
                return (
                  <div key={group.date} style={{ marginBottom: 22 }}>
                    {!hasSome && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Dia {group.dayNum}</span>
                          <span className="day-date-full" style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap' }}>{group.label}</span>
                          <span className="day-date-short" style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap', display: 'none' }}>{group.labelShort}</span>
                          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap' }}>{group.matches.length} jogos</span>
                        </div>
                        <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                          {group.matches.map(jogo => (
                            <MatchCard key={jogo.id} jogo={jogo}
                              state={matchStates[String(jogo.id)] ?? DEFAULT_MATCH_STATE}
                              onScoreChange={(side, val) => !matchStates[String(jogo.id)]?.submitted && updateState(String(jogo.id), side === 'A' ? { scoreA: val } : { scoreB: val })}
                              onSubmit={() => submitMatch(String(jogo.id))} onEdit={() => editMatch(String(jogo.id))}
                              pontos={getPontos(jogo.id)} minutosLock={minutosLockJogo} />
                          ))}
                        </div>
                      </>
                    )}
                    {allDone && hasSome && (
                      <Accordion isOpen={isOpen} onToggle={() => toggleAcc(group.date)} dayNum={group.dayNum} label={group.label} labelShort={group.labelShort} sentCount={submitted.length} pendingCount={0} col={green}
                        dayPts={submitted.some(j => j.resultado) ? submitted.reduce((s, j) => s + (getPontos(j.id) ?? 0), 0) : null}>
                        <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 2 }}>
                          {submitted.map(jogo => (
                            <MatchCard key={jogo.id} jogo={jogo} state={matchStates[String(jogo.id)]}
                              onScoreChange={(side, val) => updateState(String(jogo.id), side === 'A' ? { scoreA: val } : { scoreB: val })}
                              onSubmit={() => submitMatch(String(jogo.id))} onEdit={() => editMatch(String(jogo.id))}
                              pontos={getPontos(jogo.id)} minutosLock={minutosLockJogo} />
                          ))}
                        </div>
                      </Accordion>
                    )}
                    {hasSome && !allDone && (
                      <>
                        <Accordion isOpen={isOpen} onToggle={() => toggleAcc(group.date)} dayNum={group.dayNum} label={group.label} labelShort={group.labelShort} sentCount={submitted.length} pendingCount={pending.length} col={col}
                          dayPts={submitted.some(j => j.resultado) ? submitted.reduce((s, j) => s + (getPontos(j.id) ?? 0), 0) : null}>
                          <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 2 }}>
                            {submitted.map(jogo => (
                              <MatchCard key={jogo.id} jogo={jogo} state={matchStates[String(jogo.id)]}
                                onScoreChange={(side, val) => updateState(String(jogo.id), side === 'A' ? { scoreA: val } : { scoreB: val })}
                                onSubmit={() => submitMatch(String(jogo.id))} onEdit={() => editMatch(String(jogo.id))}
                                pontos={getPontos(jogo.id)} minutosLock={minutosLockJogo} />
                            ))}
                          </div>
                        </Accordion>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.7, margin: '8px 0 8px 2px' }}>⏳ Aguardando palpite</div>
                        <div className="match-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                          {pending.map(jogo => (
                            <MatchCard key={jogo.id} jogo={jogo}
                              state={matchStates[String(jogo.id)] ?? DEFAULT_MATCH_STATE}
                              onScoreChange={(side, val) => !matchStates[String(jogo.id)]?.submitted && updateState(String(jogo.id), side === 'A' ? { scoreA: val } : { scoreB: val })}
                              onSubmit={() => submitMatch(String(jogo.id))} onEdit={() => editMatch(String(jogo.id))}
                              pontos={getPontos(jogo.id)} minutosLock={minutosLockJogo} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {hasMore && nextDay && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, margin: '4px 0 20px' }}>
                  <button onClick={() => setVisibleDays(v => v + 1)}
                    style={{ background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', color: '#7BB8F0', padding: '10px 28px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5, width: '100%' }}>
                    Carregar próximo dia →
                  </button>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)' }}>
                    Dia {nextDay.dayNum} · {nextDay.label} · {nextDay.matches.length} jogos
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab 3: Tabela do Palpite */}
          {activeTab === 2 && <TabelaDoPalpite palpite={selected} todosJogos={todosJogos} />}

          {/* Tab 4: Mata-Mata */}
          {activeTab === 3 && (
            <MataMataTab
              selected={selected}
              jogosKO={jogosKO}
              jogosGS={jogosGS}
              matchStates={matchStates}
              updateState={updateState}
              submitMatch={submitMatch}
              editMatch={editMatch}
              phaseSectionOpen={phaseSectionOpen}
              setPhaseSectionOpen={setPhaseSectionOpen}
              mataMataSubTab={mataMataSubTab}
              setMataMataSubTab={setMataMataSubTab}
              chaveView={chaveView}
              setChaveView={setChaveView}
              chavePillIdx={chavePillIdx}
              setChavePillIdx={setChavePillIdx}
              chaveOuterRef={chaveOuterRef}
              chaveTrackRef={chaveTrackRef}
              minutosLock={minutosLockJogo}
            />
          )}

          {/* Tab 2: Palpites Especiais */}
          {activeTab === 1 && (
            <div style={{ maxWidth: 480 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Palpites especiais
                </div>
                {specialSaving && <span style={{ fontSize: 10, color: '#4A90D9' }}>● Salvando…</span>}
                {!specialSaving && specialSaved && <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>✓ Salvo</span>}
                {!specialSaving && !specialSaved && !especiaisLocked && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Auto-salva ao selecionar</span>}
              </div>
              {especiaisLocked ? (
                <div style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,100,100,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: 'rgba(255,150,150,0.9)', lineHeight: 1.5 }}>
                  🔒 Prazo encerrado — os palpites especiais não podem mais ser editados.
                </div>
              ) : (
                <div style={{ background: 'rgba(255,200,80,0.07)', border: '1px solid rgba(255,200,80,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: 'rgba(255,200,80,0.85)', lineHeight: 1.5 }}>
                  ⚠️ Os palpites especiais devem ser preenchidos até <strong style={{ color: 'rgba(255,220,100,1)' }}>1 hora antes da primeira partida da Copa (11 jun · 16h00)</strong> e não poderão ser editados após esse prazo.
                </div>
              )}
              <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
                {([
                  {
                    emoji: '🏆', label: 'Campeão',        pts: 100,
                    value: campeao,
                    error: campeao && viceCampeao && campeao === viceCampeao,
                    options: ALL_TEAMS.map(t => ({ value: t, label: t })),
                    onChange: (v: string) => { if (especiaisLocked) return; setCampeao(v);       saveSpecialPalpites(v, viceCampeao, artilheiro, melhorJogador, melhorGoleiro) },
                  },
                  {
                    emoji: '🥈', label: 'Vice-Campeão',   pts: 70,
                    value: viceCampeao,
                    error: campeao && viceCampeao && campeao === viceCampeao,
                    options: ALL_TEAMS.map(t => ({ value: t, label: t })),
                    onChange: (v: string) => { if (especiaisLocked) return; setViceCampeao(v);   saveSpecialPalpites(campeao, v, artilheiro, melhorJogador, melhorGoleiro) },
                  },
                  {
                    emoji: '⚽', label: 'Artilheiro',     pts: 50,
                    value: artilheiro,
                    error: false,
                    options: ARTILHEIRO_OPTIONS,
                    onChange: (v: string) => { if (especiaisLocked) return; setArtilheiro(v);    saveSpecialPalpites(campeao, viceCampeao, v, melhorJogador, melhorGoleiro) },
                  },
                  {
                    emoji: '🌟', label: 'Melhor Jogador', pts: 50,
                    value: melhorJogador,
                    error: false,
                    options: ARTILHEIRO_OPTIONS,
                    onChange: (v: string) => { if (especiaisLocked) return; setMelhorJogador(v); saveSpecialPalpites(campeao, viceCampeao, artilheiro, v, melhorGoleiro) },
                  },
                  {
                    emoji: '🧤', label: 'Melhor Goleiro', pts: 50,
                    value: melhorGoleiro,
                    error: false,
                    options: GOLEIRO_OPTIONS,
                    onChange: (v: string) => { if (especiaisLocked) return; setMelhorGoleiro(v); saveSpecialPalpites(campeao, viceCampeao, artilheiro, melhorJogador, v) },
                  },
                ] as { emoji: string; label: string; pts: number; value: string; error: boolean | string | null | undefined; options: { value: string; label: string }[]; onChange: (v: string) => void }[]).map((item, idx, arr) => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: (idx < arr.length - 1 && !(idx === 1 && campeao && viceCampeao && campeao === viceCampeao)) ? '1px solid rgba(255,255,255,0.05)' : 'none', background: item.error ? 'rgba(255,100,100,0.04)' : item.value ? 'rgba(74,222,128,0.03)' : 'transparent' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
                      <div style={{ flex: '0 0 auto', minWidth: 90, maxWidth: 120 }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, whiteSpace: 'nowrap' }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,200,80,0.7)', fontWeight: 700 }}>{item.pts} pts</div>
                      </div>
                      <select
                        value={item.value}
                        onChange={e => item.onChange(e.target.value)}
                        disabled={especiaisLocked}
                        style={{ flex: 1, minWidth: 0, background: '#0D1E3D', border: `1px solid ${item.error ? 'rgba(255,100,100,0.5)' : 'rgba(74,144,217,0.3)'}`, borderRadius: 6, padding: '7px 6px', fontSize: 12, fontWeight: 700, color: especiaisLocked ? 'rgba(255,255,255,0.3)' : item.value ? '#4A90D9' : 'rgba(255,255,255,0.35)', fontFamily: 'Inter,sans-serif', outline: 'none', cursor: especiaisLocked ? 'not-allowed' : 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', opacity: especiaisLocked ? 0.6 : 1 }}>
                        <option value="" style={{ background: '#0D1E3D', color: 'rgba(255,255,255,0.4)' }}>— selecionar —</option>
                        {item.options.map(opt => (
                          <option key={opt.value} value={opt.value} style={{ background: '#0D1E3D', color: 'white' }}>{opt.label}</option>
                        ))}
                      </select>
                      {item.error
                        ? <span style={{ fontSize: 13, color: 'rgba(255,100,100,0.85)', fontWeight: 700, flexShrink: 0 }}>⚠️</span>
                        : item.value
                          ? <span style={{ fontSize: 16, color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>✓</span>
                          : <span style={{ width: 16, flexShrink: 0 }} />
                      }
                    </div>
                    {idx === 1 && campeao && viceCampeao && campeao === viceCampeao && (
                      <div style={{ padding: '7px 16px', background: 'rgba(255,100,100,0.08)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'rgba(255,130,130,0.9)' }}>
                        ⚠️ Campeão e Vice-Campeão não podem ser a mesma seleção.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 5: Pontuação (index 4) */}
          {activeTab === 4 && <PontuacaoTab palpite={selected} todosJogos={todosJogos} scoringConfigs={scoringConfigs} />}

          {/* Desktop bottom bar */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              Palpite <strong style={{ color: 'white' }}>{selected.status === 'ativo' ? 'ativo' : 'inativo'}</strong>
              {selected.status === 'inativo' && <> · Ative pagando <strong style={{ color: 'white' }}>R$ {PIX_VALOR},00</strong> via PIX para participar</>}
            </div>
            {selected.status === 'inativo' && (
              <button onClick={() => setShowPix(true)}
                style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pagar e ativar via PIX
              </button>
            )}
          </div>



          {/* Cascade edit confirmation modal */}
          {cascadeModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.35)', borderRadius: 12, padding: '28px 32px', maxWidth: 400, width: '100%' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 10 }}>
                  Editar este palpite vai afetar as fases seguintes
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 20 }}>
                  <strong style={{ color: '#4A90D9' }}>{cascadeModal.affectedCount}</strong> palpite{cascadeModal.affectedCount !== 1 ? 's' : ''}{' '}
                  {cascadeModal.affectedCount !== 1 ? 'nas fases' : 'na fase'}{' '}
                  <strong style={{ color: 'white' }}>{cascadeModal.affectedPhases.join(' / ')}</strong>{' '}
                  serão apagados e precisarão ser preenchidos novamente.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setCascadeModal(null)} disabled={cascadeModal.confirming}
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    Cancelar
                  </button>
                  <button onClick={confirmCascadeEdit} disabled={cascadeModal.confirming}
                    style={{ background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                    {cascadeModal.confirming ? 'Aguarde...' : 'Confirmar edição'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PIX modal */}
          {showPix && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.35)', borderRadius: 12, padding: '28px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>Ativar via PIX</div>
                <div style={{ background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Chave PIX — CPF</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Ricardo L C Pereira</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: 1 }}>{PIX_CHAVE.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</div>
                  <div style={{ fontSize: 13, color: '#4A90D9', marginTop: 6, fontWeight: 700 }}>R$ {PIX_VALOR},00 por palpite</div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.6, textAlign: 'left' }}>
                  Após pagar, envie o comprovante no{' '}
                  <a href="https://chat.whatsapp.com/LgoS1djS6eIDwtVBZP6DJ4" target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontWeight: 700, textDecoration: 'none' }}>
                    grupo do WhatsApp
                  </a>
                  {' '}informando o <strong style={{ color: 'white' }}>nome do seu palpite</strong>. O organizador ativará em seguida.
                </div>
                <button onClick={() => setShowPix(false)}
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', padding: '8px 20px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                  Fechar
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete palpite confirmation — rendered at root level so it's never clipped */}
      {confirmDelete !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: '#0D1E3D', border: '1px solid rgba(255,80,80,0.35)', borderRadius: 12, padding: '24px 28px', maxWidth: 340, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 8 }}>Excluir este palpite?</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 20, lineHeight: 1.5 }}>
              Esta ação não pode ser desfeita. Todos os palpites de jogos serão removidos.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: 'none', padding: '9px 20px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
                Cancelar
              </button>
              <button onClick={() => deletePalpite(confirmDelete)} disabled={deleting}
                style={{ background: 'rgba(255,80,80,0.2)', border: '1px solid rgba(255,80,80,0.4)', color: 'rgba(255,130,130,0.9)', padding: '9px 20px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif' }}>
                {deleting ? 'Excluindo...' : '🗑 Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Default state used as fallback when a game has no entry in matchStates yet
const DEFAULT_MATCH_STATE: MatchState = { scoreA: -1, scoreB: -1, penaltiA: 0, penaltiB: 0, submitted: false, submittedAt: null, saving: false, error: null }

/* ─── MataMata helpers ───────────────────────────────────── */

const KO_PHASES = [
  { code: 'R32', label: '16 Avos de Final', dates: '29 Jun – 03 Jul', prevCode: 'GS',  prevLabel: 'Fase de Grupos',      total: 16 },
  { code: 'R16', label: 'Oitavas de Final',  dates: '04 Jul – 07 Jul', prevCode: 'R32', prevLabel: '16 Avos de Final',   total: 8  },
  { code: 'QF',  label: 'Quartas de Final',  dates: '09 Jul – 11 Jul', prevCode: 'R16', prevLabel: 'Oitavas de Final',    total: 4  },
  { code: 'SF',  label: 'Semifinal',          dates: '14 Jul – 15 Jul', prevCode: 'QF',  prevLabel: 'Quartas de Final',   total: 2  },
  { code: 'FIN', label: 'Final',              dates: '18 Jul – 19 Jul', prevCode: 'SF',  prevLabel: 'Semifinal',           total: 2  },
] as const

type KoPhaseCode = typeof KO_PHASES[number]['code']

function submittedCountByFase(fase: string, selected: Palpite, jogos: JogoCopa[]) {
  // For 'FIN' display phase, match both TPL and F
  const codes = fase === 'FIN' ? ['TPL', 'F'] : [fase]
  const faseJogos = jogos.filter(j => codes.includes(j.fase))
  const submitted = (selected.palpites_jogos ?? []).filter(pj =>
    faseJogos.some(j => j.id === pj.jogo_id) && pj.submitted_at
  ).length
  return { submitted, total: faseJogos.length }
}

function isPhaseLocked(phaseCode: KoPhaseCode, selected: Palpite, todosJogos: JogoCopa[]): boolean {
  const def = KO_PHASES.find(p => p.code === phaseCode)!
  const prev = def.prevCode

  // R32 special lock: stays locked until the admin fills the official bracket.
  // All R32 jogos_copa records must have real team names (no placeholders).
  if (phaseCode === 'R32') {
    const r32Jogos = todosJogos.filter(j => j.fase === 'R32')
    if (r32Jogos.length === 0) return true  // not seeded yet
    return r32Jogos.some(
      j => isPlaceholder(j.time_a ?? '') || isPlaceholder(j.time_b ?? '')
    )
  }

  // All other phases: locked until the user has submitted every game in the previous phase
  const prevJogos = todosJogos.filter(j => j.fase === prev)
  if (prevJogos.length === 0) return false
  const doneCount = (selected.palpites_jogos ?? []).filter(pj =>
    prevJogos.some(j => j.id === pj.jogo_id) && pj.submitted_at
  ).length
  return doneCount < prevJogos.length
}

/* ─── KnockoutGameCard ────────────────────────────────────── */

interface KoCardProps {
  jogo: JogoCopa
  state: MatchState
  onScoreChange: (side: 'A' | 'B', val: number) => void
  onPenaltiChange: (side: 'A' | 'B', val: number) => void
  onSubmit: () => void
  onEdit: () => void
  pontos?: number | null
  minutosLock?: number
}

function KnockoutGameCard({ jogo, state, onScoreChange, onPenaltiChange, onSubmit, onEdit, pontos, minutosLock = 60 }: KoCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const locked   = isLocked(jogo.data, jogo.horario)
  const editable = canEditWithLock(jogo.data, jogo.horario, minutosLock)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Teams are now always taken directly from jogos_copa.
  // isPlaceholder() is true only when admin hasn't filled the official bracket yet.
  const hasTeamA = !!(jogo.time_a && !isPlaceholder(jogo.time_a))
  const hasTeamB = !!(jogo.time_b && !isPlaceholder(jogo.time_b))
  const displayNameA = hasTeamA ? jogo.time_a : 'A definir'
  const displayCodigoA = jogo.codigo_pais_a
  const displayNameB = hasTeamB ? jogo.time_b : 'A definir'
  const displayCodigoB = jogo.codigo_pais_b
  const confronto = hasTeamA && hasTeamB ? getConfrontoHistorico(jogo.time_a, jogo.time_b) : null
  const MESES_KO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const [, mm, dd] = jogo.data.split('-')
  const dateStr = `${parseInt(dd)} ${MESES_KO[parseInt(mm)-1]} · ${jogo.horario.slice(0,5).replace(':','h')}`

  const scoreColor  = state.submitted ? '#4ade80' : '#4A90D9'
  const scoreBorder = state.submitted ? '2px solid rgba(74,222,128,0.5)' : '1px solid rgba(74,144,217,0.35)'

  function TeamFlag({ hasTeam, codigo, size = 22 }: { hasTeam: boolean; codigo?: string; size?: number }) {
    if (!hasTeam || !codigo) {
      return (
        <div style={{ width: size, height: Math.round(size * 0.67), borderRadius: 3, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>?</div>
      )
    }
    return <FlagImg codigo={codigo} size={size} />
  }

  function ScoreBtn({ val, onInc, onDec, penalti = false }: { val: number; onInc: () => void; onDec: () => void; penalti?: boolean }) {
    const isUnset = val === -1 && !penalti  // only regular scores can be unset
    const btnColor = penalti ? 'rgba(255,200,80,0.8)' : '#4A90D9'
    const btnBorder = penalti ? '1px solid rgba(255,200,80,0.3)' : '1px solid rgba(74,144,217,0.35)'
    const btnBg = penalti ? 'rgba(255,200,80,0.08)' : 'rgba(74,144,217,0.1)'
    const valColor = isUnset ? 'rgba(255,255,255,0.2)' : penalti ? 'rgba(255,200,80,0.9)' : scoreColor
    const valBorder = isUnset ? '2px solid transparent' : penalti
      ? (state.submitted ? '2px solid rgba(255,200,80,0.5)' : '1px solid rgba(255,200,80,0.3)')
      : scoreBorder
    const sz = penalti ? 24 : 30
    const fsz = penalti ? 14 : 17
    const vsz = penalti ? 24 : 32
    const vfsz = isUnset ? 16 : penalti ? 15 : 19
    // Hide +/− buttons when the game is already submitted — score is read-only until edited
    if (state.submitted) {
      return (
        <div style={{ width: vsz, height: vsz, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: vfsz, fontWeight: 800, color: valColor, borderRadius: 5, border: valBorder, userSelect: 'none' }}>
          {isUnset ? '—' : val}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="sc-btn" onClick={onDec} disabled={locked}
          style={{ width: sz, height: sz, border: btnBorder, borderRadius: 5, background: btnBg, color: btnColor, fontSize: fsz, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>−</button>
        <div style={{ width: vsz, height: vsz, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: vfsz, fontWeight: 800, color: valColor, borderRadius: 5, border: valBorder, transition: 'border-color 0.3s, color 0.3s', userSelect: 'none' }}>
          {isUnset ? '—' : val}
        </div>
        <button className="sc-btn" onClick={onInc} disabled={locked}
          style={{ width: sz, height: sz, border: btnBorder, borderRadius: 5, background: btnBg, color: btnColor, fontSize: fsz, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0 }}>+</button>
      </div>
    )
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: locked ? 0.45 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
      background: state.submitted ? 'rgba(74,222,128,0.03)' : 'transparent',
    }}>
      {/* Team A */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <TeamFlag hasTeam={hasTeamA} codigo={displayCodigoA} />
        <span style={{ fontSize: 14, fontWeight: hasTeamA ? 600 : 400, color: hasTeamA ? 'white' : 'rgba(255,255,255,0.3)', fontStyle: hasTeamA ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayNameA}
        </span>
      </div>

      {/* Score */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* 90-min score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ScoreBtn val={state.scoreA} onDec={() => onScoreChange('A', Math.max(0, state.scoreA - 1))} onInc={() => onScoreChange('A', state.scoreA + 1)} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', padding: '0 2px', fontWeight: 300 }}>×</span>
          <ScoreBtn val={state.scoreB} onDec={() => onScoreChange('B', Math.max(0, state.scoreB - 1))} onInc={() => onScoreChange('B', state.scoreB + 1)} />
        </div>
        {/* Penalty row — shown when both scores are set (≥ 0) and equal */}
        {state.scoreA >= 0 && state.scoreB >= 0 && state.scoreA === state.scoreB && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,200,80,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pên.</span>
            <ScoreBtn
              val={state.penaltiA}
              onDec={() => onPenaltiChange('A', Math.max(0, state.penaltiA - 1))}
              onInc={() => onPenaltiChange('A', state.penaltiA + 1)}
              penalti
            />
            <span style={{ fontSize: 11, color: 'rgba(255,200,80,0.3)', fontWeight: 300 }}>×</span>
            <ScoreBtn
              val={state.penaltiB}
              onDec={() => onPenaltiChange('B', Math.max(0, state.penaltiB - 1))}
              onInc={() => onPenaltiChange('B', state.penaltiB + 1)}
              penalti
            />
          </div>
        )}
      </div>

      {/* Team B */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 14, fontWeight: hasTeamB ? 600 : 400, color: hasTeamB ? 'white' : 'rgba(255,255,255,0.3)', fontStyle: hasTeamB ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
          {displayNameB}
        </span>
        <TeamFlag hasTeam={hasTeamB} codigo={displayCodigoB} />
      </div>

      {/* Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>{dateStr}</span>
        {state.submitted ? (
          <>
            <span style={{ color: '#4ade80', fontSize: 14, fontWeight: 700 }}>✓</span>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.50)', fontSize: 13, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⋮</button>
              {menuOpen && (
                <div style={{ position: 'absolute', top: 28, right: 0, background: '#1a2d50', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 8, padding: 4, minWidth: 155, zIndex: 20 }}>
                  <div onClick={() => { if (editable) { onEdit(); setMenuOpen(false) } }}
                    style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: editable ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)', borderRadius: 6, cursor: editable ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => editable && (e.currentTarget.style.background = 'rgba(74,144,217,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    ✏️ Editar placar
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* KO draw without a penalty winner → block submit */}
            {state.scoreA === state.scoreB && state.penaltiA === state.penaltiB ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <button disabled
                  style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'not-allowed', border: 'none', fontFamily: 'Inter,sans-serif', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                  Enviar
                </button>
                <span style={{ fontSize: 8, color: 'rgba(255,120,120,0.8)', fontWeight: 600, textAlign: 'center', maxWidth: 80 }}>
                  indique o vencedor nos pênaltis
                </span>
              </div>
            ) : (
              <button onClick={onSubmit} disabled={state.saving}
                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'Inter,sans-serif', background: 'linear-gradient(90deg,#4A90D9,#1a5ca8)', color: 'white', whiteSpace: 'nowrap' }}>
                {state.saving ? '...' : 'Enviar'}
              </button>
            )}
          </>
        )}
      </div>
      {locked && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.50)', flexShrink: 0 }}>🔒</div>}
    </div>

    {/* Histórico de confronto */}
    {confronto && (
      <div style={{ padding: '4px 16px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>Histórico:</span>
        {confronto.inedito
          ? <span style={{ fontSize: 9, color: 'rgba(255,200,80,0.6)', fontWeight: 600 }}>Primeiro confronto oficial entre as seleções</span>
          : <>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>{confronto.ultimoConfronto}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>·</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{confronto.raioX}</span>
            </>
        }
      </div>
    )}

    {/* Official result + points — shown after submitting when the admin has entered the result */}
    {state.submitted && jogo.resultado && (() => {
      const ra = jogo.resultado.placar_real_a
      const rb = jogo.resultado.placar_real_b
      const pa = jogo.resultado.placar_penalti_a
      const pb = jogo.resultado.placar_penalti_b
      const hasPts = pontos != null
      const ptsColor = pontos && pontos > 0 ? '#4ade80' : 'rgba(255,255,255,0.3)'
      return (
        <div style={{ padding: '5px 16px 8px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
            <span style={{ color: 'rgba(255,255,255,0.50)' }}>🌍 </span>
            <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{jogo.time_a}</strong>
            {' '}<strong style={{ color: 'rgba(255,255,255,0.7)' }}>{ra} × {rb}</strong>{' '}
            <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{jogo.time_b}</strong>
            {pa != null && pb != null && (
              <span style={{ color: 'rgba(255,200,80,0.7)' }}> · pên. {pa}×{pb}</span>
            )}
          </span>
          {hasPts && (
            <span style={{ fontSize: 10, fontWeight: 800, color: ptsColor }}>
              {pontos! > 0 ? `+${pontos} pts` : '0 pts'}
            </span>
          )}
        </div>
      )
    })()}
    </div>
  )
}

/* ─── MataMataTab ─────────────────────────────────────────── */

interface MataMataTabProps {
  selected: Palpite
  jogosKO: JogoCopa[]
  jogosGS: JogoCopa[]
  matchStates: Record<string, MatchState>
  updateState: (id: string, p: Partial<MatchState>) => void
  submitMatch: (id: string) => void
  editMatch: (id: string) => void
  phaseSectionOpen: Record<string, boolean>
  setPhaseSectionOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  mataMataSubTab: number
  setMataMataSubTab: (n: number) => void
  chaveView: 'oficial' | 'palpite'
  setChaveView: (v: 'oficial' | 'palpite') => void
  chavePillIdx: number
  setChavePillIdx: React.Dispatch<React.SetStateAction<number>>
  chaveOuterRef: React.RefObject<HTMLDivElement | null>
  chaveTrackRef: React.RefObject<HTMLDivElement | null>
  minutosLock?: number
}

function MataMataTab({
  selected, jogosKO, jogosGS, matchStates, updateState, submitMatch, editMatch,
  phaseSectionOpen, setPhaseSectionOpen,
  mataMataSubTab, setMataMataSubTab,
  chaveView, setChaveView,
  chavePillIdx, setChavePillIdx, chaveOuterRef, chaveTrackRef,
  minutosLock = 60,
}: MataMataTabProps) {
  // allJogos includes GS so that isPhaseLocked can check if GS is fully submitted
  const allJogos = [...jogosGS, ...jogosKO]

  // ── sub-tab row ──────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
        {(['Mata-Mata', 'Chave'] as const).map((label, i) => (
          <div key={i} onClick={() => setMataMataSubTab(i)} style={{
            padding: '10px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: mataMataSubTab === i ? 'white' : 'rgba(255,255,255,0.45)',
            borderBottom: `2px solid ${mataMataSubTab === i ? '#4A90D9' : 'transparent'}`,
            marginBottom: -1, transition: 'color 0.15s', userSelect: 'none', whiteSpace: 'nowrap',
          }}>{label}</div>
        ))}
      </div>

      {/* sub-tab 0: phase list */}
      {mataMataSubTab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {KO_PHASES.map(phase => {
            const codes = phase.code === 'FIN' ? ['TPL', 'F'] : [phase.code]
            const phaseJogos = jogosKO.filter(j => codes.includes(j.fase))
            const { submitted, total } = submittedCountByFase(phase.code, selected, allJogos)
            const locked = isPhaseLocked(phase.code as KoPhaseCode, selected, allJogos)
            const isOpen = !!phaseSectionOpen[phase.code]
            const complete = submitted === total && total > 0

            return (
              <div key={phase.code} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Phase header */}
                <div onClick={() => { if (!locked) setPhaseSectionOpen(p => ({ ...p, [phase.code]: !p[phase.code] })) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.6 : 1, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{locked ? '🔒' : complete ? '✅' : '⚽'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 0.5, lineHeight: 1.1, color: 'white' }}>{phase.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{phase.dates}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                    background: complete ? 'rgba(34,197,94,0.15)' : submitted > 0 ? 'rgba(74,144,217,0.15)' : 'rgba(255,255,255,0.08)',
                    color: complete ? '#22c55e' : submitted > 0 ? '#4A90D9' : 'rgba(255,255,255,0.45)',
                  }}>
                    {submitted}/{total} preenchidos
                  </span>
                  {!locked && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>▼</span>
                  )}
                </div>

                {/* Locked message */}
                {locked && (
                  <div style={{ padding: '24px 20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>🔒</div>
                    {phase.code === 'R32' ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                          Aguardando término da fase de grupos
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)' }}>
                          Disponível após a divulgação dos classificados da Fase de Grupos pelo administrador.
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                          Disponível após {phase.prevLabel}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)' }}>
                          Preencha todos os {KO_PHASES.find(p => p.code === phase.prevCode)?.total ?? '?'} jogos da {phase.prevLabel} para liberar.
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Phase games (when open) */}
                {!locked && isOpen && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {phaseJogos.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.50)', fontSize: 12 }}>Jogos em breve</div>
                    ) : (
                      Object.entries(
                        phaseJogos.reduce((acc, j) => {
                          if (!acc[j.data]) acc[j.data] = []
                          acc[j.data].push(j)
                          return acc
                        }, {} as Record<string, JogoCopa[]>)
                      ).sort(([a], [b]) => a.localeCompare(b)).map(([data, jogos]) => {
                        const d = new Date(data + 'T12:00:00')
                        const DAYS_PT = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
                        const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
                        const dayLabel = `${DAYS_PT[d.getDay()]} · ${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`
                        return (
                          <div key={data}>
                            <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.7, background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              {dayLabel}
                            </div>
                            {jogos.map(jogo => (
                              <KnockoutGameCard key={jogo.id} jogo={jogo}
                                state={matchStates[String(jogo.id)] ?? DEFAULT_MATCH_STATE}
                                onScoreChange={(side, val) => !matchStates[String(jogo.id)]?.submitted && updateState(String(jogo.id), side === 'A' ? { scoreA: val } : { scoreB: val })}
                                onPenaltiChange={(side, val) => !matchStates[String(jogo.id)]?.submitted && updateState(String(jogo.id), side === 'A' ? { penaltiA: val } : { penaltiB: val })}
                                onSubmit={() => submitMatch(String(jogo.id))}
                                onEdit={() => editMatch(String(jogo.id))}
                                pontos={selected.palpites_jogos?.find(pj => pj.jogo_id === jogo.id)?.pontos ?? null}
                                minutosLock={minutosLock} />
                            ))}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* sub-tab 1: bracket */}
      {mataMataSubTab === 1 && (
        <ChaveKnockout
          jogosKO={jogosKO}
          selected={selected}
          matchStates={matchStates}
          chaveView={chaveView}
          setChaveView={setChaveView}
          pillIdx={chavePillIdx}
          setPillIdx={setChavePillIdx}
          outerRef={chaveOuterRef}
          trackRef={chaveTrackRef}
        />
      )}
    </div>
  )
}

/* ─── ChaveKnockout ───────────────────────────────────────── */

const CHAVE_COLS = [
  { code: 'R32', label: '16 Avos',       dates: '29 Jun – 03 Jul', colIdx: 0 },
  { code: 'R16', label: 'Oitavas',       dates: '04 Jul – 07 Jul', colIdx: 1 },
  { code: 'QF',  label: 'Quartas',       dates: '09 Jul – 11 Jul', colIdx: 2 },
  { code: 'SF',  label: 'Semifinal',     dates: '14 Jul – 15 Jul', colIdx: 3 },
  { code: 'FIN', label: 'Final',         dates: '18 Jul – 19 Jul', colIdx: 4 },
] as const

interface ChaveProps {
  jogosKO: JogoCopa[]
  selected: Palpite
  matchStates: Record<string, MatchState>
  chaveView: 'oficial' | 'palpite'
  setChaveView: (v: 'oficial' | 'palpite') => void
  pillIdx: number
  setPillIdx: React.Dispatch<React.SetStateAction<number>>
  outerRef: React.RefObject<HTMLDivElement | null>
  trackRef: React.RefObject<HTMLDivElement | null>
}

function ChaveKnockout({ jogosKO, selected, matchStates, chaveView, setChaveView, pillIdx, setPillIdx, outerRef, trackRef }: ChaveProps) {
  const MESES_C = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const touchStartXRef = useRef(0)

  // pillIdx = the exact pill the user last clicked or swiped to (0 – length-1).
  // The bracket always shows TWO columns; the left one is clamped so the last
  // column is never pushed off screen.
  const lastIdx  = CHAVE_COLS.length - 1   // 4
  const leftCol  = Math.min(pillIdx, CHAVE_COLS.length - 2)  // 0–3

  function onTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartXRef.current
    if (Math.abs(dx) < 40) return   // ignore tiny moves
    // Swipe moves the selected pill one step; range 0 – lastIdx
    setPillIdx(prev => Math.max(0, Math.min(prev + (dx < 0 ? 1 : -1), lastIdx)))
  }

  function getScore(jogo: JogoCopa, side: 'A' | 'B'): string {
    if (chaveView === 'oficial') {
      if (!jogo.resultado) return '–'
      return String(side === 'A' ? jogo.resultado.placar_real_a : jogo.resultado.placar_real_b)
    }
    const st = matchStates[String(jogo.id)]
    if (!st?.submitted) return '–'
    return String(side === 'A' ? st.scoreA : st.scoreB)
  }

  function getPenalti(jogo: JogoCopa, side: 'A' | 'B'): number | null {
    if (chaveView === 'oficial') {
      const p = side === 'A' ? jogo.resultado?.placar_penalti_a : jogo.resultado?.placar_penalti_b
      return p ?? null
    }
    const st = matchStates[String(jogo.id)]
    if (!st?.submitted || st.scoreA !== st.scoreB) return null
    return side === 'A' ? st.penaltiA : st.penaltiB
  }

  function getWinner(jogo: JogoCopa): 'A' | 'B' | null {
    if (chaveView === 'oficial') {
      if (!jogo.resultado) return null
      const { placar_real_a: a, placar_real_b: b, placar_penalti_a: pa, placar_penalti_b: pb } = jogo.resultado
      if (a > b) return 'A'
      if (b > a) return 'B'
      if (pa != null && pb != null) return pa > pb ? 'A' : pb > pa ? 'B' : null
      return null
    }
    const st = matchStates[String(jogo.id)]
    if (!st?.submitted) return null
    if (st.scoreA > st.scoreB) return 'A'
    if (st.scoreB > st.scoreA) return 'B'
    if (st.penaltiA !== st.penaltiB) return st.penaltiA > st.penaltiB ? 'A' : 'B'
    return null
  }

  // Apply mobile transform: slide the track so leftCol is on the left side.
  // Two half-width columns are always visible; leftCol is clamped to 0–(length-2).
  useEffect(() => {
    const outer = outerRef.current
    const track = trackRef.current
    if (!outer || !track) return
    if (window.innerWidth >= 1024) { track.style.transform = 'none'; return }
    const colW = (outer.offsetWidth - 8) / 2   // each column = half outer width
    const step = colW + 8                       // column width + gap between columns
    track.style.transform = `translateX(-${leftCol * step}px)`
  }) // run every render — outerRef.current.offsetWidth may change

  function MatchCard2({ jogo, isFinal }: { jogo: JogoCopa; isFinal?: boolean }) {
    const [,mm,dd] = jogo.data.split('-')
    const meta = `J${jogo.numero_jogo} · ${parseInt(dd)} ${MESES_C[parseInt(mm)-1]} ${jogo.horario.slice(0,5).replace(':','h')}`
    const isTPL = jogo.fase === 'TPL'
    const winner = getWinner(jogo)
    const hasResult = chaveView === 'oficial' ? !!jogo.resultado : !!matchStates[String(jogo.id)]?.submitted
    const hasTeamA = !!(jogo.time_a && !isPlaceholder(jogo.time_a))
    const hasTeamB = !!(jogo.time_b && !isPlaceholder(jogo.time_b))
    const mc2NameA = hasTeamA ? jogo.time_a : 'A definir'
    const mc2CodigoA = jogo.codigo_pais_a
    const mc2NameB = hasTeamB ? jogo.time_b : 'A definir'
    const mc2CodigoB = jogo.codigo_pais_b

    function TeamRow({ side }: { side: 'A' | 'B' }) {
      const hasTeam  = side === 'A' ? hasTeamA : hasTeamB
      const codigo   = side === 'A' ? mc2CodigoA : mc2CodigoB
      const name     = side === 'A' ? mc2NameA : mc2NameB
      const score    = getScore(jogo, side)
      const penScore = getPenalti(jogo, side)
      const isWin    = winner === side
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', borderRadius: 5, background: isWin ? 'rgba(74,144,217,0.08)' : 'transparent', borderLeft: isWin ? '2px solid #4A90D9' : '2px solid transparent', marginLeft: isWin ? -2 : 0 }}>
          {hasTeam && codigo
            ? <FlagImg codigo={codigo} size={18} />
            : <div style={{ width: 18, height: 12, borderRadius: 2, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>?</div>
          }
          <span style={{ flex: 1, fontSize: 10, fontWeight: hasTeam ? 600 : 400, color: hasTeam ? 'white' : 'rgba(255,255,255,0.3)', fontStyle: hasTeam ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, minWidth: 14, textAlign: 'right', color: isWin ? '#4A90D9' : hasResult ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
              {score}
            </span>
            {penScore != null && (
              <span style={{ fontSize: 8, color: 'rgba(255,200,80,0.7)', fontWeight: 600 }}>({penScore})</span>
            )}
          </div>
        </div>
      )
    }

    return (
      <div style={{
        background: hasResult ? 'rgba(74,144,217,0.05)' : 'rgba(255,255,255,0.04)',
        border: isFinal ? '1px solid #4A90D9' : hasResult ? '1px solid rgba(74,144,217,0.2)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, padding: '8px 10px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.50)' }}>{meta}</span>
          {isTPL && <span style={{ fontSize: 8, fontWeight: 700, color: '#4A90D9', background: 'rgba(74,144,217,0.18)', padding: '1px 5px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>3º Lugar</span>}
        </div>
        <TeamRow side="A" />
        <div style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.2)', fontWeight: 700, letterSpacing: 1, padding: '1px 0' }}>vs</div>
        <TeamRow side="B" />
      </div>
    )
  }

  const colsByCode = Object.fromEntries(
    CHAVE_COLS.map(c => {
      const codes = c.code === 'FIN' ? ['TPL', 'F'] : [c.code]
      return [c.code, jogosKO.filter(j => codes.includes(j.fase)).sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))]
    })
  )

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Acompanhe a chave do torneio</span>
        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, overflow: 'hidden' }}>
          {(['oficial', 'palpite'] as const).map(v => (
            <button key={v} onClick={() => setChaveView(v)}
              style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif', background: chaveView === v ? '#4A90D9' : 'transparent', color: chaveView === v ? 'white' : 'rgba(255,255,255,0.45)', transition: 'background 0.2s, color 0.2s' }}>
              {v === 'oficial' ? 'Resultado Oficial' : 'Meu Palpite'}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile pills — exactly one pill highlighted (the last clicked/swiped-to) */}
      <div className="chave-pills-bar" style={{ display: 'none', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 12, marginBottom: 4 }}>
        {CHAVE_COLS.map((c, i) => {
          const active = i === pillIdx
          return (
            <button key={c.code} onClick={() => setPillIdx(i)}
              style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${active ? '#4A90D9' : 'rgba(255,255,255,0.1)'}`, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', flexShrink: 0, background: active ? '#4A90D9' : 'rgba(255,255,255,0.06)', color: active ? 'white' : 'rgba(255,255,255,0.5)', transition: 'background 0.2s' }}>
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Bracket */}
      <div ref={outerRef} className="chave-outer" style={{ overflowX: 'auto' }}>
        <div ref={trackRef}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 'max-content', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', touchAction: 'pan-y' }}>
          {CHAVE_COLS.map((col, ci) => (
            <React.Fragment key={col.code}>
              <div className="chave-col" data-col={ci}
                style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
                <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 4 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 0.5, color: col.code === 'FIN' ? '#4A90D9' : 'white' }}>{col.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{col.dates}</div>
                </div>
                {col.code === 'FIN' && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#4A90D9', textTransform: 'uppercase', letterSpacing: 0.7, textAlign: 'center' }}>🏆 Grande Final</div>
                )}
                {(colsByCode[col.code] ?? []).map(jogo => (
                  <MatchCard2 key={jogo.id} jogo={jogo} isFinal={jogo.fase === 'F'} />
                ))}
                {col.code === 'FIN' && (colsByCode[col.code] ?? []).some(j => j.fase === 'F' && (chaveView === 'oficial' ? j.resultado : matchStates[String(j.id)]?.submitted)) && (
                  <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.50)', letterSpacing: 0.7 }}>— Campeão Mundial —</div>
                )}
              </div>
              {ci < CHAVE_COLS.length - 1 && (
                <div className="chave-arrow" style={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 44, color: 'rgba(74,144,217,0.35)', fontSize: 14, userSelect: 'none' }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── TabelaDoPalpite ────────────────────────────────────── */

// Row type includes seedOrder so that the drawing-of-lots fallback preserves
// the original order teams appeared in the schedule (stable, deterministic).
type PalpiteRow = {
  time: string; codigo: string; seedOrder: number
  j:number; v:number; e:number; d:number; gp:number; gc:number; sg:number; pts:number
}

// Compute head-to-head sub-standings among a set of teams using only the
// matches played between them and only predictions the user has submitted.
function h2hStats(
  group: PalpiteRow[],
  jogos: JogoCopa[],
  submittedMap: Record<string, PalpiteJogo>
): Record<string, { pts:number; sg:number; gp:number }> {
  const names = new Set(group.map(r => r.time))
  const stats: Record<string, { pts:number; sg:number; gp:number }> = {}
  for (const r of group) stats[r.time] = { pts:0, sg:0, gp:0 }

  for (const j of jogos) {
    if (!names.has(j.time_a) || !names.has(j.time_b)) continue
    const pj = submittedMap[String(j.id)]
    if (!pj) continue
    const ga = pj.placar_palpite_a ?? 0
    const gb = pj.placar_palpite_b ?? 0
    stats[j.time_a].gp += ga; stats[j.time_b].gp += gb
    stats[j.time_a].sg += ga - gb; stats[j.time_b].sg += gb - ga
    if (ga > gb)      { stats[j.time_a].pts += 3 }
    else if (ga < gb) { stats[j.time_b].pts += 3 }
    else              { stats[j.time_a].pts += 1; stats[j.time_b].pts += 1 }
  }
  return stats
}

// Full FIFA group-stage sort:
// 1. Overall pts → sg → gp
// 2. Tied teams: h2h pts → h2h sg → h2h gp
// 3. Still tied: drawing of lots (seedOrder — the order they first appeared in the schedule)
function fifaSort(
  rows: PalpiteRow[],
  jogos: JogoCopa[],
  submittedMap: Record<string, PalpiteJogo>
): PalpiteRow[] {
  // Initial overall sort
  const sorted = [...rows].sort((a, b) =>
    b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || a.seedOrder - b.seedOrder
  )

  const result: PalpiteRow[] = []
  let i = 0

  while (i < sorted.length) {
    // Collect the tie group (same pts + sg + gp)
    let j = i + 1
    while (
      j < sorted.length &&
      sorted[j].pts === sorted[i].pts &&
      sorted[j].sg  === sorted[i].sg  &&
      sorted[j].gp  === sorted[i].gp
    ) j++

    const group = sorted.slice(i, j)

    if (group.length === 1) {
      result.push(group[0])
    } else {
      // Break tie with head-to-head among this group
      const h2h = h2hStats(group, jogos, submittedMap)
      const broken = [...group].sort((a, b) =>
        h2h[b.time].pts - h2h[a.time].pts ||
        h2h[b.time].sg  - h2h[a.time].sg  ||
        h2h[b.time].gp  - h2h[a.time].gp  ||
        a.seedOrder - b.seedOrder           // drawing of lots
      )
      result.push(...broken)
    }

    i = j
  }

  return result
}

function TabelaDoPalpite({ palpite, todosJogos }: { palpite: Palpite; todosJogos: JogoCopa[] }) {
  const submittedMap: Record<string, PalpiteJogo> = {}
  for (const pj of palpite.palpites_jogos ?? []) {
    if (pj.submitted_at) submittedMap[String(pj.jogo_id)] = pj
  }

  const grupoJogos: Record<string, JogoCopa[]> = {}
  for (const j of todosJogos) {
    if (!j.grupo) continue
    if (!grupoJogos[j.grupo]) grupoJogos[j.grupo] = []
    grupoJogos[j.grupo].push(j)
  }

  // Helper: compute standings from a score-provider function
  function buildStandings(
    jogos: JogoCopa[],
    getScore: (j: JogoCopa) => { ga: number; gb: number } | null
  ): PalpiteRow[] {
    const standings: Record<string, PalpiteRow> = {}
    let seed = 0
    for (const jogo of jogos) {
      if (!standings[jogo.time_a]) standings[jogo.time_a] = { time: jogo.time_a, codigo: jogo.codigo_pais_a ?? '', seedOrder: seed++, j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0 }
      if (!standings[jogo.time_b]) standings[jogo.time_b] = { time: jogo.time_b, codigo: jogo.codigo_pais_b ?? '', seedOrder: seed++, j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0 }
      const score = getScore(jogo)
      if (!score) continue
      const { ga, gb } = score
      const ta = standings[jogo.time_a]; const tb = standings[jogo.time_b]
      ta.j++; tb.j++
      ta.gp += ga; ta.gc += gb; ta.sg += ga - gb
      tb.gp += gb; tb.gc += ga; tb.sg += gb - ga
      if (ga > gb) { ta.v++; ta.pts += 3; tb.d++ }
      else if (ga < gb) { tb.v++; tb.pts += 3; ta.d++ }
      else { ta.e++; ta.pts++; tb.e++; tb.pts++ }
    }
    return Object.values(standings)
  }

  const grupos = GRUPOS.map(g => {
    const jogos = grupoJogos[g] ?? []

    // Predicted standings from user's palpites
    const predRows = buildStandings(jogos, j => {
      const pj = submittedMap[String(j.id)]
      if (!pj) return null
      return { ga: pj.placar_palpite_a ?? 0, gb: pj.placar_palpite_b ?? 0 }
    })
    const times = fifaSort(predRows, jogos, submittedMap)

    // Official standings from actual results (only when all games have results)
    const allHaveResults = jogos.length > 0 && jogos.every(j => j.resultado)
    const officialTop2: Set<string> = new Set()
    if (allHaveResults) {
      const offRows = buildStandings(jogos, j =>
        j.resultado ? { ga: j.resultado.placar_real_a, gb: j.resultado.placar_real_b } : null
      )
      const sorted = fifaSort(offRows, jogos, submittedMap)
      if (sorted[0]) officialTop2.add(sorted[0].time)
      if (sorted[1]) officialTop2.add(sorted[1].time)
    }

    // How many of the user's predicted top 2 are in the official top 2?
    const classifBonus = allHaveResults && times.length >= 2
      ? [times[0].time, times[1].time].filter(t => officialTop2.has(t)).length * 20
      : null  // null = results not yet available

    return { grupo: g, times, classifBonus }
  }).filter(g => g.times.length > 0)

  // Compute best-8 third-place teams from the user's predicted standings
  const best8ThirdNames: Set<string> = (() => {
    const thirds = grupos
      .filter(g => g.times.length >= 3)
      .map(g => g.times[2])
    const best8 = [...thirds]
      .sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp)
      .slice(0, 8)
    return new Set(best8.map(t => t.time))
  })()

  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', marginBottom: 14, fontWeight: 500 }}>
        Classificação calculada a partir dos seus palpites · Critérios FIFA
      </div>

      <div className="tabela-palpite-grid">
        {grupos.map(({ grupo, times, classifBonus }) => (
          <div key={grupo} style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(74,144,217,0.08)', borderBottom: '1px solid rgba(74,144,217,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: '#4A90D9', letterSpacing: 1 }}>{grupo}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>Grupo {grupo}</span>
              {/* Classification bonus badge — shown only when official results are in */}
              {classifBonus !== null && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                  background: classifBonus > 0 ? 'rgba(74,144,217,0.18)' : 'rgba(255,255,255,0.06)',
                  color: classifBonus > 0 ? '#4A90D9' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${classifBonus > 0 ? 'rgba(74,144,217,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  whiteSpace: 'nowrap',
                }}>
                  {classifBonus > 0 ? `+${classifBonus} pts` : '0 pts'}
                </span>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 6px 5px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', width: '50%' }}>Seleção</th>
                  {['J','V','E','D','SG','Pts'].map(h => (
                    <th key={h} style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((row, idx) => {
                  const isThirdQualifies = idx === 2 && best8ThirdNames.has(row.time)
                  const qualify = idx < 2 || isThirdQualifies
                  const maybe   = idx === 2 && !isThirdQualifies
                  const out     = idx === 3
                  const sgStr   = row.sg > 0 ? `+${row.sg}` : String(row.sg)
                  const rowBg   = qualify ? 'rgba(74,144,217,0.06)' : maybe ? 'rgba(251,191,36,0.04)' : 'transparent'
                  const leftBorder = qualify ? '2px solid #4A90D9' : maybe ? '2px solid rgba(251,191,36,0.7)' : '2px solid transparent'
                  const ptsColor = maybe ? '#fbbf24' : qualify ? '#4A90D9' : 'rgba(255,255,255,0.45)'
                  return (
                    <tr key={row.time} style={{ opacity: out ? 0.45 : 1 }}>
                      <td style={{ background: rowBg, borderLeft: leftBorder, padding: '6px 6px 6px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', width: 12, textAlign: 'center', flexShrink: 0 }}>{idx + 1}</span>
                          <FlagImg codigo={row.codigo} size={16} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.time}</span>
                        </div>
                      </td>
                      {[row.j, row.v, row.e, row.d, sgStr].map((val, ci) => (
                        <td key={ci} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'center', padding: '6px 6px', background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{val}</td>
                      ))}
                      <td style={{ fontSize: 11, fontWeight: 800, color: ptsColor, textAlign: 'center', padding: '6px 6px', background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{row.pts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: '#4A90D9',             label: 'Classificado' },
          { color: '#fbbf24',             label: 'Depende dos 3ºs' },
          { color: 'rgba(255,255,255,0.2)', label: 'Eliminado' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'rgba(255,255,255,0.50)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── PontuacaoTab ───────────────────────────────────────── */

function PontuacaoTab({ palpite, todosJogos, scoringConfigs }: {
  palpite: Palpite
  todosJogos: JogoCopa[]
  scoringConfigs: { fase: string; tipo_acerto: string; pontos: number }[]
}) {
  const FASE_ORDER = ['GS', 'R32', 'R16', 'QF', 'SF', 'TPL', 'F']
  const FASE_NAMES: Record<string, string> = {
    GS: 'Fase de Grupos', R32: '16 Avos de Final', R16: 'Oitavas de Final',
    QF: 'Quartas de Final', SF: 'Semifinal', TPL: 'Decisão 3º Lugar', F: 'Final',
  }

  // Build scoring config lookup: fase → type → points (with regulation defaults)
  const DEFAULTS: Record<string, number> = {
    GS_placar_exato:20, R32_placar_exato:30, R16_placar_exato:40,
    QF_placar_exato:60, SF_placar_exato:80, TPL_placar_exato:100, F_placar_exato:120,
  }
  const configPts = (fase: string, tipo: string): number => {
    const found = scoringConfigs.find(c => c.fase === fase && c.tipo_acerto === tipo)
    return found?.pontos ?? DEFAULTS[`${fase}_${tipo}`] ?? 0
  }

  // Count total games per phase across all jogos
  const totalJogosByFase: Record<string, number> = {}
  for (const j of todosJogos) {
    totalJogosByFase[j.fase] = (totalJogosByFase[j.fase] ?? 0) + 1
  }

  // Aggregate earned points + submitted count per phase from palpites_jogos
  const jogoFase: Record<number, string> = {}
  for (const j of todosJogos) jogoFase[j.id] = j.fase

  const byFase: Record<string, { submitted: number; pts: number }> = {}
  for (const pj of palpite.palpites_jogos ?? []) {
    if (!pj.submitted_at) continue
    const fase = jogoFase[pj.jogo_id] ?? '?'
    if (!byFase[fase]) byFase[fase] = { submitted: 0, pts: 0 }
    byFase[fase].submitted++
    byFase[fase].pts += pj.pontos ?? 0
  }

  // Max possible per phase = submitted games × placar_exato for that phase
  const maxPtsByFase = (fase: string): number =>
    (byFase[fase]?.submitted ?? 0) * configPts(fase, 'placar_exato')

  const ptsJogos    = Object.values(byFase).reduce((s, v) => s + v.pts, 0)
  const maxJogos    = Object.keys(byFase).reduce((s, f) => s + maxPtsByFase(f), 0)
  const ptsClassif  = palpite.pontos_classificacao ?? 0
  const maxClassif  = 32 * 20   // 32 qualifiers × 20 pts
  const ptsEspeciais= palpite.pontos_especiais ?? 0
  const maxEspeciais= 100 + 70 + 50 + 50 + 50  // 320 pts total
  const ptsTotal    = ptsJogos + ptsClassif + ptsEspeciais
  const maxTotal    = maxJogos + maxClassif + maxEspeciais

  // Percentage bar component
  function ProgressBar({ earned, max, color = '#4A90D9' }: { earned: number; max: number; color?: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((earned / max) * 100)) : 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
        <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 500 }}>

      {/* Per-phase game points */}
      <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
          ⚽ Pontos por fase
        </div>
        {FASE_ORDER.filter(f => byFase[f]).map((fase, idx, arr) => {
          const earned = byFase[fase].pts
          const max    = maxPtsByFase(fase)
          const sub    = byFase[fase].submitted
          const total  = totalJogosByFase[fase] ?? 0
          const pct    = max > 0 ? Math.min(100, Math.round((earned / max) * 100)) : 0
          return (
            <div key={fase} style={{ paddingBottom: idx < arr.length - 1 ? 12 : 0, marginBottom: idx < arr.length - 1 ? 12 : 0, borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              {/* Row header */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{FASE_NAMES[fase]}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>{sub}/{total} jogos</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: earned > 0 ? '#4A90D9' : 'rgba(255,255,255,0.25)' }}>
                    {earned}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', marginLeft: 3 }}>
                    / {max} pts
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 70 ? '#4ade80' : pct >= 40 ? '#4A90D9' : '#f97316', borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            </div>
          )
        })}
        {Object.keys(byFase).length === 0 && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '8px 0' }}>Nenhum palpite enviado ainda</div>
        )}
        {/* Subtotal */}
        {Object.keys(byFase).length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Subtotal jogos</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#4A90D9' }}>{ptsJogos} / {maxJogos} pts</span>
            </div>
            <ProgressBar earned={ptsJogos} max={maxJogos} />
          </div>
        )}
      </div>

      {/* Classification bonus */}
      <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          🏅 Bônus de classificação de grupos
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Seleções classificadas corretas</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              {ptsClassif > 0 ? `${ptsClassif / 20} de 32 · 20 pts cada` : 'Calculado pelo admin ao final da fase de grupos'}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: ptsClassif > 0 ? '#4A90D9' : 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap', marginLeft: 12 }}>
            {ptsClassif} / {maxClassif} pts
          </span>
        </div>
        <ProgressBar earned={ptsClassif} max={maxClassif} color='#4ade80' />
      </div>

      {/* Special predictions */}
      <div style={{ background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          🌟 Palpites especiais
        </div>
        {[
          { emoji: '🏆', label: 'Campeão',        value: palpite.campeao,        maxPts: 100 },
          { emoji: '🥈', label: 'Vice-Campeão',   value: palpite.vice_campeao,   maxPts: 70  },
          { emoji: '⚽', label: 'Artilheiro',     value: palpite.artilheiro,     maxPts: 50  },
          { emoji: '🌟', label: 'Melhor Jogador', value: palpite.melhor_jogador, maxPts: 50  },
          { emoji: '🧤', label: 'Melhor Goleiro', value: palpite.melhor_goleiro, maxPts: 50  },
        ].map((item, idx, arr) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{item.emoji}</span>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: item.value ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', fontStyle: item.value ? 'normal' : 'italic' }}>
                  {item.value || '— não preenchido'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,200,80,0.6)', fontWeight: 700, whiteSpace: 'nowrap' }}>até {item.maxPts} pts</span>
          </div>
        ))}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Subtotal especiais</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: ptsEspeciais > 0 ? '#4A90D9' : 'rgba(255,255,255,0.25)' }}>
              {ptsEspeciais} / {maxEspeciais} pts
            </span>
          </div>
          <ProgressBar earned={ptsEspeciais} max={maxEspeciais} color='rgba(255,200,80,0.8)' />
        </div>
      </div>

      {/* Grand total */}
      <div style={{ background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Geral</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{ptsTotal}</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>/ {maxTotal} pts</span>
          </div>
        </div>
        {/* Overall progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${maxTotal > 0 ? Math.min(100, Math.round((ptsTotal / maxTotal) * 100)) : 0}%`, background: 'linear-gradient(90deg,#4A90D9,#4ade80)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.5)', minWidth: 36, textAlign: 'right' }}>
            {maxTotal > 0 ? Math.min(100, Math.round((ptsTotal / maxTotal) * 100)) : 0}%
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Accordion ──────────────────────────────────────────── */

interface AccCol { border: string; bg: string; line: string; chevron: string }

function Accordion({ isOpen, onToggle, dayNum, label, labelShort, sentCount, pendingCount, dayPts, col, children }: {
  isOpen: boolean; onToggle: () => void; dayNum: number; label: string; labelShort: string;
  sentCount: number; pendingCount: number; dayPts: number | null; col: AccCol; children: React.ReactNode
}) {
  const hasPending = pendingCount > 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div onClick={onToggle} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, background: col.bg, border: `1px solid ${col.border}`, borderRadius: 8, padding: '9px 14px', cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Dia {dayNum}</span>
        <span className="day-date-full" style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="day-date-short" style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap', display: 'none' }}>{labelShort}</span>
        {/* Flex spacer */}
        <div style={{ flex: 1 }} />
        {/* Points badge — absolutely centered so all accordions share the same midpoint */}
        {dayPts !== null && (
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 800, color: dayPts > 0 ? '#4A90D9' : 'rgba(255,255,255,0.3)', background: dayPts > 0 ? 'rgba(74,144,217,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${dayPts > 0 ? 'rgba(74,144,217,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '2px 10px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {dayPts > 0 ? `+${dayPts} pts` : '0 pts'}
          </span>
        )}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>✓ {sentCount} {sentCount === 1 ? 'enviado' : 'enviados'}</span>
        {hasPending && <span style={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>⏳ {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}</span>}
        <span style={{ fontSize: 11, color: col.chevron, transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>▼</span>
      </div>
      {isOpen && <div style={{ paddingTop: 8 }}>{children}</div>}
    </div>
  )
}

/* ─── MatchCard ──────────────────────────────────────────── */

interface MatchCardProps {
  jogo: JogoCopa; state: MatchState
  onScoreChange: (side: 'A' | 'B', val: number) => void
  onSubmit: () => void; onEdit: () => void
  pontos?: number | null  // points earned for this game (shown after official result is known)
  minutosLock?: number
}

/* ─── TeamInfoPanel — qualifying info shown inside MatchCard ─── */

function TeamInfoPanel({ nome }: { nome: string }) {
  const info = TEAM_QUAL[nome]
  if (!info) return null

  const methodColor =
    info.metodo === 'Direto'     ? '#4ade80' :
    info.metodo === 'Sede'       ? '#7BB8F0' :
    info.metodo === 'Playoff'    ? '#f59e0b' :
    /* Repescagem */               '#f97316'

  const hasStats = info.p != null

  return (
    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Full team name */}
      <div style={{ fontSize: 13, fontWeight: 800, color: 'white', marginBottom: 5, letterSpacing: 0.2 }}>
        {nome}
      </div>
      {/* Confederation + method badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasStats ? 8 : 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {info.zona}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: methodColor, background: `${methodColor}18`, border: `1px solid ${methodColor}40`, borderRadius: 10, padding: '1px 6px', whiteSpace: 'nowrap' }}>
          {info.metodoDetalhe}
        </span>
      </div>

      {/* Stats table — only when available */}
      {hasStats && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {([
            ['P',  info.p],
            ['V',  info.v],
            ['E',  info.e],
            ['D',  info.d],
            ['GP', info.gp],
            ['GC', info.gc],
            ['Pts',info.pts],
          ] as [string, number | null][]).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: label === 'Pts' ? '#4A90D9' : 'rgba(255,255,255,0.7)' }}>
                {val ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Narrative description */}
      <div style={{ marginTop: 7, fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
        {info.descricao}
      </div>

      {/* Optional observation */}
      {info.obs && (
        <div style={{ marginTop: 4, fontSize: 9, color: 'rgba(255,200,80,0.7)', fontStyle: 'italic' }}>{info.obs}</div>
      )}
    </div>
  )
}

function MatchCard({ jogo, state, onScoreChange, onSubmit, onEdit, pontos, minutosLock = 60 }: MatchCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [infoOpen, setInfoOpen] = useState(false)

  const locked   = isLocked(jogo.data, jogo.horario)
  const editable = canEditWithLock(jogo.data, jogo.horario, minutosLock)
  const confronto = getConfrontoHistorico(jogo.time_a, jogo.time_b)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const MESES_MC = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const mmDate = `${jogo.data.slice(8, 10)} ${MESES_MC[parseInt(jogo.data.slice(5, 7)) - 1]} · ${jogo.horario.slice(0, 5).replace(':', 'h')} · ${jogo.cidade}`
  const borderColor = locked ? 'rgba(74,144,217,0.15)' : state.submitted ? 'rgba(74,222,128,0.25)' : 'rgba(74,144,217,0.3)'
  const scoreColor  = state.submitted ? '#4ade80' : '#4A90D9'
  const scoreBorder = state.submitted ? '2px solid rgba(74,222,128,0.7)' : '2px solid transparent'

  // -1 means "not entered yet" — displayed as '—'
  const notEntered = state.scoreA === -1 || state.scoreB === -1

  function ScoreControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const safe = Number.isFinite(value) ? value : -1
    const displayVal = safe === -1 ? '—' : safe
    const numColor = safe === -1 ? 'rgba(255,255,255,0.2)' : scoreColor
    const numBorder = safe === -1 ? '2px solid transparent' : scoreBorder
    // Hide +/− buttons when submitted — score is read-only until user clicks Edit
    if (state.submitted) {
      return (
        <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: safe === -1 ? 15 : 17, fontWeight: 800, color: numColor, borderRadius: 6, border: numBorder, userSelect: 'none' }}>
          {displayVal}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button className="sc-btn"
          onClick={() => onChange(safe <= 0 ? (safe === -1 ? -1 : 0) : safe - 1)}
          disabled={locked}
          style={{ width: 24, height: 24, border: '1px solid rgba(74,144,217,0.35)', borderRadius: 5, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0, padding: 0 }}>−</button>
        <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: safe === -1 ? 15 : 17, fontWeight: 800, color: numColor, borderRadius: 6, border: numBorder, transition: 'border-color 0.3s, color 0.3s', userSelect: 'none' }}>
          {displayVal}
        </div>
        <button className="sc-btn"
          onClick={() => onChange(safe < 0 ? 0 : safe + 1)}
          disabled={locked}
          style={{ width: 24, height: 24, border: '1px solid rgba(74,144,217,0.35)', borderRadius: 5, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'Inter,sans-serif', flexShrink: 0, padding: 0 }}>+</button>
      </div>
    )
  }

  return (
    <div style={{ background: '#0D1E3D', border: `1px solid ${borderColor}`, borderRadius: 10, padding: '1px 14px 12px', position: 'relative', opacity: locked ? 0.4 : 1, pointerEvents: locked ? 'none' : 'auto' }}>

      {/* ── Row 1: date / time / venue ── */}
      <div style={{ marginBottom: -5, marginTop: -4 }}>
        <span style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {mmDate}
        </span>
      </div>

      {/* ── Row 2: Grupo badge (left) + action buttons (right) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          {jogo.grupo && (
            <span style={{ fontSize: 9, fontWeight: 800, color: '#7BB8F0', textTransform: 'uppercase', letterSpacing: 0.8, background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 4, padding: '1px 5px' }}>
              Grupo {jogo.grupo}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* Info toggle */}
          <button
            onClick={e => { e.stopPropagation(); setInfoOpen(o => !o) }}
            title="Informações das seleções"
            style={{ background: infoOpen ? 'rgba(74,144,217,0.2)' : 'rgba(74,144,217,0.08)', border: `1px solid ${infoOpen ? 'rgba(74,144,217,0.6)' : 'rgba(74,144,217,0.35)'}`, borderRadius: 4, color: infoOpen ? '#7BB8F0' : '#4A90D9', fontSize: 9, fontWeight: 800, height: 'auto', padding: '1px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0, fontFamily: 'Inter,sans-serif', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Info
          </button>
          {state.submitted && (
            editable ? (
              <button onClick={onEdit}
                style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.5)', borderRadius: 4, color: '#fb923c', fontSize: 9, fontWeight: 800, padding: '1px 5px', cursor: 'pointer', fontFamily: 'Inter,sans-serif', letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>
                Editar
              </button>
            ) : (
              <button disabled title="Prazo encerrado — jogo começa em menos de 1 hora"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 800, padding: '1px 5px', cursor: 'not-allowed', fontFamily: 'Inter,sans-serif', letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>
                Editar
              </button>
            )
          )}
          {state.submitted && <span style={{ color: '#4ade80', fontSize: 14, fontWeight: 700 }}>✓</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FlagImg codigo={jogo.codigo_pais_a ?? ''} size={24} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{abbr(jogo.time_a)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ScoreControl value={state.scoreA} onChange={v => onScoreChange('A', v)} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', padding: '0 2px', fontWeight: 300 }}>×</span>
          <ScoreControl value={state.scoreB} onChange={v => onScoreChange('B', v)} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <FlagImg codigo={jogo.codigo_pais_b ?? ''} size={24} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{abbr(jogo.time_b)}</span>
        </div>
      </div>

      {state.error && <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,100,100,0.9)', textAlign: 'center' }}>{state.error}</div>}

      {locked ? (
        <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(255,255,255,0.50)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 }}>🔒 Jogo em andamento</div>
      ) : (
        <div style={{ marginTop: 10, display: state.submitted ? 'none' : 'block' }}>
          {notEntered ? (
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.50)', padding: 6, borderRadius: 6, fontSize: 10, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Informe o placar
            </div>
          ) : (
            <button onClick={onSubmit} disabled={state.saving}
              style={{ width: '100%', background: 'rgba(74,144,217,0.14)', border: '1px solid rgba(74,144,217,0.3)', color: '#7BB8F0', padding: 6, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {state.saving ? '...' : 'Enviar placar'}
            </button>
          )}
        </div>
      )}

      {/* Official result + points — shown after submitting when the admin has entered the result */}
      {state.submitted && jogo.resultado && (() => {
        const ra = jogo.resultado.placar_real_a
        const rb = jogo.resultado.placar_real_b
        const hasPts = pontos != null
        const ptsColor = pontos && pontos > 0 ? '#4ade80' : 'rgba(255,255,255,0.3)'
        return (
          <div style={{ marginTop: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 5, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>Jogo Oficial: </span>
              <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{jogo.time_a}</strong>
              {' '}<strong style={{ color: 'rgba(255,255,255,0.7)' }}>{ra} × {rb}</strong>{' '}
              <strong style={{ color: 'rgba(255,255,255,0.55)' }}>{jogo.time_b}</strong>
            </span>
            {hasPts && (
              <span style={{ fontSize: 10, fontWeight: 800, color: ptsColor }}>
                {pontos! > 0 ? `+${pontos} pts` : '0 pts'}
              </span>
            )}
          </div>
        )
      })()}

      {/* Expandable team qualifying info — toggled by ℹ️ button */}
      {infoOpen && (
        <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(74,144,217,0.2)' }}>
          {/* Histórico de confronto */}
          {confronto && (
            <div style={{ padding: '7px 10px', background: 'rgba(74,144,217,0.05)', borderBottom: '1px solid rgba(74,144,217,0.15)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>Confronto direto</span>
              {confronto.inedito ? (
                <span style={{ fontSize: 9, color: 'rgba(255,200,80,0.7)', fontWeight: 600 }}>Primeiro confronto oficial entre as seleções</span>
              ) : (
                <>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{confronto.ultimoConfronto}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{confronto.raioX}</span>
                </>
              )}
            </div>
          )}
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.7, padding: '5px 10px', background: 'rgba(74,144,217,0.07)', borderBottom: '1px solid rgba(74,144,217,0.15)' }}>
            Eliminatórias · informações das seleções
          </div>
          <TeamInfoPanel nome={jogo.time_a} />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <TeamInfoPanel nome={jogo.time_b} />
        </div>
      )}
    </div>
  )
}
