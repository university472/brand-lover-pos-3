import { app } from 'electron'
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { dbConfig } from '../db/pool.js'

// Database backup / restore — pure JavaScript (no mysqldump needed on the client PC).
//
// A backup is a plain-text .sql file (DROP + CREATE + INSERT for every table) that opens in
// Notepad and can be restored here (Admin Settings → Backup → Restore) or by hand with any
// MySQL tool. Older backups were gzipped (.sql.gz) — restore still reads those too.
// Recovery after a Windows crash:
//   reinstall Windows → install MySQL → install the app → log in → Admin Settings →
//   Backup → Restore → pick the newest backup file.
//
// Backups go to a folder OUTSIDE the C: drive by default (C: is wiped when Windows is
// reinstalled), plus an optional second folder (USB / Google Drive / OneDrive).

const MARKER = '-- Brand Lover POS backup'
const ROWS_PER_INSERT = 200
const DAY_MS = 24 * 60 * 60 * 1000

// ───────────────────────── settings ─────────────────────────

const settingsPath = () => path.join(app.getPath('userData'), 'backup-settings.json')

function defaultFolder() {
  // Prefer a non-system drive so the backups survive a Windows reinstall.
  for (const d of ['D:', 'E:', 'F:']) {
    try {
      if (fs.existsSync(d + '\\')) return path.join(d + '\\', 'BrandLoverPOS-Backups')
    } catch {
      /* drive not ready */
    }
  }
  return path.join(app.getPath('documents'), 'BrandLoverPOS-Backups')
}

export function getSettings() {
  let s = {}
  try {
    s = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))
  } catch {
    /* first run / unreadable → defaults */
  }
  return {
    folder: s.folder || defaultFolder(),
    extraFolder: s.extraFolder || '',
    keep: Number(s.keep) > 0 ? Number(s.keep) : 30,
    lastBackupAt: s.lastBackupAt || null,
    lastBackupFile: s.lastBackupFile || null,
    lastError: s.lastError || null
  }
}

function saveSettings(patch) {
  const next = { ...getSettings(), ...patch }
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  return next
}

export function updateSettings({ folder, extraFolder, keep } = {}) {
  const patch = {}
  if (folder !== undefined) patch.folder = String(folder || '').trim() || defaultFolder()
  if (extraFolder !== undefined) patch.extraFolder = String(extraFolder || '').trim()
  if (keep !== undefined) patch.keep = Math.min(Math.max(Number(keep) || 30, 3), 365)
  return saveSettings(patch)
}

// ───────────────────────── backup ─────────────────────────

const connect = () =>
  mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    // JSON columns come back as text so they are written back exactly as stored.
    typeCast: (field, next) => (field.type === 'JSON' ? field.string('utf8') : next())
  })

const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// Builds the whole dump as SQL text from one consistent snapshot.
async function dumpSql() {
  const conn = await connect()
  try {
    await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT')
    const [tables] = await conn.query(
      `SELECT table_name AS name FROM information_schema.tables
        WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name`,
      [dbConfig.database]
    )
    // Never write an "empty" backup that would look valid but restore nothing.
    if (!tables.some((t) => t.name === 'sales')) {
      throw new Error(`Database "${dbConfig.database}" has no POS tables — nothing to back up.`)
    }
    const out = [
      `${MARKER}`,
      `-- Created: ${new Date().toISOString()}`,
      `-- App version: ${app.getVersion()}`,
      `-- Tables: ${tables.length}`,
      '',
      'SET NAMES utf8mb4;',
      'SET FOREIGN_KEY_CHECKS = 0;',
      ''
    ]
    let rowCount = 0
    for (const { name } of tables) {
      const [[ct]] = await conn.query(`SHOW CREATE TABLE \`${name}\``)
      out.push(`DROP TABLE IF EXISTS \`${name}\`;`, `${ct['Create Table']};`, '')
      const [rows, fields] = await conn.query({ sql: `SELECT * FROM \`${name}\``, rowsAsArray: true })
      if (!rows.length) continue
      const cols = fields.map((f) => `\`${f.name}\``).join(', ')
      for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
        const values = rows
          .slice(i, i + ROWS_PER_INSERT)
          .map((r) => '(' + r.map((v) => conn.escape(v)).join(',') + ')')
          .join(',\n')
        out.push(`INSERT INTO \`${name}\` (${cols}) VALUES\n${values};`)
      }
      out.push('')
      rowCount += rows.length
    }
    out.push('SET FOREIGN_KEY_CHECKS = 1;', `-- End of backup (${rowCount} rows)`, '')
    await conn.query('COMMIT')
    return { sql: out.join('\n'), tables: tables.length, rows: rowCount }
  } finally {
    await conn.end().catch(() => {})
  }
}

function prune(folder, keep) {
  // Automatic backups: keep the newest one of each day, for the last `keep` days.
  // Manual / before-update / before-restore backups are never deleted.
  try {
    const autos = fs
      .readdirSync(folder)
      .filter((f) => /^BrandLover_auto_\d{4}-\d{2}-\d{2}_.*\.sql(\.gz)?$/.test(f))
      .sort()
      .reverse() // newest first
    const days = new Set()
    for (const f of autos) {
      const day = f.slice('BrandLover_auto_'.length, 'BrandLover_auto_'.length + 10)
      if (!days.has(day) && days.size < keep) days.add(day)
      else fs.unlinkSync(path.join(folder, f))
    }
  } catch {
    /* ignore */
  }
}

let running = null

// kind: 'auto' | 'manual' | 'before-update' | 'before-restore'
export function createBackup(kind = 'manual') {
  // Never run two dumps at the same time — share the one in progress.
  if (running) return running
  running = (async () => {
    const s = getSettings()
    try {
      const { sql, tables, rows } = await dumpSql()
      // Plain UTF-8 text (not gzipped) so the owner can open and read it in Notepad.
      const data = Buffer.from(sql, 'utf-8')
      const file = `BrandLover_${kind}_${stamp()}.sql`
      fs.mkdirSync(s.folder, { recursive: true })
      const main = path.join(s.folder, file)
      fs.writeFileSync(main + '.part', data)
      fs.renameSync(main + '.part', main) // never leave a half-written backup behind
      prune(s.folder, s.keep)

      let extraError = null
      if (s.extraFolder) {
        try {
          fs.mkdirSync(s.extraFolder, { recursive: true })
          fs.copyFileSync(main, path.join(s.extraFolder, file))
          prune(s.extraFolder, s.keep)
        } catch (e) {
          extraError = `Second backup folder not available (${s.extraFolder}): ${e.message}`
        }
      }
      saveSettings({
        lastBackupAt: new Date().toISOString(),
        lastBackupFile: main,
        lastError: extraError
      })
      return { file: main, size: data.length, tables, rows, warning: extraError }
    } catch (e) {
      saveSettings({ lastError: `Backup failed: ${e.message}` })
      throw e
    }
  })().finally(() => {
    running = null
  })
  return running
}

export function listBackups() {
  const { folder } = getSettings()
  try {
    return fs
      .readdirSync(folder)
      .filter((f) => /^BrandLover_.*\.sql(\.gz)?$/.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(folder, f))
        return { name: f, path: path.join(folder, f), size: st.size, modifiedAt: st.mtime.toISOString() }
      })
      .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1))
  } catch {
    return []
  }
}

// ───────────────────────── restore ─────────────────────────

// Splits a SQL script into statements on `;`, ignoring `;` inside quotes and comments.
function splitSql(sql) {
  const stmts = []
  let cur = ''
  let quote = null
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (quote) {
      cur += c
      if (c === '\\' && quote !== '`') {
        cur += sql[++i] ?? ''
      } else if (c === quote) {
        if (sql[i + 1] === quote) cur += sql[++i] // doubled quote = escaped
        else quote = null
      }
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      cur += c
    } else if (c === '-' && sql[i + 1] === '-' && /\s/.test(sql[i + 2] ?? ' ')) {
      while (i < sql.length && sql[i] !== '\n') i++
      cur += '\n'
    } else if (c === '#') {
      while (i < sql.length && sql[i] !== '\n') i++
      cur += '\n'
    } else if (c === '/' && sql[i + 1] === '*' && sql[i + 2] !== '!') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 1
      cur += ' '
    } else if (c === ';') {
      if (cur.trim()) stmts.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  if (cur.trim()) stmts.push(cur.trim())
  return stmts
}

function readBackupFile(file) {
  const buf = fs.readFileSync(file)
  const isGz = buf[0] === 0x1f && buf[1] === 0x8b
  return (isGz ? zlib.gunzipSync(buf) : buf).toString('utf-8')
}

// Restores a backup file over the current database. A safety backup of the current data
// is taken first, so a wrong pick can be undone by restoring that file.
export async function restoreBackup(file, { runMigrations } = {}) {
  const sql = readBackupFile(file)
  if (!/CREATE TABLE\s+`?sales`?/i.test(sql)) {
    throw new Error('This file is not a Brand Lover POS backup (no sales table found).')
  }
  const safety = await createBackup('before-restore')

  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database
  })
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')
    // Remove every current table so nothing from the old/blank install is left behind.
    const [existing] = await conn.query(
      `SELECT table_name AS name, table_type AS type FROM information_schema.tables
        WHERE table_schema = ?`,
      [dbConfig.database]
    )
    for (const t of existing) {
      await conn.query(
        `DROP ${t.type === 'VIEW' ? 'VIEW' : 'TABLE'} IF EXISTS \`${t.name}\``
      )
    }
    for (const stmt of splitSql(sql)) {
      // A backup must not switch to / create / drop another database.
      if (/^(USE|CREATE\s+DATABASE|DROP\s+DATABASE)\b/i.test(stmt)) continue
      await conn.query(stmt)
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
    // The backup may be older than this app version → bring its tables up to date.
    if (runMigrations) await runMigrations(conn)
  } catch (e) {
    throw new Error(
      `Restore failed: ${e.message}\n\nYour data before the restore was saved to:\n${safety.file}`
    )
  } finally {
    await conn.end().catch(() => {})
  }
  return { safetyBackup: safety.file }
}

// ───────────────────────── schedule ─────────────────────────

export function isBackupDue() {
  const { lastBackupAt } = getSettings()
  return !lastBackupAt || Date.now() - new Date(lastBackupAt).getTime() > DAY_MS
}

// Daily backup while the app is open (checked every hour, and once shortly after start).
export function startAutoBackup() {
  const tick = () => {
    if (isBackupDue()) createBackup('auto').catch(() => {})
  }
  setTimeout(tick, 60 * 1000)
  setInterval(tick, 60 * 60 * 1000)
}
