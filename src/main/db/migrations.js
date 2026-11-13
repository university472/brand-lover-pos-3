import fs from 'fs'
import path from 'path'

// Applies pending database/migrations/*.sql at app start-up.
// Before this, migrations only ran via `npm run db:migrate` on the developer's PC — an
// installed copy (client) never received new migrations. Same rules as scripts/migrate.js:
// files run once in name order, recorded in schema_migrations; "already exists" errors are
// skipped so a half-applied or manually-applied migration does not block start-up.

const BENIGN = new Set([
  1050, // table already exists
  1060, // duplicate column name
  1061, // duplicate key name
  1091, // can't DROP; doesn't exist
  1826, // duplicate foreign key constraint name
  1022 // duplicate key
])

const splitStatements = (sql) =>
  sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

// True when at least one migration file has not been applied yet (used to take a
// backup before an app update changes the database).
export async function hasPendingMigrations(conn, dirs) {
  const dir = dirs.find((d) => d && fs.existsSync(d))
  if (!dir) return false
  const files = fs.readdirSync(dir).filter((x) => x.endsWith('.sql'))
  let applied = new Set()
  try {
    const [done] = await conn.query('SELECT filename FROM schema_migrations')
    applied = new Set(done.map((r) => r.filename))
  } catch {
    /* table missing → everything is pending */
  }
  return files.some((f) => !applied.has(f))
}

export async function runPendingMigrations(conn, dirs) {
  const dir = dirs.find((d) => d && fs.existsSync(d))
  if (!dir) return []
  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename VARCHAR(191) PRIMARY KEY,
       applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB`
  )
  const [done] = await conn.query('SELECT filename FROM schema_migrations')
  const applied = new Set(done.map((r) => r.filename))
  const ran = []
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (applied.has(f)) continue
    for (const stmt of splitStatements(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      try {
        await conn.query(stmt)
      } catch (e) {
        if (!BENIGN.has(e.errno))
          throw new Error(`Database update ${f} failed: ${e.message}`)
      }
    }
    await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [f])
    ran.push(f)
  }
  return ran
}
