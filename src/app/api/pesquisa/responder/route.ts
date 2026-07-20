import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CAMPOS = ['indicaria', 'custo_beneficio', 'facilidade_uso', 'clareza_pontuacao', 'boletim_diario'] as const

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await req.json()

  for (const campo of CAMPOS) {
    const v = body[campo]
    if (typeof v !== 'number' || v < 0 || v > 5 || !Number.isInteger(v)) {
      return NextResponse.json({ error: `Campo "${campo}" inválido.` }, { status: 400 })
    }
  }
  const comentario = typeof body.comentario === 'string' ? body.comentario.trim().slice(0, 2000) : null

  const { error } = await supabase
    .from('pesquisa_satisfacao')
    .upsert({
      usuario_id: user.id,
      indicaria: body.indicaria,
      custo_beneficio: body.custo_beneficio,
      facilidade_uso: body.facilidade_uso,
      clareza_pontuacao: body.clareza_pontuacao,
      boletim_diario: body.boletim_diario,
      comentario: comentario || null,
    }, { onConflict: 'usuario_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
