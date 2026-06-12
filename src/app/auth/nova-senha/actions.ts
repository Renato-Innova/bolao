'use server'

import { createClient } from '@/lib/supabase/server'

export async function updatePassword(password: string): Promise<{ error: string | null }> {
  const supabase = await createClient()

  // Usa o client do servidor que lê a sessão de recovery dos cookies
  // (estabelecida pelo callback via exchangeCodeForSession server-side)
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }
  return { error: null }
}
