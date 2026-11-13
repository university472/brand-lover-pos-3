// Web-server version of src/main/db/bootstrap.js: creates the schema on an empty database,
// applies database/migrations/*.sql, and on a FRESH install sets up the demo logins.
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dbConfig } from '../src/main/db/pool.js'
import { runPendingMigrations } from '../src/main/db/migrations.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Logins created on a fresh database (shown on the login screen in demo mode).
export const DEMO_USERS = [
  {
    username: 'Administrator',
    fullName: 'System Administrator',
    role: 'administrator',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  },
  { username: 'Manager', fullName: 'Shop Manager', role: 'manager', password: 'manager123' },
  { username: 'Salesman', fullName: 'Counter Salesman', role: 'cashier', password: 'sales123' }
]

export async function bootstrapWebDatabase() {
  const { database, ...server } = dbConfig
  const conn = await mysql.createConnection({ ...server, multipleStatements: true })
  try {
    try {
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      )
    } catch (e) {
      // Managed MySQL users may not be allowed to create databases — the one in the URL exists.
      console.warn('[bootstrap] CREATE DATABASE skipped:', e.message)
    }
    await conn.changeUser({ database })
    await conn.query(`SET time_zone = '${(process.env.DB_TIMEZONE || '+05:00').replace(/'/g, '')}'`)

    const [t] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables
        WHERE table_schema = ? AND table_name = 'sales'`,
      [database]
    )
    const freshInstall = t[0].n === 0

    if (freshInstall) {
      console.log('[bootstrap] empty database → importing schema')
      const sql = fs.readFileSync(path.join(ROOT, 'database', 'production-schema.sql'), 'utf-8')
      await conn.query(sql)
      await conn.query(
        `UPDATE accounts a SET a.current_balance = a.opening_balance
          WHERE NOT EXISTS (SELECT 1 FROM vouchers v WHERE v.account_id = a.id)`
      )
    }

    const ran = await runPendingMigrations(conn, [path.join(ROOT, 'database', 'migrations')])
    if (ran?.length) console.log('[bootstrap] migrations applied:', ran.join(', '))

    if (freshInstall) {
      for (const u of DEMO_USERS) {
        const hash = await bcrypt.hash(u.password, 10)
        const [r] = await conn.query(
          `UPDATE users SET password_hash = ?, full_name = ?, role = ?, is_active = 1 WHERE username = ?`,
          [hash, u.fullName, u.role, u.username]
        )
        if (r.affectedRows === 0)
          await conn.query(
            `INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)`,
            [u.username, hash, u.fullName, u.role]
          )
      }
    }
    return { freshInstall }
  } finally {
    await conn.end().catch(() => {})
  }
}
