import pool from '../db/pool.js'
import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'

export function registerCompanyHandlers(ipcMain) {
  ipcMain.handle('company:list', async () => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, licensed_to FROM companies ORDER BY name'
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('company:financial-years', async () => {
    try {
      const [rows] = await pool.query(
        'SELECT id, label, start_date, end_date, is_default FROM financial_years ORDER BY start_date DESC'
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Full company/receipt profile (used by receipt + settings)
  ipcMain.handle('company:get-profile', async () => {
    try {
      const [[c]] = await pool.query(
        `SELECT id, name, receipt_header, receipt_tagline, receipt_footer,
                payment_qr_image, phone, address, currency
           FROM companies WHERE id = 1`
      )
      return { ok: true, data: c || null }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Owner updates receipt header/tagline/footer/phone + payment QR image
  ipcMain.handle('company:update-profile', async (_e, p) => {
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      // Only update the image when the caller sends the field (undefined = leave as-is)
      if (p.paymentQrImage !== undefined) {
        await pool.query(
          `UPDATE companies SET
             receipt_header = ?, receipt_tagline = ?, receipt_footer = ?,
             phone = ?, payment_qr_image = ? WHERE id = 1`,
          [
            p.receiptHeader || null,
            p.receiptTagline || null,
            p.receiptFooter || null,
            p.phone || null,
            p.paymentQrImage || null
          ]
        )
      } else {
        await pool.query(
          `UPDATE companies SET
             receipt_header = ?, receipt_tagline = ?, receipt_footer = ?, phone = ? WHERE id = 1`,
          [
            p.receiptHeader || null,
            p.receiptTagline || null,
            p.receiptFooter || null,
            p.phone || null
          ]
        )
      }
      // Address (printed on the receipt) — only when the caller sends it, so screens that
      // save just the QR image (Counter Sale) never wipe it.
      if (p.address !== undefined) {
        await pool.query(`UPDATE companies SET address = ? WHERE id = 1`, [
          String(p.address || '').trim() || null
        ])
      }
      return { ok: true, data: { saved: true } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}
