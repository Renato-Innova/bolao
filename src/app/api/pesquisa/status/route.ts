import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: resposta } = await supabase
    .from('pesquisa_satisfacao')
    .select('indicaria, custo_beneficio, facilidade_uso, clareza_pontuacao, boletim_diario, comentario')
    .eq('usuario_id', user.id)
    .single()

  const { data: palpites } = await supabase
    .from('palpites')
    .select('id, nome')
    .eq('usuario_id', user.id)
    .eq('status', 'ativo')
    .order('nome')

  return NextResponse.json({
    respondida: !!resposta,
    resposta: resposta ?? null,
    palpites: palpites ?? [],
  })
}
