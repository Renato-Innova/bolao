import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Browser-session-aware client — respects RLS using the user's cookie session
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies can be read but not set
          }
        },
      },
    }
  )
}

// Service-role client — bypasses ALL RLS policies. Server-side only.
// Uses the plain supabase-js client (not cookie-based) so the service role key
// is applied correctly and RLS is truly disabled.
// SUPABASE_URL (no NEXT_PUBLIC) is a pure runtime var — not baked at build time.
// Falls back to NEXT_PUBLIC_SUPABASE_URL for local dev.
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  return createSupabaseClient(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
