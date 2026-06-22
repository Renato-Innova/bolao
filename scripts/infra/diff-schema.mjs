import pg from 'pg'

async function snapshot(connStr) {
  const c = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const tables = (await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows.map(r => r.tablename)

  const columns = (await c.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public'
    ORDER BY table_name, ordinal_position
  `)).rows.map(r => `${r.table_name}.${r.column_name}:${r.data_type === 'USER-DEFINED' ? r.udt_name : r.data_type}:${r.is_nullable}:${(r.column_default ?? '').replace(/_seq'/, "_seq'")}`)

  const constraints = (await c.query(`
    SELECT tc.table_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.table_schema='public'
    ORDER BY tc.table_name, tc.constraint_type, kcu.column_name
  `)).rows.map(r => `${r.table_name}:${r.constraint_type}:${r.column_name}`)

  const fks = (await c.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
    ORDER BY tc.table_name, kcu.column_name
  `)).rows.map(r => `${r.table_name}.${r.column_name} -> ${r.ref_table}.${r.ref_column}`)

  const functions = (await c.query(`
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname
  `)).rows.map(r => r.proname)

  const views = (await c.query(`SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY viewname`)).rows.map(r => r.viewname)

  const policies = (await c.query(`
    SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname
  `)).rows.map(r => `${r.tablename}:${r.policyname}:${r.cmd}`)

  const triggers = (await c.query(`
    SELECT cl.relname, t.tgname FROM pg_trigger t
    JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname='public' ORDER BY cl.relname, t.tgname
  `)).rows.map(r => `${r.relname}.${r.tgname}`)

  const indexes = (await c.query(`
    SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname
  `)).rows.map(r => `${r.tablename}.${r.indexname}`)

  await c.end()
  return { tables, columns, constraints, fks, functions, views, policies, triggers, indexes }
}

function diffArrays(name, a, b) {
  const onlyA = a.filter(x => !b.includes(x))
  const onlyB = b.filter(x => !a.includes(x))
  if (onlyA.length === 0 && onlyB.length === 0) {
    console.log(`✅ ${name}: idêntico (${a.length} itens)`)
  } else {
    console.log(`⚠️  ${name}: DIFERENÇA`)
    if (onlyA.length) console.log(`   só em PROD: ${JSON.stringify(onlyA)}`)
    if (onlyB.length) console.log(`   só em STAGING: ${JSON.stringify(onlyB)}`)
  }
}

const prod = await snapshot(process.env.PROD_DATABASE_URL)
const staging = await snapshot(process.env.STAGING_DATABASE_URL)

diffArrays('tables', prod.tables, staging.tables)
diffArrays('columns', prod.columns, staging.columns)
diffArrays('constraints (PK/UNIQUE)', prod.constraints, staging.constraints)
diffArrays('foreign keys', prod.fks, staging.fks)
diffArrays('functions', prod.functions, staging.functions)
diffArrays('views', prod.views, staging.views)
diffArrays('RLS policies', prod.policies, staging.policies)
diffArrays('triggers', prod.triggers, staging.triggers)
diffArrays('indexes', prod.indexes, staging.indexes)
