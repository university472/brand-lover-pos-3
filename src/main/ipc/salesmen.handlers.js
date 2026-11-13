import pool from '../db/pool.js'
import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'

export function registerSalesmenHandlers(ipcMain) {
  // Public (any authenticated screen) — used by CounterSale dropdown.
  // Always returns active salesmen only.
  ipcMain.handle('salesmen:list', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT id, name, phone, is_active
           FROM salesmen
          WHERE is_active = 1
          ORDER BY name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Admin only — includes inactive too, for the Settings management panel.
  ipcMain.handle('salesmen:list-admin', async (_e, { actingUserId } = {}) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      const [rows] = await pool.query(
        `SELECT id, name, phone, is_active, created_at
             FROM salesmen
            ORDER BY is_active DESC, name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('salesmen:create', async (_e, p) => {
    try {
      await authorize(p?.actingUserId, ADMIN_ROLES)
      if (!p?.name || !p.name.trim())
        return { ok: false, error: 'Salesman name is required.' }
      const [res] = await pool.query(
        `INSERT INTO salesmen (name, phone) VALUES (?, ?)`,
        [p.name.trim(), (p.phone || '').trim() || null]
      )
      return { ok: true, data: { id: res.insertId } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('salesmen:update', async (_e, p) => {
    try {
      await authorize(p?.actingUserId, ADMIN_ROLES)
      if (!p?.id) return { ok: false, error: 'Salesman id is required.' }
      if (!p?.name || !p.name.trim())
        return { ok: false, error: 'Salesman name is required.' }
      await pool.query(`UPDATE salesmen SET name = ?, phone = ? WHERE id = ?`, [
        p.name.trim(),
        (p.phone || '').trim() || null,
        p.id
      ])
      return { ok: true, data: { saved: true } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('salesmen:toggle', async (_e, p) => {
    try {
      await authorize(p?.actingUserId, ADMIN_ROLES)
      if (!p?.id) return { ok: false, error: 'Salesman id is required.' }
      await pool.query(
        `UPDATE salesmen SET is_active = NOT is_active WHERE id = ?`,
        [p.id]
      )
      return { ok: true, data: { toggled: true } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('salesmen:delete', async (_e, p) => {
    try {
      await authorize(p?.actingUserId, ADMIN_ROLES)
      if (!p?.id) return { ok: false, error: 'Salesman id is required.' }
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM sales WHERE salesman_id = ?`,
        [p.id]
      )
      if (Number(cnt) > 0)
        return {
          ok: false,
          error: `This salesman has ${cnt} bill(s) on record — deactivate instead of deleting.`
        }
      await pool.query(`DELETE FROM salesmen WHERE id = ?`, [p.id])
      return { ok: true, data: { deleted: true } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}
