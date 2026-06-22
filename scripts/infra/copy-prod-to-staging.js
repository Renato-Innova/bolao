/**
 * Copia dados da produção para o staging.
 * Tabelas copiadas: todas as tabelas de public/ (ver TABLES abaixo) — lista
 * deve ser mantida em sincronia com o schema real (supabase/00_fresh_install.sql).
 * Para conferir se a lista está completa, rode scripts/infra/diff-schema.mjs
 * ou compare com a saída de generate-fresh-install.mjs.
 *
 * Run: node --env-file=.env.scripts scripts/copy-prod-to-staging.js
 * (copie .env.scripts.example para .env.scripts e preencha as connection strings)
 */

const { Client } = require('pg')

const PROD = process.env.PROD_DATABASE_URL
const STAGING = process.env.STAGING_DATABASE_URL

if (!PROD || !STAGING) {
  console.error('❌ Defina PROD_DATABASE_URL e STAGING_DATABASE_URL (veja .env.scripts.example)')
  process.exit(1)
}

// Tables to copy in order (respeitando dependências de FK — tabelas pai antes
// das filhas, já que o TRUNCATE CASCADE de uma tabela pai apaga os dados já
// copiados de qualquer filha que ainda não tenha sido truncada nesta rodada)
const TABLES = [
  'configuracoes_pontuacao',
  'classificacao_grupos',
  'configuracoes_sistema',
  'resultados_especiais',
  'enquete_config',
  'artilheiros_copa',
  'boletim_copa',
  // auth.users is managed by Supabase Auth — copy public.users only
  'users',
  'palpites',
  'jogos_copa',       // seed data but may have KO slots filled in prod
  'resultados',
  'palpites_jogos',
  'ranking_historico',
  'ranking_historico_completo',
  'palpites_activity_log',
  'enquete_votos',
]

async function getColumnsInBoth(prod, staging, table) {
  const prodCols = await prod.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table])
  const stagingCols = await staging.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1`, [table])
  const stagingSet = new Set(stagingCols.rows.map(r => r.column_name))
  return prodCols.rows.map(r => r.column_name).filter(c => stagingSet.has(c))
}

async function newClient(connStr) {
  const c = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000, query_timeout: 60000 })
  await c.connect()
  return c
}

async function copyTable(prodStr, stagingStr, table) {
  console.log(`\n📋 Copying ${table}...`)

  // Fresh connections for each table
  let prod = await newClient(prodStr)
  let staging = await newClient(stagingStr)

  const cols = await getColumnsInBoth(prod, staging, table)
  const colList = cols.map(c => `"${c}"`).join(', ')

  const { rows: countRows } = await prod.query(`SELECT COUNT(*) FROM public.${table}`)
  const total = parseInt(countRows[0].count)
  if (total === 0) {
    console.log(`   ⚪ No rows — skipping`)
    await prod.end(); await staging.end()
    return
  }

  await staging.query(`TRUNCATE public.${table} CASCADE`)
  await staging.query('SET session_replication_role = replica')

  const BATCH = 50  // smaller batch = reconnect more often
  let inserted = 0

  for (let offset = 0; offset < total; offset += BATCH) {
    // Reconnect every batch to avoid timeout
    await prod.end()
    await staging.end()
    prod = await newClient(prodStr)
    staging = await newClient(stagingStr)
    await staging.query('SET session_replication_role = replica')

    const { rows } = await prod.query(
      `SELECT ${colList} FROM public."${table}" ORDER BY 1 LIMIT $1 OFFSET $2`,
      [BATCH, offset]
    )
    if (rows.length === 0) break

    // Bulk INSERT for the whole batch — far fewer round-trips
    const nCols = cols.length
    const placeholders = rows.map((_, ri) =>
      `(${cols.map((_, ci) => `$${ri * nCols + ci + 1}`).join(', ')})`
    ).join(', ')
    const values = rows.flatMap(row => cols.map(c => row[c]))

    try {
      await staging.query(
        `INSERT INTO public."${table}" (${colList}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      )
      inserted += rows.length
    } catch (e) {
      // Fall back to row-by-row on bulk failure
      for (const row of rows) {
        const vals = cols.map((_, i) => `$${i + 1}`)
        try {
          await staging.query(
            `INSERT INTO public."${table}" (${colList}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING`,
            cols.map(c => row[c])
          )
          inserted++
        } catch (e2) {
          console.warn(`   ⚠️  Row skipped: ${e2.message.slice(0, 80)}`)
        }
      }
    }
    process.stdout.write(`\r   ⏳ ${inserted}/${total}...`)
  }

  await prod.end()
  await staging.end()
  console.log(`\r   ✅ ${inserted}/${total} rows copied   `)
}

async function main() {
  // Quick connectivity test
  console.log('🔌 Testing connections...')
  const testProd = await newClient(PROD)
  const testStaging = await newClient(STAGING)
  console.log('✅ Both connections OK\n')
  await testProd.end()
  await testStaging.end()

  for (const table of TABLES) {
    try {
      await copyTable(PROD, STAGING, table)
    } catch (e) {
      console.error(`❌ Error copying ${table}: ${e.message}`)
    }
  }

  // Reset sequences
  console.log('\n🔁 Resetting sequences...')
  const staging = await newClient(STAGING)
  const seqQuery = await staging.query(`
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `)
  for (const { sequence_name } of seqQuery.rows) {
    const tableName = sequence_name.replace('_id_seq', '').replace('_seq', '')
    try {
      await staging.query(`
        SELECT setval('public.${sequence_name}',
          COALESCE((SELECT MAX(id) FROM public."${tableName}"), 1))
      `)
      console.log(`   ✅ Reset ${sequence_name}`)
    } catch {
      // skip if table name doesn't match
    }
  }
  await staging.end()

  console.log('\n🎉 Done! Staging database is now a copy of production.')
}

main().catch(e => {
  console.error('Fatal error:', e.message)
  process.exit(1)
})
