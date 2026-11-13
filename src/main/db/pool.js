// import mysql from 'mysql2/promise'
// import dotenv from 'dotenv'

// dotenv.config() // dev/.env; in production, bootstrap sets process.env before first query

// let _pool
// export function getPool() {
//   if (!_pool) {
//     _pool = mysql.createPool({
//       host: process.env.DB_HOST || 'localhost',
//       port: Number(process.env.DB_PORT) || 3306,
//       user: process.env.DB_USER || 'root',
//       password: process.env.DB_PASSWORD || '',
//       database: process.env.DB_NAME || 'brand_lover_pos',
//       waitForConnections: true,
//       connectionLimit: 10,
//       queueLimit: 0,
//       decimalNumbers: true,
//       dateStrings: true
//     })
//   }
//   return _pool
// }

// // Keep the existing call sites (pool.query / pool.getConnection) working.
// const pool = {
//   query: (...a) => getPool().query(...a),
//   execute: (...a) => getPool().execute(...a),
//   getConnection: () => getPool().getConnection(),
//   end: () => (_pool ? _pool.end() : Promise.resolve())
// }
// export default pool

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

dotenv.config()

// Set when userData/config.json exists but is broken (shown as a warning at startup)
export let configWarning = null

// Web server (server/index.js sets POS_WEB=1): settings come only from environment
// variables. DATABASE_URL (e.g. Aiven: mysql://user:pass@host:port/db?ssl-mode=REQUIRED)
// wins over the separate DB_* variables. Cloud MySQL needs TLS → DB_SSL=true (implied by
// ssl-mode in the URL).
function loadWebConfig() {
  const url = process.env.DATABASE_URL
  let cfg
  if (url) {
    const u = new URL(url)
    cfg = {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'brand_lover_pos'
    }
    if (/ssl-mode=(required|verify)/i.test(u.search)) process.env.DB_SSL ??= 'true'
  } else {
    cfg = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'brand_lover_pos'
    }
  }
  if (/^(1|true|yes)$/i.test(process.env.DB_SSL || '')) {
    cfg.ssl = process.env.DB_CA_CERT
      ? { ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n') }
      : { rejectUnauthorized: false }
  }
  return cfg
}

function loadConfig() {
  if (process.env.POS_WEB === '1') return loadWebConfig()
  // Packaged app → userData/config.json (client yahan password daalega)
  try {
    const p = path.join(app.getPath('userData'), 'config.json')
    if (fs.existsSync(p)) {
      const c = JSON.parse(fs.readFileSync(p, 'utf-8'))
      return {
        host: c.DB_HOST || 'localhost',
        port: Number(c.DB_PORT) || 3306,
        user: c.DB_USER || 'root',
        password: c.DB_PASSWORD || '',
        database: c.DB_NAME || 'brand_lover_pos'
      }
    }
  } catch (e) {
    // The file exists but is not valid JSON — falling back silently hid the problem (the
    // database settings in it were ignored). Remember it so the app can warn on startup.
    configWarning =
      `The database settings file could not be read, so it was ignored:\n` +
      `${path.join(app.getPath('userData'), 'config.json')}\n\n(${e.message})\n\n` +
      'Fix the file (it must be valid JSON with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) ' +
      'and restart the app.'
  }
  // Dev mode → .env
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'brand_lover_pos'
  }
}

export const dbConfig = loadConfig()

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true
})

// Web server: cloud MySQL runs in UTC, but every report ("today", day book, NOW()) must be
// in the shop's time. Each new connection is switched to DB_TIMEZONE (default +05:00, PKT).
if (process.env.POS_WEB === '1') {
  const tz = process.env.DB_TIMEZONE || '+05:00'
  pool.pool.on('connection', (conn) => {
    conn.query(`SET time_zone = '${tz.replace(/'/g, '')}'`)
  })
}

export default pool
