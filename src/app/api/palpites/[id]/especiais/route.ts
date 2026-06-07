import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// POST /api/palpites/[id]/especiais
// Body: { campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro }
// Salva os palpites especiais via service role (bypassa RLS do browser client)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id: idStr } = await params
  const palpiteId = parseInt(idStr, 10)
  if (isNaN(palpiteId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  // Valida que o palpite pertence ao usuário
  const { data: palpite } = await supabase
    .from('palpites').select('usuario_id').eq('id', palpiteId).maybeSingle()
  if (!palpite) return NextResponse.json({ error: 'Palpite não encontrado.' }, { status: 404 })
  if (palpite.usuario_id !== user.id)
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const body = await req.json()
  const { campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro } = body

  // Campeão e vice não podem ser iguais
  if (campeao && vice_campeao && campeao === vice_campeao) {
    return NextResponse.json({ error: 'Campeão e Vice-Campeão não podem ser a mesma seleção.' }, { status: 400 })
  }

  // Service role bypassa RLS — garante que o update realmente ocorre
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await service
    .from('palpites')
    .update({ campeao, vice_campeao, artilheiro, melhor_jogador, melhor_goleiro })
    .eq('id', palpiteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
