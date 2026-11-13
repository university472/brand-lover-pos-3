

import pool from '../db/pool.js'
import { postStockMovement } from '../services/stock.service.js'
import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'
import { postCustomerLedger } from '../services/customer.ledger.js'

import { localToday } from '../services/date.util.js'
async function nextReturnNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(return_no,'SR-','') AS UNSIGNED)),0)+1 AS next
       FROM sales_returns WHERE return_no LIKE 'SR-%'`
  )
  return 'SR-' + String(r.next).padStart(4, '0')
}
async function nextRefundVoucherNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no,'PV-','') AS UNSIGNED)),0)+1 AS next
       FROM vouchers WHERE voucher_type='payment' AND voucher_no LIKE 'PV-%'`
  )
  return 'PV-' + String(r.next).padStart(3, '0')
}

export function registerReturnsHandlers(ipcMain) {
  // Find a bill and show each line's remaining returnable quantity.
  ipcMain.handle(
    'returns:lookup-sale',
    async (_e, { actingUserId, invoiceNo } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const inv = (invoiceNo || '').trim()
        if (!inv) return { ok: false, error: 'Enter an invoice number.' }
        const [[sale]] = await pool.query(
          `SELECT s.id, s.invoice_no, s.invoice_date, s.payment_type, s.net_total, s.amount_received,
                (s.net_total - s.amount_received) AS outstanding,
                s.customer_id, c.name AS customer, c.code AS customer_code, c.is_walk_in,
                c.current_balance AS customer_balance,
                sm.name AS salesman, u.full_name AS operator
           FROM sales s
           JOIN customers c ON c.id = s.customer_id
           LEFT JOIN users u ON u.id = s.created_by
           LEFT JOIN salesmen sm ON sm.id = s.salesman_id
          WHERE s.invoice_no = ? AND s.is_cancelled = 0
          ORDER BY s.id DESC LIMIT 1`,
          [inv]
        )
        if (!sale)
          return { ok: false, error: `No bill found for invoice #${inv}.` }

        const [items] = await pool.query(
          `SELECT si.id AS sale_item_id, si.item_id, i.item_code, si.description,
                si.quantity, si.net_amount,
                COALESCE((SELECT SUM(sri.quantity) FROM sales_return_items sri
                           WHERE sri.sale_item_id = si.id), 0) AS returned_qty
           FROM sale_items si JOIN items i ON i.id = si.item_id
          WHERE si.sale_id = ?`,
          [sale.id]
        )

        const lines = items.map((it) => {
          const perUnit =
            Number(it.quantity) > 0
              ? +(Number(it.net_amount) / Number(it.quantity)).toFixed(2)
              : 0
          const remaining = +(
            Number(it.quantity) - Number(it.returned_qty)
          ).toFixed(2)
          return { ...it, per_unit: perUnit, remaining }
        })
        return { ok: true, data: { sale, lines } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ✅ UPDATED — find bills that contain a given item code/barcode (with filters)
  ipcMain.handle(
    'returns:find-bills-by-item',
    async (
      _e,
      { actingUserId, code, from, to, dateFrom, dateTo, paymentType, amountMin, amountMax } = {}
    ) => {
      // The Returns screen sends dateFrom/dateTo + amountMin/amountMax; this handler only read
      // from/to and had no amount filter, so the date and amount filters silently did nothing.
      from = from || dateFrom
      to = to || dateTo
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const c = (code || '').trim()
        if (!c) return { ok: false, error: 'Enter a product code / barcode.' }
        const [[item]] = await pool.query(
          `SELECT id, item_code, name FROM items WHERE item_code = ? OR barcode = ? LIMIT 1`,
          [c, c]
        )
        if (!item)
          return { ok: false, error: `No product found for code "${c}".` }

        let where = 'WHERE si.item_id = ? AND s.is_cancelled = 0'
        const args = [item.id]
        if (from) {
          where += ' AND s.invoice_date >= ?'
          args.push(from)
        }
        if (to) {
          where += ' AND s.invoice_date <= ?'
          args.push(to)
        }
        if (paymentType) {
          where += ' AND s.payment_type = ?'
          args.push(paymentType)
        }
        // bill amount range (inclusive); swapped automatically if entered the wrong way round
        const lo = amountMin === undefined || amountMin === '' ? null : Number(amountMin)
        const hi = amountMax === undefined || amountMax === '' ? null : Number(amountMax)
        const [min, max] = lo !== null && hi !== null && lo > hi ? [hi, lo] : [lo, hi]
        if (min !== null && !Number.isNaN(min)) {
          where += ' AND s.net_total >= ?'
          args.push(min)
        }
        if (max !== null && !Number.isNaN(max)) {
          where += ' AND s.net_total <= ?'
          args.push(max)
        }

        const [rows] = await pool.query(
          `SELECT s.id, s.invoice_no, s.invoice_date, s.invoice_time, s.payment_type, s.net_total,
                  c.name AS customer, c.code AS customer_code, c.telephone,
                  si.quantity, si.rate,
                  COALESCE((SELECT SUM(sri.quantity) FROM sales_return_items sri
                             WHERE sri.sale_item_id = si.id), 0) AS returned_qty
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN customers c ON c.id = s.customer_id
            ${where}
            ORDER BY s.invoice_date DESC, s.id DESC
            LIMIT 100`,
          args
        )
        const bills = rows.map((r) => ({
          ...r,
          remaining: +(Number(r.quantity) - Number(r.returned_qty)).toFixed(2)
        }))
        return { ok: true, data: { item, bills } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // All credit bills for a customer
  ipcMain.handle(
    'returns:credit-bills',
    async (_e, { actingUserId, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        // only bills that still have something left to return (fully returned bills hidden)
        let where = `WHERE s.payment_type='credit' AND s.is_cancelled = 0
          AND (SELECT COALESCE(SUM(si.quantity),0) FROM sale_items si WHERE si.sale_id = s.id) >
              (SELECT COALESCE(SUM(sri.quantity),0) FROM sales_return_items sri
                 JOIN sales_returns rr ON rr.id = sri.return_id WHERE rr.sale_id = s.id) + 0.0001`
        const args = []
        if (search && search.trim()) {
          where +=
            ' AND (c.name LIKE ? OR c.code LIKE ? OR s.invoice_no LIKE ?)'
          const x = `%${search.trim()}%`
          args.push(x, x, x)
        }
        const [rows] = await pool.query(
          `SELECT s.id, s.invoice_no, s.invoice_date, s.net_total,
                (s.net_total - s.amount_received) AS outstanding,
                c.name AS customer, c.code AS customer_code, c.current_balance
           FROM sales s JOIN customers c ON c.id = s.customer_id
          ${where}
          ORDER BY s.invoice_date DESC, s.id DESC LIMIT 100`,
          args
        )
        return { ok: true, data: rows }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // Process a (whole or partial) return atomically.
  ipcMain.handle('returns:create', async (_e, payload) => {
    const conn = await pool.getConnection()
    try {
      await authorize(payload.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const {
        saleId,
        lines = [],
        refundMode = 'cash',
        accountId = null,
        reason = '',
        createdBy = null
      } = payload

      const [[sale]] = await conn.query(
        `SELECT s.*, c.is_walk_in, c.name AS customer_name, c.code AS customer_code,
                sm.name AS salesman_name
           FROM sales s
           JOIN customers c ON c.id = s.customer_id
           LEFT JOIN salesmen sm ON sm.id = s.salesman_id
          WHERE s.id = ? AND s.is_cancelled = 0`,
        [saleId]
      )
      if (!sale) throw new Error('Original bill not found.')
      const active = (lines || []).filter((l) => Number(l.quantity) > 0)
      if (active.length === 0)
        throw new Error('Enter a quantity to return on at least one line.')

      const resolved = []
      let total = 0
      for (const ln of active) {
        const [[si]] = await conn.query(
          `SELECT si.*, i.average_cost, i.item_code
             FROM sale_items si JOIN items i ON i.id = si.item_id
            WHERE si.id = ? AND si.sale_id = ?`,
          [ln.saleItemId, saleId]
        )
        if (!si) throw new Error('A line does not belong to this bill.')
        const [[{ rq }]] = await conn.query(
          `SELECT COALESCE(SUM(quantity),0) AS rq FROM sales_return_items WHERE sale_item_id = ?`,
          [ln.saleItemId]
        )
        const remaining = Number(si.quantity) - Number(rq)
        const qty = Number(ln.quantity)
        if (qty > remaining + 1e-9)
          throw new Error(
            `Cannot return ${qty} — only ${remaining} left for ${si.description}.`
          )
        const perUnit =
          Number(si.quantity) > 0
            ? Number(si.net_amount) / Number(si.quantity)
            : 0
        const amount = +(qty * perUnit).toFixed(2)
        total += amount
        resolved.push({
          saleItemId: si.id,
          itemId: si.item_id,
          itemCode: si.item_code,
          description: si.description,
          qty,
          rate: +perUnit.toFixed(2),
          amount,
          avgCost: Number(si.average_cost) || 0
        })
      }
      total = +total.toFixed(2)

      const mode = ['cash', 'bank', 'credit_adjust'].includes(refundMode)
        ? refundMode
        : 'cash'
      if (mode === 'credit_adjust' && sale.is_walk_in)
        throw new Error(
          'Walk-In has no credit account — refund by cash or bank.'
        )
      if (mode !== 'credit_adjust' && !accountId)
        throw new Error('Choose the account to refund from.')

      const date = localToday()
      const returnNo = await nextReturnNo(conn)

      const [retRes] = await conn.query(
        `INSERT INTO sales_returns
           (return_no, sale_id, customer_id, return_date, total_amount, refund_mode, refund_amount, account_id, reason, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnNo,
          saleId,
          sale.customer_id,
          date,
          total,
          mode,
          total,
          mode === 'credit_adjust' ? null : accountId,
          reason || null,
          createdBy
        ]
      )
      const returnId = retRes.insertId

      for (const r of resolved) {
        await conn.query(
          `INSERT INTO sales_return_items (return_id, sale_item_id, item_id, quantity, rate, amount)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [returnId, r.saleItemId, r.itemId, r.qty, r.rate, r.amount]
        )
        await postStockMovement(conn, {
          itemId: r.itemId,
          movementType: 'sale_return',
          quantityIn: r.qty,
          unitCost: r.avgCost,
          referenceType: 'sale_return',
          referenceId: returnId,
          movementDate: date
        })
      }

      // ✅ Track account name for the receipt
      let accountName = null

      // ✅ UPDATED — Refund block: both branches now write ledger
      if (mode === 'credit_adjust') {
        await conn.query(
          `UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`,
          [total, sale.customer_id]
        )
        await postCustomerLedger(conn, {
          customerId: sale.customer_id,
          entryType: 'return_credit_offset',
          credit: total,
          referenceType: 'return',
          referenceId: returnId,
          description: `Return ${returnNo} — credit reduced (inv #${sale.invoice_no})`,
          date,
          createdBy
        })
      } else {
        const [[acct]] = await conn.query(
          `SELECT name, type FROM accounts WHERE id = ?`,
          [accountId]
        )
        const method = acct?.type === 'bank' ? 'bank' : 'cash'
        accountName = acct?.name || null
        const vno = await nextRefundVoucherNo(conn)
        await conn.query(
          `INSERT INTO vouchers
             (voucher_no, voucher_type, party_type, party_id, account_id, amount,
              payment_method, reference, description, voucher_date, created_by)
           VALUES (?, 'payment', ?, ?, ?, ?, ?, 'return', ?, ?, ?)`,
          [
            vno,
            sale.is_walk_in ? 'none' : 'customer',
            sale.is_walk_in ? null : sale.customer_id,
            accountId,
            total,
            method,
            `Refund for return ${returnNo} (inv #${sale.invoice_no})`,
            date,
            createdBy
          ]
        )
        await conn.query(
          `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
          [total, accountId]
        )
        // Named customer: record both sides so history shows the money paid back (balance stays same).
        if (!sale.is_walk_in) {
          await postCustomerLedger(conn, {
            customerId: sale.customer_id,
            entryType: 'return_credit_offset',
            credit: total,
            referenceType: 'return',
            referenceId: returnId,
            description: `Return ${returnNo} — goods back (inv #${sale.invoice_no})`,
            date,
            createdBy
          })
          await postCustomerLedger(conn, {
            customerId: sale.customer_id,
            entryType: 'return_cash_refund',
            debit: total,
            referenceType: 'return',
            referenceId: returnId,
            description: `Return ${returnNo} — ${method} refund paid`,
            date,
            createdBy
          })
        }
      }

      await conn.commit()

      return {
        ok: true,
        data: {
          returnId,
          returnNo,
          date,
          total,
          refundMode: mode,
          invoiceNo: sale.invoice_no,
          customerId: sale.customer_id,
          customer: sale.customer_name,
          customerCode: sale.customer_code,
          isWalkIn: !!sale.is_walk_in,
          salesman: sale.salesman_name,
          accountName,
          reason: reason || null,
          lines: resolved.map((r) => ({
            itemId: r.itemId,
            itemCode: r.itemCode,
            name: r.description,
            quantity: r.qty,
            rate: r.rate,
            amount: r.amount
          }))
        }
      }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  ipcMain.handle(
    'returns:list',
    async (_e, { actingUserId, limit = 60, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        // date filter + which items / how many pieces came back (client: "kitne product wapis")
        let where = 'WHERE 1=1'
        const args = []
        if (from) {
          where += ' AND r.return_date >= ?'
          args.push(from)
        }
        if (to) {
          where += ' AND r.return_date <= ?'
          args.push(to)
        }
        const [rows] = await pool.query(
          `SELECT r.id, r.return_no, r.return_date, r.total_amount, r.refund_mode, r.refund_amount,
                r.reason, s.invoice_no, c.name AS customer, a.name AS account_name, u.full_name AS by_user,
                (SELECT GROUP_CONCAT(CONCAT(i.name, ' × ',
                          TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM sri.quantity)))
                          ORDER BY sri.id SEPARATOR ', ')
                   FROM sales_return_items sri JOIN items i ON i.id = sri.item_id
                  WHERE sri.return_id = r.id) AS items,
                (SELECT COALESCE(SUM(sri.quantity),0) FROM sales_return_items sri
                  WHERE sri.return_id = r.id) AS total_qty
           FROM sales_returns r
           JOIN sales s ON s.id = r.sale_id
           JOIN customers c ON c.id = r.customer_id
           LEFT JOIN accounts a ON a.id = r.account_id
           LEFT JOIN users u ON u.id = r.created_by
          ${where}
          ORDER BY r.id DESC LIMIT ?`,
          [...args, from || to ? 1000 : Number(limit)]
        )
        return { ok: true, data: rows }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )
}
