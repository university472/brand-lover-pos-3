// Stand-in for the 'electron' module when the desktop handlers run inside the web server.
// server/register.js maps every `import ... from 'electron'` to this file, so the ~150 IPC
// handlers in src/main/ipc run UNCHANGED:
//   • dialog.showSaveDialog → a temp file path; after the handler writes the .xlsx there,
//     server/index.js sends the file back to the browser as a download.
//   • dialog.showOpenDialog → the file the browser uploaded with this request.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { requestContext } from '../src/main/services/request.context.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(os.tmpdir(), 'brandlover-web')
fs.mkdirSync(DATA, { recursive: true })

function safeName(name, fallback) {
  const base = path.basename(String(name || fallback || 'file'))
  return base.replace(/[^\w.\- ]+/g, '_') || fallback
}

export const app = {
  isPackaged: false,
  getAppPath: () => ROOT,
  getVersion: () => process.env.APP_VERSION || '1.0.0-web',
  getPath: (name) => {
    const p = path.join(DATA, name)
    fs.mkdirSync(p, { recursive: true })
    return p
  },
  commandLine: { appendSwitch() {} },
  disableHardwareAcceleration() {},
  on() {},
  quit() {}
}

export const dialog = {
  async showSaveDialog(_win, opts = {}) {
    const store = requestContext.getStore()
    if (!store) return { canceled: true }
    const dir = path.join(DATA, 'downloads', crypto.randomUUID())
    fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, safeName(opts.defaultPath, 'export.xlsx'))
    store.downloadPath = filePath
    return { canceled: false, filePath }
  },
  async showOpenDialog() {
    const store = requestContext.getStore()
    if (!store?.uploadPath) return { canceled: true, filePaths: [] }
    return { canceled: false, filePaths: [store.uploadPath] }
  },
  async showMessageBox() {
    return { response: 0 }
  },
  showMessageBoxSync() {
    return 0
  },
  showErrorBox(title, msg) {
    console.error('[dialog]', title, msg)
  }
}

export const BrowserWindow = {
  getFocusedWindow: () => null,
  getAllWindows: () => []
}

export const shell = {
  async openPath() {
    return 'Opening server folders is not available in the web version.'
  }
}

export const ipcMain = { handle() {} }
export const Menu = { setApplicationMenu() {} }

export default { app, dialog, BrowserWindow, shell, ipcMain, Menu }
