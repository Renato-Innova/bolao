import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/* ─────────────────────────────────────────────────────────────────────────────
   Callback de autenticação Supabase — Next.js App Router

   O `createClient()` de server.ts usa `cookies()` do next/headers para setar
   cookies, mas esses cookies NÃO são incluídos num NextResponse.redirect().

   Aqui criamos o client manualmente para que os cookies sejam definidos
   DIRETAMENTE no objeto NextResponse, garantindo que o browser os receba.
   ───────────────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')   // 'recovery' no reset de senha
  const next       = searchParams.get('next') ?? '/dashboard'

  const destOnSuccess = type === 'recovery' ? '/auth/nova-senha' : next
  const destOnError   = type === 'recovery'
    ? '/auth/nova-senha?error=link_invalido'
    : '/auth/login?error=link_invalido'

  // Acumula os cookies que o Supabase quer setar durante a troca de código
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Lê cookies do REQUEST (necessário para o code verifier PKCE)
        getAll() {
          return request.cookies.getAll()
        },
        // Armazena temporariamente; aplica na resposta depois
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  let success = false

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    success = !error
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'email' | 'signup' | 'invite' | 'magiclink' | 'email_change',
    })
    success = !error
  }

  // Cria a resposta de redirect
  const redirectUrl = `${origin}${success ? destOnSuccess : destOnError}`
  const response = NextResponse.redirect(redirectUrl)

  // Aplica os cookies de sessão na resposta → browser vai recebê-los
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  }

  return response
}
