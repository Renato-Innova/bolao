import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { gerarRelatorioPdf } from '@/services/relatorioPdf'

// pdfkit precisa do runtime Node (fs, Buffer) — nunca Edge.
export const runtime = 'nodejs'
// Margem extra sobre o padrão (10s no plano Hobby) — só entra em jogo no
// fallback de geração ao vivo (ver abaixo); servir do Storage é rápido.
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const palpiteId = Number(req.nextUrl.searchParams.get('palpiteId'))
  if (!palpiteId) return NextResponse.json({ error: 'palpiteId inválido.' }, { status: 400 })

  // Só libera para quem já respondeu a pesquisa de satisfação
  const { data: resposta } = await supabase
    .from('pesquisa_satisfacao')
    .select('id')
    .eq('usuario_id', user.id)
    .single()
  if (!resposta) return NextResponse.json({ error: 'Responda a pesquisa de satisfação primeiro.' }, { status: 403 })

  // Só libera relatório de palpite do próprio usuário
  const { data: palpite } = await supabase
    .from('palpites')
    .select('id, nome, usuario_id')
    .eq('id', palpiteId)
    .single()
  if (!palpite || palpite.usuario_id !== user.id) {
    return NextResponse.json({ error: 'Palpite não encontrado.' }, { status: 404 })
  }

  const nomeArquivo = `relatorio-${palpite.nome.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.pdf`
  const admin = createAdminClient()

  // Caminho principal: os relatórios de todos os palpites ativos já foram
  // pré-gerados em lote (script scripts/infra/_gerar_todos_relatorios.mts) e
  // ficam prontos no Storage — servir um arquivo já pronto é bem mais rápido
  // e confiável do que gerar na hora a cada clique.
  const { data: arquivo } = await admin.storage.from('relatorios').download(`${palpiteId}.pdf`)
  if (arquivo) {
    return new NextResponse(await arquivo.arrayBuffer(), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // Fallback: palpite criado depois da geração em lote (ou falha isolada) —
  // gera ao vivo em vez de devolver erro.
  try {
    const pdf = await gerarRelatorioPdf(palpiteId)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[relatorio] erro ao gerar PDF:', err)
    return NextResponse.json(
      { error: 'Erro ao gerar relatório.', detalhe: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
