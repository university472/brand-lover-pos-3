import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
import { join } from 'path'
import { writeFileSync, unlinkSync } from 'fs'
import { registerIpcHandlers } from './ipc/index.js'
import { bootstrapDatabase } from './db/bootstrap.js'
import { configWarning } from './db/pool.js'
import { sendZplRaw } from './print/rawPrint.js'
import { createBackup, startAutoBackup } from './services/backup.service.js'

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Brand Lover POS',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Developer Tools only while developing — never in the installed (packaged) app.
      devTools: !app.isPackaged
    }
  })

  win.on('close', (e) => {
    // If the app is not already quitting (e.g., user clicked X)
    if (!isQuitting) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 1, // Default to 'No' so pressing Enter doesn't accidentally close it
        cancelId: 1, // Pressing Esc acts as 'No'
        title: 'Confirm Exit',
        message: 'Do you want to close Brand Lover POS?',
        detail: 'The application will close and a final backup will be taken.'
      })

      if (choice === 1) {
        // User clicked 'No' — prevent the window from closing
        e.preventDefault()
      } else {
        // User clicked 'Yes' — allow the window to close
        isQuitting = true
      }
    }
  })

  // Dev only: F12 opens DevTools (the app menu is removed, see app.whenReady).
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12')
        win.webContents.toggleDevTools()
    })
  }

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 🆕 Silent print handler — prints the focused window without showing the OS dialog.
// Falls back to the normal print dialog if no default/silent printer is available.
ipcMain.handle('print:silent', async (_e, opts = {}) => {
  const win =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (!win) return { ok: false, error: 'No window to print.' }
  return await new Promise((resolve) => {
    win.webContents.print(
      {
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
        ...(opts.deviceName ? { deviceName: opts.deviceName } : {})
      },
      (success, failureReason) => {
        // Fallback: no default/silent printer → show the normal dialog instead of failing.
        if (!success) {
          win.webContents.print({
            silent: false,
            printBackground: true,
            margins: { marginType: 'none' }
          })
        }
        resolve({
          ok: true,
          data: { success, reason: failureReason || null }
        })
      }
    )
  })
})

// 🆕 Receipt ko ek hidden window mein, content-height ke barabar page bana ke SEEDHA print.
// (Poori app-window print karne wale masle — chhoti strip, blank pages — se bachne ke liye.)
// 📌 FIX (Footer cut issue):
//   1) QR / barcode images load hone ka wait
//   2) scrollHeight se asal content height (viewport se independent)
//   3) default width 72mm (80mm printer ka printable area)
// 🆕 Receipt ko hidden window mein, ASAL content-height ke barabar page bana ke SEEDHA print.
// 📌 FIX (Net Total ke baad cut):
//   documentElement.scrollHeight window height (1200px ≈ 317mm) se kam nahi hota tha →
//   page 325mm banta tha → driver (80×297mm) reject karta tha → bill kat jata tha.
//   Ab sirf receipt element ki height naapte hain aur 297mm pe clamp karte hain.
ipcMain.handle(
  'print:receipt',
  async (_e, { html, widthMm = 70, deviceName, extraMm = 60 } = {}) => {
    console.log('[receipt] start', {
      widthMm,
      deviceName,
      extraMm,
      htmlLen: html?.length
    })
    const MAX_PAGE_MM = 3276 // Printing preferences: 80 x 297mm
    const tmp = join(app.getPath('temp'), `bl-receipt-${Date.now()}.html`)
    let win
    try {
      writeFileSync(tmp, html, 'utf-8')

      const w = widthMm > 0 ? widthMm : 70
      win = new BrowserWindow({
        show: false,
        width: Math.round((w * 96) / 25.4) + 40,
        height: 400, // chhota viewport — height ab content se naapi jati hai
        webPreferences: { sandbox: true }
      })
      await win.loadFile(tmp)

      // 📍 QR / barcode images + fonts load hone ka wait
      try {
        await win.webContents.executeJavaScript(`
        Promise.all(
          Array.from(document.images).map(img =>
            img.complete ? null : new Promise(r => { img.onload = img.onerror = r })
          )
        ).then(() => document.fonts ? document.fonts.ready : null)
      `)
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 150))

      // 📍 Sirf receipt element ki asal height (viewport se independent)
      let heightPx = 0
      console.log('[receipt] heightPx =', heightPx)
      try {
        heightPx = await win.webContents.executeJavaScript(`
        (() => {
          const el = document.body.firstElementChild || document.body
          const r = el.getBoundingClientRect()
          return Math.ceil(r.top + r.height + window.scrollY)
        })()
      `)
      } catch {
        /* ignore */
      }

      // px → mm, + 6mm neeche feed/cut ke liye, phir 40mm–297mm ke beech rakho
      const extra = Number.isFinite(Number(extraMm)) ? Number(extraMm) : 60
      const contentMm = ((heightPx || 600) * 25.4) / 96 + extra
      console.log('[receipt] heightPx =', heightPx)
      const pageMm = Math.min(Math.max(contentMm, 40), MAX_PAGE_MM)

      const pageWidthMicrons =
        w >= 72 && w <= 72.1 ? 71988 : Math.round(w * 1000)
      const pageSize = {
        width: pageWidthMicrons,
        height: Math.round(pageMm * 1000)
      }
      console.log('[receipt] pageSize =', pageSize)
      const result = await new Promise((resolve) => {
        win.webContents.print(
          {
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize,
            ...(deviceName ? { deviceName } : {})
          },
          (ok, reason) => {
            console.log('[receipt] print result:', ok, reason)
            resolve(
              ok ? { ok: true } : { ok: false, error: reason || 'Print failed' }
            )
          }
        )
      })
      return result
    } catch (e) {
      return { ok: false, error: e.message }
    } finally {
      setTimeout(() => {
        try {
          if (win && !win.isDestroyed()) win.close()
        } catch {
          /* ignore */
        }
        try {
          unlinkSync(tmp)
        } catch {
          /* ignore */
        }
      }, 2000)
    }
  }
)
// 🆕 Barcode label sheet ko ek NAAM di hui printer (Zebra) par SEEDHA print.
// 📌 FIX: ab explicit `pageSize` (2in × 1in default = 50.8mm × 25.4mm) bhejte hain,
// taake label printer driver kisi apni default page size (A4/Letter) par print na kare.
// widthMm / heightMm caller se override kiye ja sakte hain (e.g. 4×6, 2×1, 3×2, etc.).
ipcMain.handle(
  'print:labels',
  async (_e, { html, deviceName, widthMm = 50.8, heightMm = 25.4 } = {}) => {
    const tmp = join(app.getPath('temp'), `bl-labels-${Date.now()}.html`)
    let win
    try {
      writeFileSync(tmp, html, 'utf-8')
      win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true }
      })
      await win.loadFile(tmp)
      await new Promise((r) => setTimeout(r, 350)) // barcodes render hone do

      // 📌 Page size microns mein chahiye (1mm = 1000 microns).
      // Default: 50.8mm × 25.4mm = 2in × 1in label.
      const pageSize = {
        width: Math.round(widthMm * 1000),
        height: Math.round(heightMm * 1000)
      }

      await new Promise((resolve) => {
        win.webContents.print(
          {
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize,
            ...(deviceName ? { deviceName } : {})
          },
          (ok) => {
            // Fallback: agar silent print fail ho (na default printer, na device),
            // to normal dialog dikha do — same pageSize ke saath.
            if (!ok) {
              try {
                win.webContents.print({
                  silent: false,
                  printBackground: true,
                  margins: { marginType: 'none' },
                  pageSize
                })
              } catch {
                /* ignore */
              }
            }
            resolve()
          }
        )
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    } finally {
      setTimeout(() => {
        try {
          if (win && !win.isDestroyed()) win.close()
        } catch {
          /* ignore */
        }
        try {
          unlinkSync(tmp)
        } catch {
          /* ignore */
        }
      }, 2000)
    }
  }
)

ipcMain.handle('printer:zpl-raw', async (_e, { deviceName, zpl } = {}) => {
  if (!deviceName) return { ok: false, error: 'deviceName required' }
  if (!zpl) return { ok: false, error: 'zpl required' }
  return sendZplRaw(deviceName, zpl)
})

// 🆕 Optional: list available printers (for a printer picker later)
ipcMain.handle('printer:list', async () => {
  const win =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  const printers = win ? await win.webContents.getPrintersAsync() : []
  return {
    ok: true,
    data: printers.map((p) => ({ name: p.name, isDefault: p.isDefault }))
  }
})

// 📍 bootstrap ab `throw` karta hai (na ke `false` return karta hai).
// Is liye try/catch se wrap kiya; error par bootstrap ne already dialog dikha diya,
// to yahan bas app.quit() aur return.
app.whenReady().then(async () => {
  try {
    await bootstrapDatabase()
  } catch (e) {
    dialog.showErrorBox('Startup failed', String(e.message || e)) // ← ab error screen pe aayega
    app.quit()
    return
  }
  // No application menu: the default one (Alt) offered Reload and Toggle Developer Tools.
  Menu.setApplicationMenu(null)
  dbReady = true
  registerIpcHandlers(ipcMain)
  createWindow()
  startAutoBackup()
  // A broken config.json used to be ignored silently — say so (non-blocking).
  if (configWarning)
    dialog.showMessageBox({
      type: 'warning',
      title: 'Database settings',
      message: configWarning
    })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Backup on close: the window is already gone, so the dump runs invisibly, then the app
// exits. Capped at 2 minutes so a stuck MySQL can never keep the process alive.
let dbReady = false
let closingBackupDone = false
let isQuitting = false
app.on('before-quit', (e) => {
  isQuitting = true
  if (!dbReady || closingBackupDone) return
  e.preventDefault()
  closingBackupDone = true
  Promise.race([
    createBackup('auto').catch(() => {}),
    new Promise((r) => setTimeout(r, 120000))
  ]).finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
