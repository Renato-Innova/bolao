import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { opcao } = await req.json()
  if (!['A', 'B', 'C'].includes(opcao)) {
    return NextResponse.json({ error: 'Opção inválida.' }, { status: 400 })
  }

  // Verifica se enquete está aberta
  const { data: config } = await supabase
    .from('enquete_config')
    .select('aberta')
    .eq('id', 1)
    .single()

  if (!config?.aberta) {
    return NextResponse.json({ error: 'Enquete não está aberta.' }, { status: 403 })
  }

  const { error } = await supabase
    .from('enquete_votos')
    .upsert({ usuario_id: user.id, opcao }, { onConflict: 'usuario_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
