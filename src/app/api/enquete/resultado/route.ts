import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Configuração da enquete
  const { data: config } = await supabase
    .from('enquete_config')
    .select('aberta, resultado_visivel')
    .eq('id', 1)
    .single()

  // Voto do usuário atual (se logado)
  let meuVoto: string | null = null
  if (user) {
    const { data: voto } = await supabase
      .from('enquete_votos')
      .select('opcao')
      .eq('usuario_id', user.id)
      .single()
    meuVoto = voto?.opcao ?? null
  }

  // Totais (só retorna se resultado_visivel = true ou se admin)
  let totais = { A: 0, B: 0, C: 0 }
  let totalUsuariosAtivos = 0
  let totalVotaram = 0

  const isAdmin = user ? (await supabase.from('users').select('is_admin').eq('id', user.id).single()).data?.is_admin : false

  if (config?.resultado_visivel || isAdmin) {
    const { data: votos } = await supabaseAdmin
      .from('enquete_votos')
      .select('opcao')

    votos?.forEach(v => {
      if (v.opcao in totais) totais[v.opcao as keyof typeof totais]++
    })
    totalVotaram = votos?.length ?? 0

    // Total de usuários com ao menos 1 palpite ativo
    const { count } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .filter('id', 'in', `(SELECT DISTINCT usuario_id FROM palpites WHERE status = 'ativo')`)

    totalUsuariosAtivos = count ?? 0
  }

  return NextResponse.json({
    aberta: config?.aberta ?? false,
    resultado_visivel: config?.resultado_visivel ?? false,
    meuVoto,
    totais,
    totalVotaram,
    totalUsuariosAtivos,
  })
}
