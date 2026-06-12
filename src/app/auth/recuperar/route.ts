import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

// Rota exclusiva para recuperação de senha.
// redirectTo no resetPasswordForEmail aponta aqui — URL fixa, sem query params.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const pending: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (list) => { list.forEach(({ name, value, options }) => pending.push({ name, value, options })) },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    const dest = error ? '/auth/login?error=link_invalido' : '/auth/nova-senha'
    const response = NextResponse.redirect(`${origin}${dest}`)
    for (const { name, value, options } of pending) {
      response.cookies.set({ name, value, ...options })
    }
    return response
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
