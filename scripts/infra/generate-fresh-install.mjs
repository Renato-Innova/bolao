/**
 * generate-fresh-install.mjs
 *
 * Introspecciona o schema REAL do banco de produção (tabelas, functions,
 * views, triggers, RLS policies, cron jobs) e gera supabase/00_fresh_install.sql
 * a partir disso — em vez de tentar reconciliar manualmente as 27 migrations
 * históricas (numeração com duplicatas e fora de ordem cronológica).
 *
 * Run: node --env-file=.env.scripts scripts/infra/generate-fresh-install.mjs
 */

import pg from 'pg'
import { writeFileSync } from 'fs'

const PROD = process.env.PROD_DATABASE_URL
if (!PROD) {
  console.error('❌ Defina PROD_DATABASE_URL (veja .env.scripts.example)')
  process.exit(1)
}

const IGNORE_SCHEMAS_TABLES = new Set(['objects', 'buckets', 'subscription', 'job']) // storage/realtime/cron internals

async function getTableOrder(src) {
  const { rows: tables } = await src.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `)
  const { rows: fks } = await src.query(`
    SELECT tc.table_name AS from_table, ccu.table_name AS to_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND ccu.table_schema = 'public'
      AND tc.table_name <> ccu.table_name
  `)
  const all = tables.map(t => t.tablename)
  const deps = new Map(all.map(t => [t, new Set()]))
  for (const { from_table, to_table } of fks) {
    if (deps.has(from_table)) deps.get(from_table).add(to_table)
  }
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
  for (const t of all) if (!sorted.includes(t)) sorted.push(t)
  return sorted
}

async function getTableDDL(src, table) {
  const { rows: cols } = await src.query(`
    SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
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

  const { rows: pks } = await src.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1
    ORDER BY kcu.ordinal_position
  `, [table])
  if (pks.length) colDefs.push(`  PRIMARY KEY (${pks.map(p => `"${p.column_name}"`).join(', ')})`)

  const { rows: uqs } = await src.query(`
    SELECT tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public' AND tc.table_name = $1
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `, [table])
  const uqGroups = {}
  for (const { constraint_name, column_name } of uqs) {
    (uqGroups[constraint_name] ??= []).push(column_name)
  }
  for (const [name, cols2] of Object.entries(uqGroups)) {
    colDefs.push(`  CONSTRAINT "${name}" UNIQUE (${cols2.map(c => `"${c}"`).join(', ')})`)
  }

  const ddl = `CREATE TABLE IF NOT EXISTS public."${table}" (\n${colDefs.join(',\n')}\n);`

  const { rows: idxs } = await src.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
      AND indexname NOT IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = $1)
  `, [table])
  const idxDDLs = idxs.map(i => i.indexdef.replace(/^CREATE (UNIQUE )?INDEX/, 'CREATE $1INDEX IF NOT EXISTS') + ';')

  return { createDDL: ddl, idxDDLs }
}

// pg_constraint (catálogo do sistema) em vez de information_schema — necessário
// porque FKs que referenciam auth.users (fora do schema public) não aparecem
// em information_schema.constraint_column_usage por restrição de visibilidade
// entre schemas, mesmo sendo constraints válidas e ativas no banco.
async function getAllFKDDLs(src) {
  const { rows } = await src.query(`
    SELECT conname, conrelid::regclass::text AS tbl, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
    ORDER BY conrelid::regclass::text, conname
  `)
  return rows.map(r => {
    const tbl = r.tbl.replace(/^public\./, '').replace(/"/g, '')
    return `ALTER TABLE public."${tbl}" ADD CONSTRAINT "${r.conname}" ${r.def};`
  })
}

async function getSequenceDefs(src) {
  const { rows } = await src.query(`
    SELECT sequencename, increment_by, min_value, max_value, start_value, cycle
    FROM pg_sequences WHERE schemaname = 'public'
  `)
  return rows.map(s =>
    `CREATE SEQUENCE IF NOT EXISTS public."${s.sequencename}" INCREMENT BY ${s.increment_by} MINVALUE ${s.min_value} MAXVALUE ${s.max_value} START WITH ${s.start_value} ${s.cycle ? 'CYCLE' : 'NO CYCLE'};`
  )
}

async function getFunctionDefs(src) {
  const { rows } = await src.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `)
  return rows.map(r => r.def.trim().replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION') + ';')
}

async function getViewDefs(src) {
  const { rows } = await src.query(`SELECT viewname, definition FROM pg_views WHERE schemaname = 'public'`)
  return rows.map(r => `CREATE OR REPLACE VIEW public."${r.viewname}" AS\n${r.definition.trim()}`)
}

async function getTriggerDefs(src) {
  const { rows } = await src.query(`
    SELECT t.tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class cl ON cl.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public'
    ORDER BY t.tgname
  `)
  return rows.map(r => `DROP TRIGGER IF EXISTS "${r.tgname}" ON ${r.def.match(/ON (\S+)/)[1]};\n${r.def};`)
}

async function getRLSPolicies(src, tables) {
  const out = []
  for (const table of tables) {
    out.push(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`)
  }
  const { rows: policies } = await src.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
  `)
  for (const p of policies) {
    const rolesRaw = typeof p.roles === 'string'
      ? p.roles.replace(/^\{|\}$/g, '').split(',').map(r => r.trim()).filter(Boolean)
      : Array.isArray(p.roles) ? p.roles : []
    const roles = rolesRaw.length ? `TO ${rolesRaw.join(', ')}` : ''
    const using = p.qual ? `USING (${p.qual})` : ''
    const withCheck = p.with_check ? `WITH CHECK (${p.with_check})` : ''
    out.push(
      `DROP POLICY IF EXISTS "${p.policyname}" ON public."${p.tablename}";\n` +
      `CREATE POLICY "${p.policyname}" ON public."${p.tablename}" AS ${p.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} FOR ${p.cmd} ${roles} ${using} ${withCheck};`
    )
  }
  return out
}

async function getCronJobs(src) {
  try {
    const { rows } = await src.query(`SELECT jobname, schedule, command FROM cron.job`)
    return rows.map(j =>
      `SELECT cron.unschedule('${j.jobname}') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${j.jobname}');\n` +
      `SELECT cron.schedule('${j.jobname}', '${j.schedule}', '${j.command.replace(/'/g, "''")}');`
    )
  } catch {
    return []
  }
}

async function main() {
  const src = new pg.Client({ connectionString: PROD, ssl: { rejectUnauthorized: false } })
  await src.connect()

  const allTables = await getTableOrder(src)
  const tables = allTables.filter(t => !IGNORE_SCHEMAS_TABLES.has(t))

  const createDDLs = [], idxDDLs = []
  for (const table of tables) {
    const { createDDL, idxDDLs: idxs } = await getTableDDL(src, table)
    createDDLs.push(createDDL)
    idxDDLs.push(...idxs)
  }
  const fkDDLs = await getAllFKDDLs(src)

  const sequenceDefs = await getSequenceDefs(src)
  const functionDefs = await getFunctionDefs(src)
  const viewDefs = await getViewDefs(src)
  const triggerDefs = await getTriggerDefs(src)
  const rlsDefs = await getRLSPolicies(src, tables)
  const cronDefs = await getCronJobs(src)

  await src.end()

  const sql = `-- ============================================================
-- Bolão Copa 2026 — FRESH INSTALL (schema completo)
-- GERADO AUTOMATICAMENTE por introspecção do banco de produção
-- (scripts/infra/generate-fresh-install.mjs) — não editar manualmente
-- sem regenerar; reflete o estado real do banco em ${new Date().toISOString().slice(0, 10)}.
--
-- Cole este arquivo inteiro no Supabase SQL Editor e execute.
-- Idempotente: usa IF NOT EXISTS / OR REPLACE / DROP+CREATE em todo lugar.
-- pg_cron precisa estar habilitado em Dashboard → Database → Extensions.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- SEQUENCES (precisam existir antes das tabelas que as usam como default)
-- ═══════════════════════════════════════════════════════════════
${sequenceDefs.join('\n')}

-- ═══════════════════════════════════════════════════════════════
-- TABELAS
-- ═══════════════════════════════════════════════════════════════
${createDDLs.join('\n\n')}

-- ═══════════════════════════════════════════════════════════════
-- FOREIGN KEYS
-- ═══════════════════════════════════════════════════════════════
${fkDDLs.join('\n')}

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICES
-- ═══════════════════════════════════════════════════════════════
${idxDDLs.join('\n')}

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════
${functionDefs.join('\n\n')}

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════
${triggerDefs.join('\n\n')}

-- ═══════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════
${viewDefs.join('\n\n')}

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
${rlsDefs.join('\n\n')}

-- ═══════════════════════════════════════════════════════════════
-- GRANTS (anon + authenticated — RLS é a camada real de restrição)
-- ═══════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- CRON JOBS
-- ═══════════════════════════════════════════════════════════════
${cronDefs.join('\n\n')}
`

  writeFileSync('supabase/00_fresh_install.sql', sql)
  console.log(`✅ supabase/00_fresh_install.sql gerado: ${tables.length} tabelas, ${functionDefs.length} functions, ${viewDefs.length} views, ${triggerDefs.length} triggers, ${cronDefs.length} cron jobs.`)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
