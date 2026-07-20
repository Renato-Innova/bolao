import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gerarRelatorioPdf } from '@/services/relatorioPdf'

// pdfkit precisa do runtime Node (fs, Buffer) — nunca Edge.
export const runtime = 'nodejs'
// Margem extra sobre o padrão (10s no plano Hobby) — a geração faz várias
// consultas ao Supabase; sem isso, uma delas mais lenta já é o suficiente
// pra função ser encerrada no meio e o download falhar.
export const maxDuration = 30

export async function GET(req: NextRequest) {
  // DIAGNÓSTICO TEMPORÁRIO — isola se o problema é a geração do PDF (pdfkit)
  // ou algo mais básico na entrega do arquivo. Sem autenticação de propósito,
  // só devolve um PDF mínimo estático. Remover assim que o bug for isolado.
  if (req.nextUrl.searchParams.get('diagnostico') === '1') {
    const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>'
    return new NextResponse(minimalPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="teste-diagnostico.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  }

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

  try {
    const pdf = await gerarRelatorioPdf(palpiteId)
    const nomeArquivo = `relatorio-${palpite.nome.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.pdf`
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
