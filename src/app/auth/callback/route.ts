import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const pending: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (list) => pending.push(...list),
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    const dest = error ? '/auth/login' : next
    const response = NextResponse.redirect(`${origin}${dest}`)
    for (const { name, value, options } of pending) {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    }
    return response
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
