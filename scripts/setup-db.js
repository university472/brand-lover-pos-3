import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  }
  const dbName = process.env.DB_NAME || 'brand_lover_pos'
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'schema.sql'),
    'utf8'
  )

  console.log('→ Connecting to MySQL...')
  const conn = await mysql.createConnection(cfg)

  console.log('→ Building schema + seed data...')
  await conn.query(sql)

  // An account with no transactions must hold exactly its opening balance (the seed once
  // shipped Cash opening 33,290 with current 110,488 — out of balance from day one).
  await conn.query(
    `UPDATE \`${dbName}\`.accounts a
        SET a.current_balance = a.opening_balance
      WHERE NOT EXISTS (SELECT 1 FROM \`${dbName}\`.vouchers v WHERE v.account_id = a.id)`
  )

  console.log('→ Creating admin user...')
  const hash = await bcrypt.hash('admin123', 10)
  await conn.query(
    `INSERT INTO \`${dbName}\`.users (username, password_hash, full_name, role, is_active)
     VALUES ('Administrator', ?, 'System Administrator', 'administrator', 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [hash]
  )

  await conn.end()
  console.log('\n✔ Database ready.')
  console.log('  Login    : Administrator')
  console.log('  Password : admin123\n')
}

main().catch((e) => {
  console.error('✖ DB setup failed:', e.message)
  process.exit(1)
})
