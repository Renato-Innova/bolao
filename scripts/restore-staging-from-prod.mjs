/**
 * restore-staging-from-prod.mjs
 *
 * Wipes the staging database (public schema) and restores it from production.
 * Copies: schema structure (tables, PKs, FKs, indexes, sequences) + all data.
 * Does NOT copy auth.users — those are managed separately via Supabase Auth.
 *
 * Run: node --env-file=.env.scripts scripts/restore-staging-from-prod.mjs
 * (copie .env.scripts.example para .env.scripts e preencha as connection strings)
 */

import pg from 'pg'
const { Client } = pg

// ─── Connection strings ──────────────────────────────────────────────────────

const PROD    = process.env.PROD_DATABASE_URL
const STAGING = process.env.STAGING_DATABASE_URL

if (!PROD || !STAGING) {
  console.error('❌ Defina PROD_DATABASE_URL e STAGING_DATABASE_URL (veja .env.scripts.example)')
  process.exit(1)
}

// Tables to skip (managed by Supabase Auth — not in public schema)
const SKIP_TABLES = new Set([])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`  ${msg}`) }
function ok(msg)   { console.log(`  ✅ ${msg}`) }
function warn(msg) { console.log(`  ⚠️  ${msg}`) }
function step(msg) { console.log(`\n▶ ${msg}`) }

// ─── 1. Get ordered list of tables (respecting FK dependencies) ──────────────

async function getTableOrder(src) {
  // Topological sort via FK graph
  const { rows: tables } = await src.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `)

  const { rows: fks } = await src.query(`
    SELECT
      tc.table_name     AS from_table,
      ccu.table_name    AS to_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
      AND tc.table_name <> ccu.table_name
  `)

  const all = tables.map(t => t.tablename)
  const deps = new Map(all.map(t => [t, new Set()]))
  for (const { from_table, to_table } of fks) {
    if (deps.has(from_table)) deps.get(from_table).add(to_table)
  }

  // Kahn's algorithm
  const sorted = []
  const inDegree = new Map(all.map(t => [t, 0]))
  for (const [, set] of deps) for (const d of set) inDegree.set(d, (inDegree.get(d) ?? 0) + 1)
  const queue = all.filter(t => inDegree.get(t) === 0)
  while (queue.length) {
    const t = queue.shift()
    sorted.push(t)
    for (const dep of (deps.get(t) ?? [])) {
      const n = (inDegree.get(dep) ?? 1) - 1
      inDegree.set(dep, n)
      if (n === 0) queue.push(dep)
    }
  }
  // Append any remaining (circular deps — truncate with CASCADE handles them)
  for (const t of all) if (!sorted.includes(t)) sorted.push(t)
  return sorted
}

// ─── 2. Get full DDL for a table ─────────────────────────────────────────────

async function getTableDDL(src, table) {
  // Columns
  const { rows: cols } = await src.query(`
    SELECT
      column_name,
      data_type,
      udt_name,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table])

  const colDefs = cols.map(c => {
    let type = c.data_type === 'USER-DEFINED' ? c.udt_name
             : c.data_type === 'character varying' ? `varchar${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}`
             : c.data_type === 'numeric' && c.numeric_precision ? `numeric(${c.numeric_precision},${c.numeric_scale ?? 0})`
             : c.data_type

    let def = `  "${c.column_name}" ${type}`
    if (c.column_default) def += ` DEFAULT ${c.column_default}`
    if (c.is_nullable === 'NO') def += ' NOT NULL'
    return def
  })

  // Primary key
  const { rows: pks } = await src.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public' AND tc.table_name = $1
    ORDER BY kcu.ordinal_position
  `, [table])

  if (pks.length) {
    colDefs.push(`  PRIMARY KEY (${pks.map(p => `"${p.column_name}"`).join(', ')})`)
  }

  // Unique constraints
  const { rows: uqs } = await src.query(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public' AND tc.table_name = $1
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `, [table])

  const uqGroups = {}
  for (const { constraint_name, column_name } of uqs) {
    if (!uqGroups[constraint_name]) uqGroups[constraint_name] = []
    uqGroups[constraint_name].push(column_name)
  }
  for (const [name, cols] of Object.entries(uqGroups)) {
    colDefs.push(`  CONSTRAINT "${name}" UNIQUE (${cols.map(c => `"${c}"`).join(', ')})`)
  }

  let ddl = `CREATE TABLE IF NOT EXISTS "${table}" (\n${colDefs.join(',\n')}\n);`

  // Foreign keys (added separately via ALTER TABLE)
  const { rows: fks } = await src.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name  AS ref_table,
      ccu.column_name AS ref_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public' AND tc.table_name = $1
  `, [table])

  const fkDDLs = fks.map(fk =>
    `ALTER TABLE "${table}" ADD CONSTRAINT "${fk.constraint_name}" ` +
    `FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.ref_table}"("${fk.ref_column}") ` +
    `ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};`
  )

  // Indexes (non-PK, non-unique-constraint)
  const { rows: idxs } = await src.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
      AND indexname NOT IN (
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = $1
      )
  `, [table])

  const idxDDLs = idxs.map(i => i.indexdef + ';')

  return { createDDL: ddl, fkDDLs, idxDDLs }
}

// ─── 3. Copy data in batches ──────────────────────────────────────────────────

const BATCH = 500

async function copyTableData(src, dst, table) {
  const { rows: cols } = await src.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table])

  if (!cols.length) return 0

  const colNames = cols.map(c => `"${c.column_name}"`).join(', ')
  const { rows: all } = await src.query(`SELECT * FROM "${table}"`)
  if (!all.length) return 0

  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH)
    const placeholders = batch.map((_, ri) =>
      '(' + cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ') + ')'
    ).join(', ')
    const values = batch.flatMap(row => cols.map(c => row[c.column_name] ?? null))
    await dst.query(
      `INSERT INTO "${table}" (${colNames}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    )
  }

  return all.length
}

// ─── 4. Reset sequences ───────────────────────────────────────────────────────

async function resetSequences(dst) {
  const { rows } = await dst.query(`
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `)
  for (const { sequence_name } of rows) {
    // Find max value of the column using this sequence
    await dst.query(`
      SELECT setval('${sequence_name}',
        COALESCE((
          SELECT MAX(id) FROM "${sequence_name.replace(/_id_seq$/, '').replace(/_seq$/, '')}"
        ), 1)
      )
    `).catch(() => {}) // ignore if table name resolution fails
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔄  RESTORE STAGING FROM PRODUCTION\n' + '─'.repeat(50))

  const src = new Client(PROD)
  const dst = new Client(STAGING)

  await src.connect()
  log('Conectado ao produção')
  await dst.connect()
  log('Conectado ao staging')

  // ── Step 1: Get table order ────────────────────────────────────────────────
  step('Mapeando tabelas e dependências...')
  const tables = (await getTableOrder(src)).filter(t => !SKIP_TABLES.has(t))
  log(`${tables.length} tabelas encontradas: ${tables.join(', ')}`)

  // ── Step 2: Collect DDL from production ───────────────────────────────────
  step('Exportando schema do produção...')
  const allDDL = []
  const allFKs = []
  const allIdx = []
  for (const table of tables) {
    const { createDDL, fkDDLs, idxDDLs } = await getTableDDL(src, table)
    allDDL.push(createDDL)
    allFKs.push(...fkDDLs)
    allIdx.push(...idxDDLs)
  }
  ok(`Schema exportado (${allDDL.length} tabelas, ${allFKs.length} FKs, ${allIdx.length} índices)`)

  // ── Step 3: Wipe staging ───────────────────────────────────────────────────
  step('Limpando staging (DROP SCHEMA + CREATE SCHEMA)...')
  await dst.query('DROP SCHEMA public CASCADE')
  await dst.query('CREATE SCHEMA public')
  await dst.query('GRANT ALL ON SCHEMA public TO postgres')
  await dst.query('GRANT ALL ON SCHEMA public TO public')
  ok('Schema público limpo')

  // ── Step 4a: Create sequences first ──────────────────────────────────────
  step('Criando sequences...')
  const { rows: seqs } = await src.query(`
    SELECT sequencename, increment_by, min_value, max_value, start_value, cycle
    FROM pg_sequences WHERE schemaname = 'public'
  `)
  for (const s of seqs) {
    await dst.query(
      `CREATE SEQUENCE IF NOT EXISTS "${s.sequencename}"
       INCREMENT BY ${s.increment_by}
       MINVALUE ${s.min_value}
       MAXVALUE ${s.max_value}
       START WITH ${s.start_value}
       ${s.cycle ? 'CYCLE' : 'NO CYCLE'}`
    ).catch(e => warn(`Sequence falhou: ${e.message.split('\n')[0]}`))
  }
  ok(`${seqs.length} sequences criadas`)

  // ── Step 4b: Recreate tables ──────────────────────────────────────────────
  step('Recriando tabelas...')
  for (const ddl of allDDL) {
    await dst.query(ddl).catch(e => warn(`DDL falhou: ${e.message.split('\n')[0]}`))
  }
  ok('Tabelas criadas')

  // ── Step 5: Copy data (FK constraints off) ────────────────────────────────
  step('Copiando dados...')
  await dst.query('SET session_replication_role = replica') // disables FK checks
  let total = 0
  for (const table of tables) {
    const n = await copyTableData(src, dst, table)
    if (n > 0) { log(`${table}: ${n} linhas`) }
    total += n
  }
  await dst.query('SET session_replication_role = DEFAULT')
  ok(`${total} linhas copiadas no total`)

  // ── Step 6: Add FK constraints ────────────────────────────────────────────
  step('Adicionando chaves estrangeiras...')
  for (const fk of allFKs) {
    await dst.query(fk).catch(e => warn(`FK falhou: ${e.message.split('\n')[0]}`))
  }
  ok(`${allFKs.length} FKs adicionadas`)

  // ── Step 7: Add indexes ───────────────────────────────────────────────────
  step('Criando índices...')
  for (const idx of allIdx) {
    await dst.query(idx).catch(e => warn(`Índice falhou: ${e.message.split('\n')[0]}`))
  }
  ok(`${allIdx.length} índices criados`)

  // ── Step 8: Reset sequences ───────────────────────────────────────────────
  step('Ajustando sequences (auto-increment)...')
  await resetSequences(dst)
  ok('Sequences ajustadas')

  // ── Step 9: Grant permissions to anon and authenticated roles ───────────
  step('Configurando GRANTs (anon + authenticated)...')
  await dst.query(`GRANT USAGE ON SCHEMA public TO anon, authenticated`)
  await dst.query(`GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated`)
  await dst.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated`)
  await dst.query(`GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated`)
  ok('GRANTs configurados')

  // ── Step 10: Copy RLS policies ────────────────────────────────────────────
  step('Copiando políticas de RLS...')
  const { rows: policies } = await src.query(`
    SELECT
      schemaname, tablename, policyname,
      permissive, roles, cmd,
      qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  `)

  // Enable RLS on all tables first
  for (const table of tables) {
    await dst.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`).catch(() => {})
  }

  // Recreate each policy
  for (const p of policies) {
    // pg_policies returns roles as "{role1,role2}" string — parse it
    const rolesRaw = typeof p.roles === 'string'
      ? p.roles.replace(/^\{|\}$/g, '').split(',').map(r => r.trim()).filter(Boolean)
      : Array.isArray(p.roles) ? p.roles : []
    const roles = rolesRaw.length ? `TO ${rolesRaw.join(', ')}` : ''
    const using = p.qual ? `USING (${p.qual})` : ''
    const withCheck = p.with_check ? `WITH CHECK (${p.with_check})` : ''
    const sql = `
      CREATE POLICY "${p.policyname}"
      ON "${p.tablename}"
      AS ${p.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'}
      FOR ${p.cmd}
      ${roles}
      ${using}
      ${withCheck}
    `
    await dst.query(sql).catch(e => warn(`Policy falhou (${p.policyname}): ${e.message.split('\n')[0]}`))
  }
  ok(`${policies.length} políticas de RLS copiadas`)

  await src.end()
  await dst.end()

  console.log('\n' + '─'.repeat(50))
  console.log('✅  RESTORE CONCLUÍDO!\n')
  console.log('⚠️  Próximos passos:')
  console.log('   1. Crie sua conta no staging (email: renatolcpereira@gmail.com)')
  console.log('   2. No SQL Editor do staging, rode:')
  console.log("      UPDATE users SET is_admin = true WHERE email = 'renatolcpereira@gmail.com';")
  console.log('   3. Confira se o app funciona normalmente\n')
}

main().catch(e => {
  console.error('\n❌ ERRO:', e.message)
  process.exit(1)
})
