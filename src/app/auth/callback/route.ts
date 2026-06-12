import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')            // 'recovery' no fluxo de reset de senha
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // Fluxo de reset de senha: NÃO trocar o código no servidor.
    // Passamos o code para a página cliente que faz o exchange ela mesma,
    // garantindo que a sessão de recovery fique no browser (evita 422).
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/auth/nova-senha?code=${code}`)
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
