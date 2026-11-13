import { app, dialog, BrowserWindow, shell } from 'electron'
import path from 'path'
import {
  getSettings,
  updateSettings,
  createBackup,
  listBackups,
  restoreBackup
} from '../services/backup.service.js'
import { runPendingMigrations } from '../db/migrations.js'
import { authorize, setSessionUser } from '../services/auth.guard.js'

const migrationDirs = () => [
  path.join(process.resourcesPath || '', 'database', 'migrations'),
  path.join(app.getAppPath(), 'database', 'migrations')
]

export function registerBackupHandlers(ipcMain) {
  ipcMain.handle('backup:status', async () => {
    try {
      return { ok: true, data: { ...getSettings(), backups: listBackups() } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('backup:update-settings', async (_e, p = {}) => {
    try {
      return { ok: true, data: updateSettings(p) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('backup:choose-folder', async (_e, { title } = {}) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const r = await dialog.showOpenDialog(win, {
        title: title || 'Choose backup folder',
        properties: ['openDirectory', 'createDirectory']
      })
      if (r.canceled || !r.filePaths.length) return { ok: true, data: null }
      return { ok: true, data: r.filePaths[0] }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('backup:create', async () => {
    try {
      return { ok: true, data: await createBackup('manual') }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('backup:open-folder', async () => {
    try {
      const err = await shell.openPath(getSettings().folder)
      return err ? { ok: false, error: err } : { ok: true, data: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Restore replaces ALL data — Owner / Admin only (not Manager).
  ipcMain.handle('backup:restore', async (_e, { file } = {}) => {
    try {
      await authorize(null, ['administrator'])
      let target = file
      if (!target) {
        const win = BrowserWindow.getFocusedWindow()
        const r = await dialog.showOpenDialog(win, {
          title: 'Choose a backup file to restore',
          defaultPath: getSettings().folder,
          filters: [{ name: 'POS Backup', extensions: ['gz', 'sql'] }],
          properties: ['openFile']
        })
        if (r.canceled || !r.filePaths.length) return { ok: true, data: { canceled: true } }
        target = r.filePaths[0]
      }
      const res = await restoreBackup(target, {
        runMigrations: (conn) => runPendingMigrations(conn, migrationDirs())
      })
      // User accounts came from the backup — everyone must log in again.
      setSessionUser(null)
      return { ok: true, data: { ...res, file: target } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}
