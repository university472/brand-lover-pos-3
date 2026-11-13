import pool from '../db/pool.js'
import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'

import { localToday } from '../services/date.util.js'
async function nextExpenseNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no,'EV-','') AS UNSIGNED)),0)+1 AS next
       FROM vouchers WHERE voucher_type='expense' AND voucher_no LIKE 'EV-%'`
  )
  return 'EV-' + String(r.next).padStart(4, '0')
}

export function registerExpensesHandlers(ipcMain) {
  // ---- categories ----
  ipcMain.handle('expenses:categories', async (_e, { actingUserId } = {}) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      // Self-heal: the old reset script truncated this table without re-adding the defaults,
      // leaving Payments with an EMPTY category filter/drop-down. Only when the table is
      // completely empty (never if the owner deleted/renamed some), restore migration 007's list.
      const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM expense_categories`)
      if (Number(n) === 0) {
        await pool.query(
          `INSERT IGNORE INTO expense_categories (name) VALUES
             ('General'), ('Utilities'), ('Salary'), ('Advance'), ('Guest / Hospitality'),
             ('Rent'), ('Transport'), ('Maintenance')`
        )
      }
      const [rows] = await pool.query(
        `SELECT id, name FROM expense_categories WHERE is_active = 1 ORDER BY name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(
    'expenses:add-category',
    async (_e, { actingUserId, name }) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        if (!name || !name.trim())
          return { ok: false, error: 'Category name is required.' }
        const [res] = await pool.query(
          `INSERT INTO expense_categories (name) VALUES (?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), is_active = 1`,
          [name.trim()]
        )
        return { ok: true, data: { id: res.insertId } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle('expenses:accounts', async (_e, { actingUserId } = {}) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      const [rows] = await pool.query(
        `SELECT id, name, type, current_balance FROM accounts WHERE is_active = 1 ORDER BY type, name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ---- create expense (money out of an account) ----
  ipcMain.handle('expenses:create', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const amount = +(Number(p.amount) || 0).toFixed(2)
      if (amount <= 0) throw new Error('Enter an amount greater than 0.')
      if (!p.accountId)
        throw new Error('Choose the account the money came from.')
      const date = p.date || localToday()
      const [[acct]] = await conn.query(
        `SELECT type FROM accounts WHERE id = ?`,
        [p.accountId]
      )
      if (!acct) throw new Error('Account not found.')
      const method = acct.type === 'bank' ? 'bank' : 'cash'
      const vno = await nextExpenseNo(conn)
      const [res] = await conn.query(
        `INSERT INTO vouchers
           (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method,
            reference, expense_category_id, payee, description, voucher_date, created_by)
         VALUES (?, 'expense', 'none', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vno,
          p.accountId,
          amount,
          method,
          p.reference || null,
          p.categoryId || null,
          p.payee || null,
          p.description || null,
          date,
          p.actingUserId
        ]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
        [amount, p.accountId]
      )
      await conn.commit()
      return { ok: true, data: { id: res.insertId, voucherNo: vno } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // ---- edit expense (reverse old, apply new) ----
  ipcMain.handle('expenses:update', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const [[v]] = await conn.query(
        `SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'expense' FOR UPDATE`,
        [p.id]
      )
      if (!v) throw new Error('Expense not found.')
      const newAmount = +(Number(p.amount) || 0).toFixed(2)
      if (newAmount <= 0) throw new Error('Amount must be greater than 0.')
      const newAccountId = p.accountId || v.account_id
      const newDate = p.date || v.voucher_date

      // reverse old (add back), apply new (deduct)
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
        [v.amount, v.account_id]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
        [newAmount, newAccountId]
      )
      const [[acct]] = await conn.query(
        `SELECT type FROM accounts WHERE id = ?`,
        [newAccountId]
      )
      const method = acct?.type === 'bank' ? 'bank' : 'cash'
      await conn.query(
        `UPDATE vouchers SET amount=?, account_id=?, payment_method=?, expense_category_id=?,
           payee=?, reference=?, description=?, voucher_date=? WHERE id=?`,
        [
          newAmount,
          newAccountId,
          method,
          p.categoryId ?? v.expense_category_id,
          p.payee ?? v.payee,
          p.reference ?? v.reference,
          p.description ?? v.description,
          newDate,
          p.id
        ]
      )
      await conn.commit()
      return { ok: true, data: { id: p.id } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // ---- delete expense (restore the account) ----
  ipcMain.handle('expenses:delete', async (_e, { actingUserId, id }) => {
    const conn = await pool.getConnection()
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const [[v]] = await conn.query(
        `SELECT * FROM vouchers WHERE id = ? AND voucher_type = 'expense' FOR UPDATE`,
        [id]
      )
      if (!v) throw new Error('Expense not found.')
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
        [v.amount, v.account_id]
      )
      await conn.query(`DELETE FROM vouchers WHERE id = ?`, [id])
      await conn.commit()
      return { ok: true, data: { deleted: true } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // ---- list + totals (by date range, category, search) ----
  ipcMain.handle(
    'expenses:list',
    async (_e, { actingUserId, from, to, categoryId, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        let where = `WHERE v.voucher_type = 'expense'`
        const args = []
        if (from) {
          where += ' AND v.voucher_date >= ?'
          args.push(from)
        }
        if (to) {
          where += ' AND v.voucher_date <= ?'
          args.push(to)
        }
        if (categoryId) {
          where += ' AND v.expense_category_id = ?'
          args.push(categoryId)
        }
        if (search && search.trim()) {
          where +=
            ' AND (v.payee LIKE ? OR v.description LIKE ? OR v.voucher_no LIKE ?)'
          const s = `%${search.trim()}%`
          args.push(s, s, s)
        }
        const [rows] = await pool.query(
          `SELECT v.id, v.voucher_no, v.amount, v.payee, v.reference, v.description,
                v.voucher_date, v.payment_method, v.account_id, v.expense_category_id,
                a.name AS account_name, ec.name AS category, u.full_name AS by_user
           FROM vouchers v
           LEFT JOIN accounts a ON a.id = v.account_id
           LEFT JOIN expense_categories ec ON ec.id = v.expense_category_id
           LEFT JOIN users u ON u.id = v.created_by
          ${where}
          ORDER BY v.voucher_date DESC, v.id DESC LIMIT 400`,
          args
        )
        const total = rows.reduce((s, r) => s + Number(r.amount), 0)
        // category breakdown for the same filter
        const [byCat] = await pool.query(
          `SELECT COALESCE(ec.name,'Uncategorized') AS category, COALESCE(SUM(v.amount),0) AS total, COUNT(*) AS cnt
           FROM vouchers v LEFT JOIN expense_categories ec ON ec.id = v.expense_category_id
          ${where} GROUP BY ec.name ORDER BY total DESC`,
          args
        )
        return { ok: true, data: { rows, total: +total.toFixed(2), byCat } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )
}
