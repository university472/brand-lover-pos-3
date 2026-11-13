// Brand Lover POS — web API server.
// Start: node --import ./server/register.js server/index.js   (npm run server)
//
// Every desktop IPC channel (src/main/ipc/*.handlers.js, incl. the PUBLIC / CASHIER / admin
// permission gate) becomes   POST /api/rpc/<channel>   { payload, upload? }
// and answers with the same { ok, data } / { ok, error } shape the React app already uses.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { registerIpcHandlers } from '../src/main/ipc/index.js'
import { requestContext } from '../src/main/services/request.context.js'
import { app as electronApp } from './electron-shim.js'
import { bootstrapWebDatabase, DEMO_USERS } from './bootstrap.js'
import { seedDemoData } from './seed.js'

const PORT = Number(process.env.PORT) || 4000
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')
if (!process.env.JWT_SECRET)
  console.warn('[server] JWT_SECRET not set — logins will reset when the server restarts')
const DEMO_MODE = !/^(0|false|no)$/i.test(process.env.DEMO_MODE || 'true')

// ---- Collect the handlers through a fake ipcMain ----
const handlers = new Map()
registerIpcHandlers({ handle: (channel, fn) => handlers.set(channel, fn) })

// Desktop-only channels that make no sense on a server.
const WEB_UNSUPPORTED = {
  'backup:choose-folder': 'Backups are stored on the server in the web version.',
  'backup:open-folder': 'Backups are stored on the server in the web version.'
}

let ready = false
let startupError = null

const app = express()
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }))
app.use(cors({ origin: true, credentials: false, maxAge: 86400 }))
app.use(compression())
app.use(express.json({ limit: '15mb' }))

app.get('/', (_req, res) => res.type('text').send('Brand Lover POS API is running.'))
app.get('/api/health', (_req, res) =>
  res.status(ready ? 200 : 503).json({ ok: ready, error: startupError, channels: handlers.size })
)
app.get('/api/demo-info', (_req, res) =>
  res.json({
    ok: true,
    data: DEMO_MODE
      ? { demo: true, users: DEMO_USERS.map(({ username, role, password }) => ({ username, role, password })) }
      : { demo: false }
  })
)

app.use('/api/rpc/auth:login', rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }))

function userFromRequest(req) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  try {
    return Number(jwt.verify(token, JWT_SECRET).uid) || null
  } catch {
    return null
  }
}

function saveUpload(upload) {
  if (!upload?.base64) return null
  const dir = path.join(electronApp.getPath('temp'), 'uploads', crypto.randomUUID())
  fs.mkdirSync(dir, { recursive: true })
  const name = path.basename(String(upload.name || 'upload.bin')).replace(/[^\w.\- ]+/g, '_')
  const file = path.join(dir, name)
  fs.writeFileSync(file, Buffer.from(upload.base64, 'base64'))
  return file
}

const MIME = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.gz': 'application/gzip',
  '.sql': 'application/sql'
}

app.post('/api/rpc/:channel', async (req, res) => {
  const channel = req.params.channel
  if (!ready)
    return res.status(503).json({ ok: false, error: startupError || 'Server is starting, please retry in a moment.' })
  if (WEB_UNSUPPORTED[channel]) return res.json({ ok: false, error: WEB_UNSUPPORTED[channel] })
  const fn = handlers.get(channel)
  if (!fn) return res.status(404).json({ ok: false, error: `Unknown action: ${channel}` })

  const store = { userId: userFromRequest(req), downloadPath: null, uploadPath: null }
  try {
    store.uploadPath = saveUpload(req.body?.upload)
    const result = await requestContext.run(store, () => fn({ sender: null }, req.body?.payload))

    if (channel === 'auth:login' && result?.ok && result.data?.id) {
      result.data.token = jwt.sign({ uid: result.data.id }, JWT_SECRET, { expiresIn: '12h' })
    }
    // A save dialog was used → return the written file as a browser download.
    if (store.downloadPath && fs.existsSync(store.downloadPath) && result?.ok) {
      const filename = path.basename(store.downloadPath)
      result.data = {
        ...(result.data && typeof result.data === 'object' ? result.data : {}),
        path: filename,
        download: {
          filename,
          mime: MIME[path.extname(filename).toLowerCase()] || 'application/octet-stream',
          base64: fs.readFileSync(store.downloadPath).toString('base64')
        }
      }
    }
    res.json(result ?? { ok: true, data: null })
  } catch (err) {
    console.error('[rpc]', channel, err)
    res.status(500).json({ ok: false, error: err.message || 'Server error' })
  } finally {
    for (const f of [store.downloadPath, store.uploadPath]) {
      if (f) fs.rm(path.dirname(f), { recursive: true, force: true }, () => {})
    }
  }
})

app.listen(PORT, () => console.log(`[server] API listening on :${PORT} (${handlers.size} channels)`))

// Database setup runs after the port is open (hosts like Render wait for the port).
;(async () => {
  try {
    const { freshInstall } = await bootstrapWebDatabase()
    ready = true
    console.log('[server] database ready', freshInstall ? '(fresh install)' : '')
    if (freshInstall && DEMO_MODE && !/^(0|false|no)$/i.test(process.env.SEED_DEMO || 'true')) {
      await seedDemoData(handlers)
    }
  } catch (e) {
    startupError = `Database startup failed: ${e.message}`
    console.error('[server]', startupError)
  }
})()
