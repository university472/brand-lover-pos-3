import { app, dialog } from 'electron'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { dbConfig } from './pool.js'
import { runPendingMigrations, hasPendingMigrations } from './migrations.js'
import { createBackup } from '../services/backup.service.js'

function schemaPath() {
  const packaged = path.join(
    process.resourcesPath || '',
    'database',
    'production-schema.sql'
  )

  if (fs.existsSync(packaged)) return packaged

  return path.join(app.getAppPath(), 'database', 'production-schema.sql')
}

function ensureConfigFile() {
  const p = path.join(app.getPath('userData'), 'config.json')

  if (!fs.existsSync(p)) {
    fs.writeFileSync(
      p,
      JSON.stringify(
        {
          DB_HOST: 'localhost',
          DB_PORT: 3306,
          DB_USER: 'root',
          DB_PASSWORD: '',
          DB_NAME: 'brand_lover_pos'
        },
        null,
        2
      )
    )

    return {
      created: true,
      path: p
    }
  }

  return {
    created: false,
    path: p
  }
}

// Emergency login recovery: if config.json has "RESET_ADMIN_PASSWORD": "<new pass>",
// the Administrator account is reset (and re-activated) to that password, then the key
// is removed so it only runs once. Needed when the client PC already had an older
// brand_lover_pos database (schema import is skipped, so the old password stays).
async function resetAdminIfRequested(conn, configPath) {
  let cfg
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return
  }
  const newPass = cfg.RESET_ADMIN_PASSWORD
  if (!newPass) return
  const hash = await bcrypt.hash(String(newPass), 10)
  const [r] = await conn.query(
    `UPDATE users SET password_hash = ?, is_active = 1 WHERE username = 'Administrator'`,
    [hash]
  )
  if (r.affectedRows === 0) {
    await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, is_active)
       VALUES ('Administrator', ?, 'System Administrator', 'administrator', 1)`,
      [hash]
    )
  }
  delete cfg.RESET_ADMIN_PASSWORD
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2))
}

export async function bootstrapDatabase() {
  const cfg = ensureConfigFile()
  let conn

  try {
    try {
      conn = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        multipleStatements: true
      })
    } catch (e) {
      throw new Error(
        `MySQL connect nahi hua.\n` +
          `Config: ${cfg.path}\n` +
          `Sahi DB_PASSWORD daalein, save karein, app dobara kholein.\n` +
          `(${e.message})`
      )
    }

    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci`
    )

    await conn.changeUser({
      database: dbConfig.database
    })

    const [t] = await conn.query(
      `SELECT COUNT(*) AS n
       FROM information_schema.tables
       WHERE table_schema = ?
       AND table_name = 'sales'`,
      [dbConfig.database]
    )

    const freshInstall = t[0].n === 0

    if (freshInstall) {
      let sql = ''

      try {
        sql = fs.readFileSync(schemaPath(), 'utf-8')
      } catch {
        throw new Error(`Schema file nahi mili:\n${schemaPath()}`)
      }

      if (!sql.trim() || !/CREATE TABLE/i.test(sql)) {
        throw new Error(
          `Schema file khaali/kharab hai (size ${sql.length}):\n` +
            `${schemaPath()}\n` +
            `production-schema.sql dobara banayein.`
        )
      }

      await conn.query(sql)

      // Fresh install: an account with no transactions must hold exactly its opening
      // balance. The shipped dump had Cash opening 33,290 but current 0, so every new
      // install started out of balance (cash reports off by the opening amount).
      await conn.query(
        `UPDATE accounts a
            SET a.current_balance = a.opening_balance
          WHERE NOT EXISTS (SELECT 1 FROM vouchers v WHERE v.account_id = a.id)`
      )
    }

    // Apply any new database/migrations/*.sql (fresh AND existing installs). Packaged app:
    // resources/database/migrations; dev: <project>/database/migrations.
    const migrationDirs = [
      path.join(process.resourcesPath || '', 'database', 'migrations'),
      path.join(app.getAppPath(), 'database', 'migrations')
    ]
    // App update with database changes → back up the existing data first, so a bad update
    // can be undone with Admin Settings → Backup → Restore.
    if (!freshInstall && (await hasPendingMigrations(conn, migrationDirs))) {
      try {
        await createBackup('before-update')
      } catch (e) {
        // Don't lock the shop out of its POS — warn and continue (migrations only add).
        dialog.showMessageBox({
          type: 'warning',
          title: 'Backup',
          message: `Update se pehle backup nahi ban saka:\n${e.message}\n\nAdmin Settings → Backup check karein.`
        })
      }
    }
    await runPendingMigrations(conn, migrationDirs)

    await resetAdminIfRequested(conn, cfg.path)
  } finally {
    if (conn) {
      try {
        await conn.end()
      } catch {
        /* ignore close errors */
      }
    }
  }
}
