import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// GET /api/cron/revalidate-ranking
//
// O snapshot diário do ranking (ranking_historico / ranking_historico_completo)
// roda via pg_cron direto no Postgres às 23:55/23:56 BRT (02:55/02:56 UTC) —
// veja supabase/00_fresh_install.sql, seção CRON JOBS. Esse cron não passa
// pela aplicação, então não invalida o cache do Next.js sozinho.
//
// Esta rota só existe para fechar esse loop: agendada na Vercel para rodar na
// janela seguinte (03h UTC, com folga de segurança), ela apenas invalida a
// tag 'ranking' — os dados já foram escritos pelo pg_cron, não há leitura/
// escrita aqui. Depois disso, a variação "▲/▼ desde ontem" no ranking e no
// dashboard reflete o snapshot mais recente sem depender do TTL do cache.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  revalidateTag('ranking', 'max')

  return NextResponse.json({ ok: true, revalidated: 'ranking', at: new Date().toISOString() })
}
