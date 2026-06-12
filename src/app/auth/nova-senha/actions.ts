'use server'

import { createClient } from '@/lib/supabase/server'

// Server Action: atualiza a senha usando a sessão de recovery que está nos cookies
// (evita o erro 422 que ocorre quando o client-side não encontra a sessão correta)
export async function updatePassword(password: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error?.message ?? null }
}
