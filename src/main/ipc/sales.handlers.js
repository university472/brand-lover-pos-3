import pool from '../db/pool.js'
import { postStockMovement } from '../services/stock.service.js'
import {
  authorize,
  ADMIN_ROLES,
  ALL_ROLES,
  getSessionUserId
} from '../services/auth.guard.js'
import { postCustomerLedger } from '../services/customer.ledger.js'
import {
  applyRemainingDue,
  assertCreditLimit
} from '../services/credit.allocation.js'
import { creditGivenInRange } from '../services/reconciliation.service.js'
import { lowStockAmong } from '../services/stock.alerts.js'

import { localToday } from '../services/date.util.js'
async function nextInvoiceNo(conn, type = 'counter') {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(invoice_no AS UNSIGNED)), 1000) + 1 AS next
       FROM sales WHERE invoice_type = ?`,
    [type]
  )
  return String(r.next)
}
async function nextReceiptVoucherNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no, 'RV-', '') AS UNSIGNED)), 0) + 1 AS next
       FROM vouchers WHERE voucher_type = 'receipt' AND voucher_no LIKE 'RV-%'`
  )
  return 'RV-' + String(r.next).padStart(3, '0')
}

// mode 'cancel' → keep the credit_sale row and post a reversing adjustment (audit trail of a
//                 cancelled bill).
// mode 'edit'   → the bill's ledger row is REWRITTEN in place by sales:update (same id, date
//                 and position, new amount/items) instead of "old row + reversal + new row".
//                 Here we only remove the extras earlier edits left behind (reversal rows and
//                 duplicate credit_sale rows — together they net to the old outstanding, which
//                 the balance update below takes out) and return the row to rewrite.
//                 Result: the Account Ledger shows ONE line for the bill with its NEW items.
async function reverseSalePostings(conn, sale, items, mode = 'cancel') {
  let keepLedgerId = null
  for (const li of items) {
    const [[cur]] = await conn.query(
      `SELECT average_cost FROM items WHERE id = ?`,
      [li.item_id]
    )
    await postStockMovement(conn, {
      itemId: li.item_id,
      movementType: 'adjustment',
      quantityIn: Number(li.quantity),
      unitCost: Number(cur?.average_cost) || 0,
      referenceType: 'sale_edit_reversal',
      referenceId: sale.id,
      movementDate: sale.invoice_date
    })
  }
  if (Number(sale.amount_received) > 0 && sale.payment_account_id) {
    await conn.query(
      `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
      [Number(sale.amount_received), sale.payment_account_id]
    )
  }
  await conn.query(
    `DELETE FROM vouchers
      WHERE voucher_type = 'receipt'
        AND (sale_id = ? OR (sale_id IS NULL AND reference = ?))`,
    [sale.id, `Invoice ${sale.invoice_no}`]
  )
  const origOutstanding = Number(sale.net_total) - Number(sale.amount_received)
  if (mode === 'edit') {
    // Scoped to THIS bill's customer: sale ids restart after scripts/reset-transactions.js
    // (TRUNCATE sales), and orphan ledger rows of deleted customers still carry old ids.
    const [[first]] = await conn.query(
      `SELECT id FROM customer_ledger
        WHERE customer_id = ? AND reference_id = ?
          AND reference_type = 'sale' AND entry_type = 'credit_sale'
        ORDER BY id LIMIT 1`,
      [sale.customer_id, sale.id]
    )
    keepLedgerId = first?.id || null
    await conn.query(
      `DELETE FROM customer_ledger
        WHERE customer_id = ? AND reference_id = ? AND id <> ?
          AND ((reference_type = 'sale' AND entry_type = 'credit_sale')
            OR (reference_type = 'sale_edit_reversal' AND entry_type = 'adjustment'))`,
      [sale.customer_id, sale.id, keepLedgerId || 0]
    )
  }
  if (origOutstanding > 0 && !sale.is_walk_in) {
    await conn.query(
      `UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`,
      [origOutstanding, sale.customer_id]
    )
    if (mode !== 'edit') await postCustomerLedger(conn, {
      customerId: sale.customer_id,
      entryType: 'adjustment',
      credit: origOutstanding,
      referenceType: 'sale_edit_reversal',
      referenceId: sale.id,
      description: `Reversed credit of invoice #${sale.invoice_no}`,
      date: sale.invoice_date
    })
  }
  return { keepLedgerId }
}

export function registerSalesHandlers(ipcMain) {
  ipcMain.handle('sales:next-invoice-no', async () => {
    try {
      return {
        ok: true,
        data: { invoiceNo: await nextInvoiceNo(pool, 'counter') }
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:search-items', async (_e, { term }) => {
    try {
      const s = `%${(term || '').trim()}%`
      const [rows] = await pool.query(
        `SELECT id, item_code, name, selling_price, discount_percent, unit,
                current_stock, average_cost, barcode, low_stock_threshold, reorder_quantity
           FROM items
          WHERE is_active = 1 AND (name LIKE ? OR item_code LIKE ? OR barcode LIKE ?)
          ORDER BY name LIMIT 25`,
        [s, s, s]
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:item-by-code', async (_e, { code }) => {
    try {
      const c = (code || '').trim()
      const [rows] = await pool.query(
        `SELECT id, item_code, name, selling_price, discount_percent, unit,
                current_stock, average_cost, barcode, low_stock_threshold, reorder_quantity
           FROM items WHERE is_active = 1 AND (item_code = ? OR barcode = ?) LIMIT 1`,
        [c, c]
      )
      return { ok: true, data: rows[0] || null }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:customers', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT id, code, name, telephone, address, current_balance,
                credit_limit, is_walk_in
           FROM customers WHERE is_active = 1 ORDER BY is_walk_in DESC, name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:search-customers', async (_e, { term } = {}) => {
    try {
      const t = (term || '').trim()
      if (!t) {
        const [rows] = await pool.query(
          `SELECT id, code, name, telephone, address, current_balance,
                  credit_limit, is_walk_in
             FROM customers WHERE is_active = 1
            ORDER BY name LIMIT 50`
        )
        return { ok: true, data: rows }
      }
      const s = `%${t}%`
      const [rows] = await pool.query(
        `SELECT id, code, name, telephone, address, current_balance,
                credit_limit, is_walk_in
           FROM customers
          WHERE is_active = 1 AND (name LIKE ? OR code LIKE ?)
          ORDER BY name LIMIT 50`,
        [s, s]
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:customer-summary', async (_e, { customerId } = {}) => {
    try {
      const [[row]] = await pool.query(
        `SELECT COALESCE(SUM(net_total),0)         AS total_purchases,
                COALESCE(SUM(amount_received),0)   AS paid_at_counter,
                COUNT(*)                           AS bills
           FROM sales
          WHERE customer_id = ? AND is_cancelled = 0`,
        [customerId]
      )
      // Paid = money at the counter + later repayments; returns are their own line; Due = the
      // customer's real balance (after repayments AND returns). Before, Paid/Due ignored both.
      const [[rep]] = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM vouchers
          WHERE voucher_type = 'receipt' AND reference = 'repayment'
            AND party_type = 'customer' AND party_id = ?`,
        [customerId]
      )
      const [[ret]] = await pool.query(
        `SELECT COALESCE(SUM(r.total_amount),0) AS total
           FROM sales_returns r JOIN sales s ON s.id = r.sale_id
          WHERE s.customer_id = ? AND s.is_cancelled = 0`,
        [customerId]
      )
      const [[cust]] = await pool.query(`SELECT current_balance FROM customers WHERE id = ?`, [
        customerId
      ])
      const r2 = (n) => +Number(n || 0).toFixed(2)
      return {
        ok: true,
        data: {
          bills: Number(row.bills),
          total_purchases: r2(row.total_purchases),
          total_returns: r2(ret.total),
          total_paid: r2(Number(row.paid_at_counter) + Number(rep.total)),
          total_due: r2(cust?.current_balance)
        }
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:create-customer', async (_e, p) => {
    try {
      if (!p.name || !p.name.trim())
        return { ok: false, error: 'Customer name is required.' }
      let code = (p.code || '').trim()
      if (code) {
        const [dupe] = await pool.query(
          'SELECT id FROM customers WHERE code = ? LIMIT 1',
          [code]
        )
        if (dupe.length)
          return { ok: false, error: 'That customer code is already in use.' }
      } else {
        const [[r]] = await pool.query(
          `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 12001000) + 1 AS next FROM customers`
        )
        code = String(r.next)
      }
      const bal = Number(p.openingBalance) || 0
      const limit = Number(p.creditLimit) || 0
      const [res] = await pool.query(
        `INSERT INTO customers
           (code, name, telephone, address, opening_balance, current_balance, credit_limit, is_walk_in)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          code,
          p.name.trim(),
          p.telephone || null,
          p.address || null,
          bal,
          bal,
          limit
        ]
      )
      return { ok: true, data: { id: res.insertId, code } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:next-customer-code', async () => {
    try {
      const [[r]] = await pool.query(
        `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 12001000) + 1 AS next FROM customers`
      )
      return { ok: true, data: { code: String(r.next) } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:customer-by-code', async (_e, { code }) => {
    try {
      const c = (code || '').trim()
      if (!c) return { ok: false, error: 'Enter a customer code.' }
      const [rows] = await pool.query(
        `SELECT id, code, name, telephone, address, current_balance,
                credit_limit, is_walk_in
           FROM customers WHERE code = ? AND is_active = 1 LIMIT 1`,
        [c]
      )
      if (!rows.length)
        return { ok: false, error: 'No customer found with that code.' }
      return { ok: true, data: rows[0] }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:accounts', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT id, name, type, current_balance FROM accounts WHERE is_active = 1 ORDER BY type, name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ---------------- Post a sale (atomic) ----------------
  ipcMain.handle('sales:create', async (_e, payload) => {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      // ✅ Phase A6 — dueDate added to destructure
      const {
        invoiceType = 'counter',
        paymentType = 'cash',
        customerId,
        accountId,
        invoiceDate,
        dueDate = null, // ✅ Phase A6 — promise-to-pay date
        lines = [],
        overallDiscount = 0,
        deliveryCharges = 0,
        amountReceived = 0,
        remarks = '',
        salesmanId = null
      } = payload
      // Operator = the logged-in user (main-process session), not a value sent by the window.
      const createdBy = getSessionUserId() || payload.createdBy || null

      if (!customerId) throw new Error('Select a customer.')
      if (!accountId) throw new Error('Select a payment account.')
      if (!Array.isArray(lines) || lines.length === 0)
        throw new Error('Add at least one item.')

      const [[cust]] = await conn.query(
        `SELECT id, is_walk_in, current_balance, credit_limit
           FROM customers WHERE id = ? AND is_active = 1 FOR UPDATE`,
        [customerId]
      )
      if (!cust) throw new Error('Customer not found.')

      let subTotal = 0
      const resolved = []
      for (const ln of lines) {
        const [[it]] = await conn.query(
          `SELECT id, name, unit, average_cost FROM items WHERE id = ? AND is_active = 1`,
          [ln.itemId]
        )
        if (!it) throw new Error(`Item not found (id ${ln.itemId}).`)
        const qty = Number(ln.quantity) || 0
        const rate = Number(ln.rate) || 0
        if (qty <= 0)
          throw new Error(`Quantity must be greater than 0 for ${it.name}.`)
        const gross = +(qty * rate).toFixed(2)

        const dv = Number(ln.discountValue ?? ln.discountPercent) || 0
        if (!(rate > 0)) throw new Error(`Rate must be greater than 0 for ${it.name}.`)
        if (dv < 0) throw new Error(`Discount cannot be negative for ${it.name}.`)
        if (ln.discountMode !== 'amount' && dv > 100)
          throw new Error(`Discount cannot be more than 100% for ${it.name}.`)
        let discAmt, discPct
        if (ln.discountMode === 'amount') {
          discAmt = +Math.min(dv, gross).toFixed(2)
          discPct = gross > 0 ? +((discAmt / gross) * 100).toFixed(2) : 0
        } else {
          discPct = dv
          discAmt = +((gross * discPct) / 100).toFixed(2)
        }
        const net = +(gross - discAmt).toFixed(2)
        if (!(net > 0)) throw new Error(`Net amount must be greater than 0 for ${it.name}.`)

        subTotal += net
        resolved.push({
          it,
          qty,
          rate,
          gross,
          discPct,
          discAmt,
          net,
          description: ln.description || it.name,
          unit: ln.unit || it.unit
        })
      }
      subTotal = +subTotal.toFixed(2)
      const disc = Number(overallDiscount) || 0
      const delivery = Number(deliveryCharges) || 0
      const netTotal = +(subTotal - disc + delivery).toFixed(2)
      if (netTotal < 0) throw new Error('Net total cannot be negative.')

      const payType = ['cash', 'online', 'credit'].includes(paymentType)
        ? paymentType
        : 'cash'
      const tendered = Number(amountReceived) || 0
      const actualPaid = +Math.min(tendered, netTotal).toFixed(2)
      const change = +Math.max(0, tendered - netTotal).toFixed(2)
      const outstanding = +(netTotal - actualPaid).toFixed(2)

      if (payType === 'credit') {
        if (cust.is_walk_in)
          throw new Error('Credit sales need a named customer, not Walk-In.')
        // Part-payment at the counter is fine; a credit bill paid in FULL is a cash/online bill.
        if (outstanding <= 0.009)
          throw new Error('The whole bill is paid — use Cash or Online instead of Credit.')

        assertCreditLimit({
          creditLimit: cust.credit_limit,
          balanceWithoutBill: cust.current_balance,
          billOutstanding: outstanding
        })
      } else {
        if (outstanding > 0)
          throw new Error(
            'Cash/Online sales must be paid in full. Use Credit to leave a balance.'
          )
      }

      const date = invoiceDate || localToday()
      const time = new Date().toTimeString().slice(0, 8)
      const invoiceNo = await nextInvoiceNo(conn, invoiceType)

      // ✅ Phase A3 — salesman_id; ✅ Phase A6 — due_date
      const [saleRes] = await conn.query(
        `INSERT INTO sales
           (invoice_no, invoice_type, payment_type, customer_id, financial_year_id, invoice_date, invoice_time,
            sub_total, discount, delivery_charges, net_total, amount_received, cash_back,
            payment_account_id, is_posted, is_cancelled, remarks, created_by, salesman_id, due_date)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)`,
        [
          invoiceNo,
          invoiceType,
          payType,
          customerId,
          date,
          time,
          subTotal,
          disc,
          delivery,
          netTotal,
          actualPaid,
          change,
          accountId,
          remarks || null,
          createdBy,
          salesmanId || null,
          payType === 'credit' ? dueDate || null : null
        ]
      )
      const saleId = saleRes.insertId

      for (const r of resolved) {
        await conn.query(
          `INSERT INTO sale_items
             (sale_id, item_id, description, quantity, unit, rate, gross_amount,
              discount_percent, discount_amount, net_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            r.it.id,
            r.description,
            r.qty,
            r.unit,
            r.rate,
            r.gross,
            r.discPct,
            r.discAmt,
            r.net
          ]
        )
        await postStockMovement(conn, {
          itemId: r.it.id,
          movementType: 'sale',
          quantityOut: r.qty,
          unitCost: Number(r.it.average_cost) || 0,
          referenceType: 'sale',
          referenceId: saleId,
          movementDate: date
        })
      }

      if (actualPaid > 0) {
        const [[acct]] = await conn.query(
          `SELECT type FROM accounts WHERE id = ?`,
          [accountId]
        )
        const method =
          payType === 'online'
            ? 'bank'
            : acct?.type === 'bank'
              ? 'bank'
              : 'cash'
        const vno = await nextReceiptVoucherNo(conn)
        await conn.query(
          `INSERT INTO vouchers
             (voucher_no, voucher_type, party_type, party_id, account_id, amount,
              payment_method, reference, sale_id, description, voucher_date, created_by)
           VALUES (?, 'receipt', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            vno,
            cust.is_walk_in ? 'none' : 'customer',
            cust.is_walk_in ? null : customerId,
            accountId,
            actualPaid,
            method,
            `Invoice ${invoiceNo}`,
            saleId,
            `Sale receipt — invoice ${invoiceNo}`,
            date,
            createdBy
          ]
        )
        await conn.query(
          `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
          [actualPaid, accountId]
        )
      }

      if (outstanding > 0 && !cust.is_walk_in) {
        await conn.query(
          `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`,
          [outstanding, customerId]
        )
        await postCustomerLedger(conn, {
          customerId,
          entryType: 'credit_sale',
          debit: outstanding,
          referenceType: 'sale',
          referenceId: saleId,
          description: `Invoice #${invoiceNo}`,
          date,
          createdBy
        })
      }

      // Items of this bill that are now at/below their alert level → shown to the cashier.
      const lowStock = await lowStockAmong(conn, resolved.map((r) => r.it.id))
      await conn.commit()
      return {
        ok: true,
        data: {
          lowStock,
          saleId,
          invoiceNo,
          subTotal,
          discount: disc,
          deliveryCharges: delivery,
          netTotal,
          amountReceived: actualPaid,
          change,
          outstanding,
          paymentType: payType
        }
      }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // ✅ Phase A3 — salesman name via JOIN; ✅ Phase A6 — due_date + is_overdue
  ipcMain.handle('sales:list', async (_e, params) => {
    try {
      const { date, customerId, limit = 50 } = params || {}
      let where = 'WHERE s.is_cancelled = 0'
      const args = []
      if (date) {
        where += ' AND s.invoice_date = ?'
        args.push(date)
      }
      if (customerId) {
        where += ' AND s.customer_id = ?'
        args.push(customerId)
      }
      const [rows] = await pool.query(
        `SELECT s.id, s.invoice_no, s.invoice_type, s.payment_type,
                s.invoice_date, s.invoice_time, s.customer_id,
                s.net_total, s.amount_received, (s.net_total - s.amount_received) AS outstanding,
                s.due_date,
                CASE WHEN s.due_date IS NOT NULL
                       AND s.due_date < CURDATE()
                       AND (s.net_total - s.amount_received) > 0.009
                     THEN 1 ELSE 0 END AS is_overdue,
                c.name AS customer,
                sm.name AS salesman, u.full_name AS operator,
                sm.name AS salesman_name,
                (SELECT COUNT(*) FROM sales_returns sr WHERE sr.sale_id = s.id) AS return_count
           FROM sales s
           JOIN customers c ON c.id = s.customer_id
           LEFT JOIN users u ON u.id = s.created_by
           LEFT JOIN salesmen sm ON sm.id = s.salesman_id
          ${where}
          ORDER BY s.id DESC LIMIT ?`,
        [...args, Number(limit)]
      )
      // is_overdue from SQL ignores recoveries (amount_received never changes after the
      // sale); recompute it from what is really still unpaid (FIFO over recoveries).
      await applyRemainingDue(pool, rows)
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ✅ Phase A3 — salesman name + created_by_name; ✅ Phase A6 — is_overdue
  ipcMain.handle('sales:get', async (_e, { id }) => {
    try {
      const [[sale]] = await pool.query(
        `SELECT s.*, c.name AS customer, c.code AS customer_code, c.telephone,
                c.is_walk_in,
                a.name AS account_name,
                sm.name AS salesman, u.full_name AS operator,
                sm.name AS salesman_name,
                u.full_name AS created_by_name,
                CASE WHEN s.due_date IS NOT NULL
                       AND s.due_date < CURDATE()
                       AND (s.net_total - s.amount_received) > 0.009
                     THEN 1 ELSE 0 END AS is_overdue
           FROM sales s
           JOIN customers c ON c.id = s.customer_id
           LEFT JOIN accounts a ON a.id = s.payment_account_id
           LEFT JOIN users u ON u.id = s.created_by
           LEFT JOIN salesmen sm ON sm.id = s.salesman_id
          WHERE s.id = ?`,
        [id]
      )
      if (!sale) return { ok: false, error: 'Invoice not found.' }
      const [items] = await pool.query(
        `SELECT si.*, i.item_code FROM sale_items si JOIN items i ON i.id = si.item_id
          WHERE si.sale_id = ?`,
        [id]
      )
      const [[{ rc }]] = await pool.query(
        `SELECT COUNT(*) AS rc FROM sales_returns WHERE sale_id = ?`,
        [id]
      )

      // 🆕 Actual return records (not just the boolean flag) so View Details / customer
      // history can show what was returned, when, and how it was refunded.
      let returns = []
      if (rc > 0) {
        const [retRows] = await pool.query(
          `SELECT r.id, r.return_no, r.return_date, r.total_amount, r.refund_mode,
                  r.reason, a.name AS account_name, u.full_name AS by_user
             FROM sales_returns r
             LEFT JOIN accounts a ON a.id = r.account_id
             LEFT JOIN users u ON u.id = r.created_by
            WHERE r.sale_id = ?
            ORDER BY r.id DESC`,
          [id]
        )
        const returnIds = retRows.map((r) => r.id)
        const [itemRows] = await pool.query(
          `SELECT sri.return_id, sri.quantity, sri.rate, sri.amount,
                  i.item_code, si.description
             FROM sales_return_items sri
             JOIN items i ON i.id = sri.item_id
             JOIN sale_items si ON si.id = sri.sale_item_id
            WHERE sri.return_id IN (?)`,
          [returnIds]
        )
        returns = retRows.map((r) => ({
          ...r,
          items: itemRows
            .filter((it) => it.return_id === r.id)
            .map((it) => ({
              itemCode: it.item_code,
              name: it.description,
              quantity: Number(it.quantity),
              rate: Number(it.rate),
              amount: Number(it.amount)
            }))
        }))
      }

      await applyRemainingDue(pool, sale) // recovery-aware is_overdue + remaining_due
      return { ok: true, data: { ...sale, items, has_returns: rc > 0, returns } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(
    'sales:daily-payment-totals',
    async (_e, { actingUserId, date } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const d = date || localToday()
        const [rows] = await pool.query(
          `SELECT payment_type, COALESCE(SUM(net_total),0) AS total, COUNT(*) AS cnt
           FROM sales WHERE invoice_date = ? AND is_cancelled = 0
          GROUP BY payment_type`,
          [d]
        )
        const out = {
          date: d,
          cash: 0,
          online: 0,
          credit: 0,
          cashCnt: 0,
          onlineCnt: 0,
          creditCnt: 0
        }
        for (const r of rows) {
          out[r.payment_type] = Number(r.total)
          out[r.payment_type + 'Cnt'] = Number(r.cnt)
        }
        // "Today · Credit Given" = the ONE shared definition (unpaid part of credit bills),
        // identical to the Dashboard card and its drill-down.
        const cg = await creditGivenInRange(pool, d, d)
        out.creditBilled = out.credit
        out.credit = cg.total
        out.creditCnt = cg.bills

        // Money given back to customers today (returns refunded from cash/bank + "Refund to
        // customer"), so the Cash / Online cards can show sales MINUS refunds like the
        // Dashboard does (before they were gross and disagreed with the Dashboard).
        const [refRows] = await pool.query(
          `SELECT a.type AS acct_type, SUM(x.amt) AS total FROM (
             SELECT r.account_id, r.refund_amount AS amt FROM sales_returns r
              WHERE r.refund_mode <> 'credit_adjust' AND r.return_date = ?
             UNION ALL
             SELECT v.account_id, v.amount FROM vouchers v
              WHERE v.voucher_type = 'payment' AND v.reference = 'customer-refund' AND v.voucher_date = ?
           ) x JOIN accounts a ON a.id = x.account_id
           GROUP BY a.type`,
          [d, d]
        )
        out.cashSales = out.cash
        out.onlineSales = out.online
        out.cashRefund = 0
        out.onlineRefund = 0
        for (const r of refRows) {
          if (r.acct_type === 'bank') out.onlineRefund = Number(r.total)
          else out.cashRefund = Number(r.total)
        }
        out.cash = +(out.cashSales - out.cashRefund).toFixed(2)
        out.online = +(out.onlineSales - out.onlineRefund).toFixed(2)

        // Credit repayments (recoveries) collected today, reported SEPARATELY.
        // They used to be blended into cash/online and netted out of credit, which made
        // recoveries look like sales. cash / online / credit above stay sales-only.
        const [repayRows] = await pool.query(
          `SELECT a.type AS acct_type, COALESCE(SUM(v.amount),0) AS total, COUNT(*) AS cnt
             FROM vouchers v JOIN accounts a ON a.id = v.account_id
            WHERE v.voucher_type = 'receipt' AND v.reference = 'repayment'
              AND v.voucher_date = ?
            GROUP BY a.type`,
          [d]
        )
        out.cashRecovery = 0
        out.onlineRecovery = 0
        out.recoveryCnt = 0
        for (const r of repayRows) {
          const key = r.acct_type === 'bank' ? 'onlineRecovery' : 'cashRecovery'
          out[key] = +(out[key] + Number(r.total)).toFixed(2)
          out.recoveryCnt += Number(r.cnt)
        }
        out.creditCollected = +(out.cashRecovery + out.onlineRecovery).toFixed(2)

        return { ok: true, data: out }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ---------------- Held bills ----------------

  ipcMain.handle('sales:hold', async (_e, p) => {
    try {
      const snap = p?.snapshot
      if (!snap || !Array.isArray(snap.lines) || snap.lines.length === 0)
        return { ok: false, error: 'Nothing to hold — cart is empty.' }
      const [res] = await pool.query(
        `INSERT INTO held_bills
           (label, customer_id, customer_name, payment_type, item_count, net_total, snapshot, held_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.label || null,
          p.customerId || null,
          p.customerName || null,
          ['cash', 'online', 'credit'].includes(p.paymentType)
            ? p.paymentType
            : 'cash',
          snap.lines.length,
          Number(p.netTotal) || 0,
          JSON.stringify(snap),
          getSessionUserId() || p.heldBy || null
        ]
      )
      return { ok: true, data: { id: res.insertId } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:held-list', async () => {
    try {
      const actingUserId = getSessionUserId()
      const [[u]] = await pool.query(`SELECT role FROM users WHERE id = ?`, [
        actingUserId
      ])
      const isAdmin = u && ['administrator', 'manager'].includes(u.role)
      const [rows] = await pool.query(
        `SELECT h.id, h.label, h.customer_name, h.payment_type, h.item_count, h.net_total,
                h.created_at, u.full_name AS held_by_name
           FROM held_bills h
           LEFT JOIN users u ON u.id = h.held_by
          ${isAdmin ? '' : 'WHERE h.held_by = ?'}
          ORDER BY h.id DESC`,
        isAdmin ? [] : [actingUserId]
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:held-resume', async (_e, { id }) => {
    const actingUserId = getSessionUserId()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [[u]] = await conn.query(`SELECT role FROM users WHERE id = ?`, [
        actingUserId
      ])
      const isAdmin = u && ['administrator', 'manager'].includes(u.role)
      const [[row]] = await conn.query(
        `SELECT id, snapshot, held_by FROM held_bills WHERE id = ? FOR UPDATE`,
        [id]
      )
      if (!row) throw new Error('Held bill not found (maybe already resumed).')
      if (!isAdmin && Number(row.held_by) !== Number(actingUserId))
        throw new Error('You can only resume bills you held.')
      await conn.query(`DELETE FROM held_bills WHERE id = ?`, [id])
      await conn.commit()
      const snapshot =
        typeof row.snapshot === 'string'
          ? JSON.parse(row.snapshot)
          : row.snapshot
      return { ok: true, data: { snapshot } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  ipcMain.handle('sales:held-delete', async (_e, { id }) => {
    const actingUserId = getSessionUserId()
    try {
      const [[u]] = await pool.query(`SELECT role FROM users WHERE id = ?`, [
        actingUserId
      ])
      const isAdmin = u && ['administrator', 'manager'].includes(u.role)
      const [[row]] = await pool.query(
        `SELECT held_by FROM held_bills WHERE id = ?`,
        [id]
      )
      if (!row) return { ok: false, error: 'Held bill not found.' }
      if (!isAdmin && Number(row.held_by) !== Number(actingUserId))
        return { ok: false, error: 'You can only discard bills you held.' }
      await pool.query(`DELETE FROM held_bills WHERE id = ?`, [id])
      return { ok: true, data: { deleted: true } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ---------------- Previous / next invoice navigation ----------------

  // Id of the bill before / after `fromId` (by entry order). No `fromId` + 'prev' = the
  // latest bill (Counter Sale's "Last Bill"). Cancelled bills are included — they open
  // view-only — so the numbering has no holes while arrowing through.
  ipcMain.handle('sales:neighbor', async (_e, { fromId, direction = 'prev' } = {}) => {
    try {
      const prev = direction !== 'next'
      const [rows] = fromId
        ? await pool.query(
            `SELECT id FROM sales WHERE id ${prev ? '<' : '>'} ?
              ORDER BY id ${prev ? 'DESC' : 'ASC'} LIMIT 1`,
            [fromId]
          )
        : await pool.query(`SELECT id FROM sales ORDER BY id DESC LIMIT 1`)
      return { ok: true, data: { id: rows[0]?.id || null } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('sales:find-by-no', async (_e, { invoiceNo } = {}) => {
    try {
      const no = String(invoiceNo || '').trim().replace(/^#/, '')
      if (!no) return { ok: false, error: 'Enter an invoice number.' }
      const [rows] = await pool.query(
        `SELECT id FROM sales WHERE invoice_no = ?
          ORDER BY invoice_type = 'counter' DESC, id DESC LIMIT 1`,
        [no]
      )
      if (!rows.length) return { ok: false, error: `Invoice #${no} not found.` }
      return { ok: true, data: { id: rows[0].id } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ---------------- Bill tracking / edit / cancel ----------------

  // ✅ Phase A3 — salesman name via JOIN; ✅ Phase A6 — due_date + is_overdue
  ipcMain.handle(
    'sales:track',
    async (
      _e,
      { actingUserId, from, to, search, paymentType, includeCancelled } = {}
    ) => {
      try {
        // Read-only list: cashiers use it from Counter Sale's "Previous Invoices".
        // Editing / cancelling a bill stays admin-only (sales:update / sales:cancel).
        await authorize(actingUserId, ALL_ROLES)
        let where = 'WHERE 1=1'
        const args = []
        if (!includeCancelled) where += ' AND s.is_cancelled = 0'
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
        if (search && search.trim()) {
          where +=
            ' AND (s.invoice_no LIKE ? OR c.name LIKE ? OR c.code LIKE ?)'
          const s = `%${search.trim()}%`
          args.push(s, s, s)
        }
        const [rows] = await pool.query(
          `SELECT s.id, s.invoice_no, s.payment_type, s.invoice_date, s.invoice_time,
                  s.customer_id, s.net_total, s.amount_received, s.cash_back,
                  (s.net_total - s.amount_received) AS outstanding, s.is_cancelled,
                  s.due_date,
                  CASE WHEN s.due_date IS NOT NULL
                         AND s.due_date < CURDATE()
                         AND (s.net_total - s.amount_received) > 0.009
                       THEN 1 ELSE 0 END AS is_overdue,
                  c.name AS customer, c.code AS customer_code,
                  sm.name AS salesman, u.full_name AS operator,
                  sm.name AS salesman_name,
                  (SELECT COUNT(*) FROM sales_returns sr WHERE sr.sale_id = s.id) AS return_count
             FROM sales s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN users u ON u.id = s.created_by
             LEFT JOIN salesmen sm ON sm.id = s.salesman_id
            ${where}
            ORDER BY s.id DESC LIMIT 300`,
          args
        )
        await applyRemainingDue(pool, rows) // recovery-aware is_overdue + remaining_due
        return { ok: true, data: rows }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle('sales:update', async (_e, payload) => {
    const conn = await pool.getConnection()
    try {
      await authorize(payload.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const saleId = payload.saleId
      const [[sale]] = await conn.query(
        `SELECT s.*, c.is_walk_in FROM sales s JOIN customers c ON c.id = s.customer_id
          WHERE s.id = ? FOR UPDATE`,
        [saleId]
      )
      if (!sale) throw new Error('Bill not found.')
      if (sale.is_cancelled)
        throw new Error('This bill is cancelled and cannot be edited.')
      const [[{ rc }]] = await conn.query(
        `SELECT COUNT(*) AS rc FROM sales_returns WHERE sale_id = ?`,
        [saleId]
      )
      if (rc > 0)
        throw new Error(
          'This bill has returns recorded — edit is blocked. Handle the return instead.'
        )

      const [origItems] = await conn.query(
        `SELECT * FROM sale_items WHERE sale_id = ?`,
        [saleId]
      )
      const { keepLedgerId } = await reverseSalePostings(conn, sale, origItems, 'edit')
      await conn.query(`DELETE FROM sale_items WHERE sale_id = ?`, [saleId])

      const lines = payload.lines || []
      if (lines.length === 0)
        throw new Error('A bill must have at least one item.')
      const newCustomerId = payload.customerId || sale.customer_id
      const [[newCust]] = await conn.query(
        `SELECT id, is_walk_in, current_balance, credit_limit
           FROM customers WHERE id = ? AND is_active = 1 FOR UPDATE`,
        [newCustomerId]
      )
      if (!newCust) throw new Error('Customer not found.')
      const payType = ['cash', 'online', 'credit'].includes(payload.paymentType)
        ? payload.paymentType
        : sale.payment_type
      const accountId = payload.accountId || sale.payment_account_id
      // ✅ Phase A3 — optional salesman change
      const newSalesmanId =
        payload.salesmanId !== undefined
          ? payload.salesmanId || null
          : sale.salesman_id
      // ✅ Phase A6 — promise-to-pay date
      const newDueDate =
        payload.dueDate !== undefined ? payload.dueDate || null : sale.due_date

      let subTotal = 0
      const resolved = []
      for (const ln of lines) {
        const [[it]] = await conn.query(
          `SELECT id, name, unit, average_cost FROM items WHERE id = ? AND is_active = 1`,
          [ln.itemId]
        )
        if (!it) throw new Error(`Item not found (id ${ln.itemId}).`)
        const qty = Number(ln.quantity) || 0,
          rate = Number(ln.rate) || 0
        if (qty <= 0) throw new Error(`Quantity must be > 0 for ${it.name}.`)
        const gross = +(qty * rate).toFixed(2)
        const dv = Number(ln.discountValue ?? ln.discountPercent) || 0
        if (!(rate > 0)) throw new Error(`Rate must be greater than 0 for ${it.name}.`)
        if (dv < 0) throw new Error(`Discount cannot be negative for ${it.name}.`)
        if (ln.discountMode !== 'amount' && dv > 100)
          throw new Error(`Discount cannot be more than 100% for ${it.name}.`)
        let discAmt, discPct
        if (ln.discountMode === 'amount') {
          discAmt = +Math.min(dv, gross).toFixed(2)
          discPct = gross > 0 ? +((discAmt / gross) * 100).toFixed(2) : 0
        } else {
          discPct = dv
          discAmt = +((gross * discPct) / 100).toFixed(2)
        }
        const net = +(gross - discAmt).toFixed(2)
        if (!(net > 0)) throw new Error(`Net amount must be greater than 0 for ${it.name}.`)
        subTotal += net
        resolved.push({
          it,
          qty,
          rate,
          gross,
          discPct,
          discAmt,
          net,
          unit: ln.unit || it.unit,
          description: ln.description || it.name
        })
      }
      subTotal = +subTotal.toFixed(2)
      const disc = Number(payload.overallDiscount) || 0
      const delivery = Number(payload.deliveryCharges) || 0
      const netTotal = +(subTotal - disc + delivery).toFixed(2)
      if (netTotal < 0) throw new Error('Net total cannot be negative.')
      const tendered = Number(payload.amountReceived) || 0
      const actualPaid = +Math.min(tendered, netTotal).toFixed(2)
      const change = +Math.max(0, tendered - netTotal).toFixed(2)
      const outstanding = +(netTotal - actualPaid).toFixed(2)

      if (payType === 'credit') {
        if (newCust.is_walk_in)
          throw new Error('Credit needs a named customer, not Walk-In.')

        // SAME rule as sales:create. newCust.current_balance was read AFTER the old
        // postings were reversed, so it already excludes this bill's old credit.
        assertCreditLimit({
          creditLimit: newCust.credit_limit,
          balanceWithoutBill: newCust.current_balance,
          billOutstanding: outstanding,
          isEdit: true
        })
      } else if (outstanding > 0)
        throw new Error('Cash/Online bills must be fully paid.')

      // ✅ Phase A3 — salesman_id; ✅ Phase A6 — due_date
      await conn.query(
        `UPDATE sales SET customer_id=?, payment_type=?, sub_total=?, discount=?, delivery_charges=?,
           net_total=?, amount_received=?, cash_back=?, payment_account_id=?, remarks=?, salesman_id=?, due_date=? WHERE id=?`,
        [
          newCustomerId,
          payType,
          subTotal,
          disc,
          delivery,
          netTotal,
          actualPaid,
          change,
          accountId,
          payload.remarks || null,
          newSalesmanId,
          payType === 'credit' ? newDueDate : null,
          saleId
        ]
      )

      for (const r of resolved) {
        await conn.query(
          `INSERT INTO sale_items (sale_id, item_id, description, quantity, unit, rate, gross_amount, discount_percent, discount_amount, net_amount)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            saleId,
            r.it.id,
            r.description,
            r.qty,
            r.unit,
            r.rate,
            r.gross,
            r.discPct,
            r.discAmt,
            r.net
          ]
        )
        await postStockMovement(conn, {
          itemId: r.it.id,
          movementType: 'sale',
          quantityOut: r.qty,
          unitCost: Number(r.it.average_cost) || 0,
          referenceType: 'sale',
          referenceId: saleId,
          movementDate: sale.invoice_date
        })
      }
      if (actualPaid > 0) {
        const [[acct]] = await conn.query(
          `SELECT type FROM accounts WHERE id = ?`,
          [accountId]
        )
        const method =
          payType === 'online'
            ? 'bank'
            : acct?.type === 'bank'
              ? 'bank'
              : 'cash'
        const vno = await nextReceiptVoucherNo(conn)
        await conn.query(
          `INSERT INTO vouchers (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method, reference, sale_id, description, voucher_date, created_by)
           VALUES (?, 'receipt', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            vno,
            newCust.is_walk_in ? 'none' : 'customer',
            newCust.is_walk_in ? null : newCustomerId,
            accountId,
            actualPaid,
            method,
            `Invoice ${sale.invoice_no}`,
            saleId,
            `Sale receipt (edited) — invoice ${sale.invoice_no}`,
            sale.invoice_date,
            payload.actingUserId
          ]
        )
        await conn.query(
          `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
          [actualPaid, accountId]
        )
      }
      // Ledger: rewrite the bill's existing credit_sale row in place (keeps its date and
      // position in the statement, so a repayment made earlier still shows AFTER the bill).
      // Only when the customer changed, or there was no row before, is a new row posted.
      const hasCredit = outstanding > 0 && !newCust.is_walk_in
      const sameCustomer = Number(newCustomerId) === Number(sale.customer_id)
      if (hasCredit) {
        await conn.query(
          `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`,
          [outstanding, newCustomerId]
        )
      }
      if (hasCredit && keepLedgerId && sameCustomer) {
        await conn.query(
          `UPDATE customer_ledger SET debit = ?, credit = 0, description = ? WHERE id = ?`,
          [outstanding, `Invoice #${sale.invoice_no} (edited)`, keepLedgerId]
        )
      } else {
        // old row no longer applies (bill now fully paid / walk-in / other customer)
        if (keepLedgerId)
          await conn.query(`DELETE FROM customer_ledger WHERE id = ?`, [keepLedgerId])
        if (hasCredit)
          await postCustomerLedger(conn, {
            customerId: newCustomerId,
            entryType: 'credit_sale',
            debit: outstanding,
            referenceType: 'sale',
            referenceId: saleId,
            description: `Invoice #${sale.invoice_no} (edited)`,
            date: sale.invoice_date,
            createdBy: payload.actingUserId
          })
      }
      const lowStock = await lowStockAmong(conn, resolved.map((r) => r.it.id))
      await conn.commit()
      return {
        ok: true,
        data: {
          lowStock,
          saleId,
          netTotal,
          amountReceived: actualPaid,
          change,
          outstanding
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
    'sales:cancel',
    async (_e, { actingUserId, saleId, reason }) => {
      const conn = await pool.getConnection()
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        await conn.beginTransaction()
        const [[sale]] = await conn.query(
          `SELECT s.*, c.is_walk_in FROM sales s JOIN customers c ON c.id = s.customer_id WHERE s.id = ? FOR UPDATE`,
          [saleId]
        )
        if (!sale) throw new Error('Bill not found.')
        if (sale.is_cancelled)
          throw new Error('This bill is already cancelled.')
        const [[{ rc }]] = await conn.query(
          `SELECT COUNT(*) AS rc FROM sales_returns WHERE sale_id = ?`,
          [saleId]
        )
        if (rc > 0)
          throw new Error('This bill has returns recorded — cancel is blocked.')
        const [items] = await conn.query(
          `SELECT * FROM sale_items WHERE sale_id = ?`,
          [saleId]
        )
        await reverseSalePostings(conn, sale, items)
        await conn.query(
          `UPDATE sales SET is_cancelled = 1,
           remarks = CONCAT(COALESCE(remarks,''), ' [CANCELLED: ', ?, ']') WHERE id = ?`,
          [reason || 'no reason', saleId]
        )
        await conn.commit()
        return { ok: true, data: { cancelled: true } }
      } catch (err) {
        await conn.rollback()
        return { ok: false, error: err.message }
      } finally {
        conn.release()
      }
    }
  )
}
