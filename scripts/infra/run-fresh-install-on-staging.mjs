import pg from 'pg'
import { readFileSync } from 'fs'

const STAGING = process.env.STAGING_DATABASE_URL
if (!STAGING) { console.error('Defina STAGING_DATABASE_URL'); process.exit(1) }

const sql = readFileSync('supabase/00_fresh_install.sql', 'utf8')

const c = new pg.Client({ connectionString: STAGING, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  await c.query(sql)
  console.log('✅ 00_fresh_install.sql executado com sucesso no staging.')
} catch (e) {
  console.error('❌ Erro ao executar:', e.message)
  console.error('posição:', e.position)
  process.exit(1)
}
await c.end()
