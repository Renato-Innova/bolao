import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase      = await createClient()
  const supabaseAdmin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Configuração da enquete
  const { data: config } = await supabase
    .from('enquete_config')
    .select('aberta, resultado_visivel, decisao_titulo, decisao_texto, decisao_visivel')
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
    const { data: palpitesAtivos } = await supabaseAdmin
      .from('palpites')
      .select('usuario_id')
      .eq('status', 'ativo')

    const uniqueUserIds = [...new Set((palpitesAtivos ?? []).map(p => p.usuario_id))]
    totalUsuariosAtivos = uniqueUserIds.length
  }

  // Decisão final — só vai para o front se decisao_visivel = true ou se admin (modo preview)
  const decisaoVisivelParaMim = !!config?.decisao_visivel || !!isAdmin
  const decisaoTexto  = decisaoVisivelParaMim ? (config?.decisao_texto ?? null) : null
  const decisaoTitulo = decisaoVisivelParaMim ? (config?.decisao_titulo ?? null) : null

  return NextResponse.json({
    aberta: config?.aberta ?? false,
    resultado_visivel: config?.resultado_visivel ?? false,
    meuVoto,
    totais,
    totalVotaram,
    totalUsuariosAtivos,
    isAdmin: !!isAdmin,
    decisao_titulo: decisaoTitulo,
    decisao_texto: decisaoTexto,
    decisao_visivel: !!config?.decisao_visivel,
    decisao_preview: !config?.decisao_visivel && !!isAdmin, // sinaliza que só o admin está vendo
  })
}
