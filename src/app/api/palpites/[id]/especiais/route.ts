import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/palpites/[id]/especiais
// Body: { campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro }
// Salva os palpites especiais via service role (bypassa RLS do browser client)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Verifica sessão do usuário (anon client lê cookie)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { id: idStr } = await params
  const palpiteId = parseInt(idStr, 10)
  if (isNaN(palpiteId)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })
  }

  // 2. Usa admin client (service role) para TUDO — bypassa RLS completamente
  const admin = createAdminClient()

  // Valida que o palpite pertence ao usuário
  const { data: palpite, error: fetchError } = await admin
    .from('palpites')
    .select('usuario_id')
    .eq('id', palpiteId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: `Erro ao buscar palpite: ${fetchError.message}` }, { status: 500 })
  }
  if (!palpite) {
    return NextResponse.json({ error: `Palpite ${palpiteId} não encontrado.` }, { status: 404 })
  }
  if (palpite.usuario_id !== user.id) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const body = await req.json()
  const { campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro } = body

  // Campeão e vice não podem ser iguais
  if (campeao && vice_campeao && campeao === vice_campeao) {
    return NextResponse.json(
      { error: 'Campeão e Vice-Campeão não podem ser a mesma seleção.' },
      { status: 400 }
    )
  }

  // 3. Salva via service role — garante que o update realmente ocorre
  const { error: updateError } = await admin
    .from('palpites')
    .update({ campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro })
    .eq('id', palpiteId)

  if (updateError) {
    return NextResponse.json({ error: `Erro ao salvar: ${updateError.message}` }, { status: 500 })
  }

  // ── Activity log (fire-and-forget via service role) ───────────────────────
  try {
    const parts: string[] = []
    if (campeao)         parts.push(`🏆 ${campeao}`)
    if (vice_campeao)    parts.push(`🥈 ${vice_campeao}`)
    if (artilheiro)      parts.push(`⚽ ${artilheiro}`)
    if (melhor_jogador)  parts.push(`🌟 ${melhor_jogador}`)
    if (melhor_goleiro)  parts.push(`🧤 ${melhor_goleiro}`)
    if (parts.length > 0) {
      await admin.from('palpites_activity_log').insert({
        usuario_id: user.id,
        palpite_id: palpiteId,
        jogo_id:    null,
        action:     `Especiais: ${parts.join(' | ')}`,
      })
    }
  } catch { /* log failure must never break the submission */ }

  return NextResponse.json({ ok: true })
}
