import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '..', 'database', 'migrations')

// "Pehle se hai" wale errors — safe to skip so migrate idempotent rahe.
const BENIGN = new Set([
  1050, // table already exists
  1060, // duplicate column name
  1061, // duplicate key name
  1091, // can't DROP; doesn't exist
  1826, // duplicate foreign key constraint name
  1022 // duplicate key
])

function splitStatements(sql) {
  return sql
    .replace(/^\s*--.*$/gm, '') // line comments hatao
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'brand_lover_pos',
    multipleStatements: true
  })

  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename VARCHAR(191) PRIMARY KEY,
       applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB`
  )

  const [done] = await conn.query('SELECT filename FROM schema_migrations')
  const applied = new Set(done.map((r) => r.filename))
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : []

  let count = 0
  for (const f of files) {
    if (applied.has(f)) continue
    console.log('→ applying', f)
    const statements = splitStatements(
      fs.readFileSync(path.join(dir, f), 'utf8')
    )
    for (const stmt of statements) {
      try {
        await conn.query(stmt)
      } catch (e) {
        if (BENIGN.has(e.errno)) {
          console.log(`   • skip (already there): ${e.message}`)
        } else {
          console.error(`   ✖ ${f}: ${e.message}`)
          console.error(`   statement: ${stmt.slice(0, 120)}…`)
          await conn.end()
          process.exit(1)
        }
      }
    }
    await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [f])
    count++
  }
  await conn.end()
  console.log(
    count ? `✔ ${count} migration(s) processed.` : '✔ Already up to date.'
  )
}

main().catch((e) => {
  console.error('✖ Migration failed:', e.message)
  process.exit(1)
})
