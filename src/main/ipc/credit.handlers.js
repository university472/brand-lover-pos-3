// import pool from '../db/pool.js'
// import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'
// import { postCustomerLedger } from '../services/customer.ledger.js'

// async function nextRepaymentNo(conn) {
//   const [[r]] = await conn.query(
//     `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no,'RV-','') AS UNSIGNED)),0)+1 AS next
//        FROM vouchers WHERE voucher_type='receipt' AND voucher_no LIKE 'RV-%'`
//   )
//   return 'RV-' + String(r.next).padStart(3, '0')
// }

// // ✅ helper — build a sortable timestamp string
// function tsKey(d) {
//   if (!d) return '0000-00-00T00:00:00.000Z'
//   const dt = d instanceof Date ? d : new Date(d)
//   if (isNaN(dt.getTime())) return '0000-00-00T00:00:00.000Z'
//   return dt.toISOString()
// }

// export function registerCreditHandlers(ipcMain) {
//   ipcMain.handle(
//     'credit:customers',
//     async (_e, { actingUserId, search, includeSettled } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         const args = []
//         let where
//         if (includeSettled || (search && search.trim())) {
//           where = `WHERE is_active = 1 AND (current_balance > 0
//                      OR id IN (SELECT DISTINCT customer_id FROM customer_ledger)
//                      OR id IN (SELECT DISTINCT customer_id FROM sales WHERE payment_type='credit' AND is_cancelled=0))`
//         } else {
//           where = 'WHERE is_active = 1 AND current_balance > 0'
//         }
//         if (search && search.trim()) {
//           where += ' AND (name LIKE ? OR code LIKE ?)'
//           const s = `%${search.trim()}%`
//           args.push(s, s)
//         }
//         const [rows] = await pool.query(
//           `SELECT id, code, name, telephone, current_balance
//              FROM customers ${where} ORDER BY current_balance DESC, name ASC`,
//           args
//         )
//         return { ok: true, data: rows }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle('credit:ledger', async (_e, { actingUserId, customerId }) => {
//     try {
//       await authorize(actingUserId, ADMIN_ROLES)
//       const [[customer]] = await pool.query(
//         `SELECT id, code, name, telephone, opening_balance, current_balance FROM customers WHERE id = ?`,
//         [customerId]
//       )
//       if (!customer) return { ok: false, error: 'Customer not found.' }

//       // ✅ created_at bhi fetch karo — sort ke liye
//       const [creditSales] = await pool.query(
//         `SELECT id, invoice_no, invoice_date, net_total, amount_received,
//                 (net_total - amount_received) AS due, created_at
//            FROM sales
//           WHERE customer_id = ? AND payment_type='credit' AND is_cancelled = 0
//           ORDER BY invoice_date ASC, id ASC`,
//         [customerId]
//       )

//       const [repayments] = await pool.query(
//         `SELECT v.id, v.voucher_no, v.amount, v.description, v.voucher_date,
//                 v.account_id, v.created_at, a.name AS account_name
//            FROM vouchers v LEFT JOIN accounts a ON a.id = v.account_id
//           WHERE v.party_type='customer' AND v.party_id = ?
//             AND v.voucher_type='receipt' AND v.reference='repayment'
//           ORDER BY v.voucher_date ASC, v.id ASC`,
//         [customerId]
//       )

//       const [ledgerEvents] = await pool.query(
//         `SELECT id, entry_type, debit, credit, description, entry_date, created_at
//            FROM customer_ledger
//           WHERE customer_id = ?
//             AND entry_type IN ('return_credit_offset','return_cash_refund','adjustment')
//           ORDER BY entry_date ASC, id ASC`,
//         [customerId]
//       )

//       const opening = Number(customer.opening_balance) || 0
//       const outstanding = Number(customer.current_balance)
//       const totalDue = creditSales.reduce((s, b) => s + Number(b.due), 0)
//       const totalRepaid = repayments.reduce((s, r) => s + Number(r.amount), 0)

//       // Everything already settled (by repayment OR credit-return) = charges - current balance.
//       let poolAmt = +Math.max(0, opening + totalDue - outstanding).toFixed(2)
//       if (poolAmt > 0 && opening > 0)
//         poolAmt = +(poolAmt - Math.min(poolAmt, opening)).toFixed(2)
//       const bills = creditSales.map((b) => {
//         const due = Number(b.due)
//         const paid = Math.max(0, Math.min(poolAmt, due))
//         poolAmt = +(poolAmt - paid).toFixed(2)
//         const remaining = +(due - paid).toFixed(2)
//         return {
//           id: b.id,
//           invoice_no: b.invoice_no,
//           invoice_date: b.invoice_date,
//           net_total: Number(b.net_total),
//           original_due: +due.toFixed(2),
//           paid: +paid.toFixed(2),
//           remaining,
//           status:
//             remaining <= 0.009 ? 'paid' : paid > 0.009 ? 'partial' : 'unpaid'
//         }
//       })

//       // ✅ Unified timeline — sort by created_at timestamp
//       const ev = []

//       if (opening > 0)
//         ev.push({
//           kind: 'charge',
//           label: 'Opening Balance',
//           amount: opening,
//           date: null,
//           sort: '0000-00-00T00:00:00.000Z'
//         })

//       for (const b of creditSales)
//         ev.push({
//           kind: 'charge',
//           label: `Invoice #${b.invoice_no}`,
//           amount: Number(b.due),
//           date: b.invoice_date,
//           sort: tsKey(b.created_at)
//         })

//       for (const r of repayments)
//         ev.push({
//           kind: 'payment',
//           id: r.id,
//           voucher_no: r.voucher_no,
//           label: r.voucher_no,
//           amount: Number(r.amount),
//           date: r.voucher_date,
//           description: r.description,
//           account_id: r.account_id,
//           account_name: r.account_name,
//           voucher_date: r.voucher_date,
//           sort: tsKey(r.created_at)
//         })

//       for (const l of ledgerEvents) {
//         const amt = +(Number(l.debit) - Number(l.credit)).toFixed(2)
//         const labelMap = {
//           return_credit_offset: 'Goods returned',
//           return_cash_refund: 'Cash refunded to customer',
//           adjustment: 'Adjustment'
//         }
//         ev.push({
//           kind: amt >= 0 ? 'charge' : 'payment',
//           label: l.description || labelMap[l.entry_type] || 'Adjustment',
//           amount: Math.abs(amt),
//           date: l.entry_date,
//           sort: tsKey(l.created_at)
//         })
//       }

//       // ✅ Chronological sort by created_at
//       ev.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))

//       let running = 0
//       for (const e of ev) {
//         running += e.kind === 'charge' ? e.amount : -e.amount
//         e.balance = +running.toFixed(2)
//       }

//       // Newest first for display
//       const timeline = ev.reverse()

//       const totalBilled = creditSales.reduce(
//         (s, b) => s + Number(b.net_total),
//         0
//       )
//       const unpaid = bills.filter((b) => b.remaining > 0.009)
//       let oldest = null,
//         ageDays = 0
//       if (unpaid.length) {
//         oldest = unpaid[0].invoice_date
//         ageDays = Math.max(
//           0,
//           Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000)
//         )
//       }

//       return {
//         ok: true,
//         data: {
//           customer,
//           bills,
//           timeline,
//           summary: {
//             opening,
//             totalBilled: +totalBilled.toFixed(2),
//             totalDue: +totalDue.toFixed(2),
//             totalRepaid: +totalRepaid.toFixed(2),
//             outstanding: +outstanding.toFixed(2),
//             adjustment: 0,
//             unpaidCount: unpaid.length,
//             partialCount: bills.filter((b) => b.status === 'partial').length,
//             oldestUnpaidDate: oldest,
//             oldestAgeDays: ageDays
//           }
//         }
//       }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('credit:record-repayment', async (_e, p) => {
//     const conn = await pool.getConnection()
//     try {
//       await authorize(p.actingUserId, ADMIN_ROLES)
//       await conn.beginTransaction()
//       const amount = +(Number(p.amount) || 0).toFixed(2)
//       if (amount <= 0)
//         throw new Error('Enter a repayment amount greater than 0.')
//       if (!p.accountId)
//         throw new Error('Choose the account the money went into.')
//       const [[cust]] = await conn.query(
//         `SELECT id, current_balance FROM customers WHERE id = ? FOR UPDATE`,
//         [p.customerId]
//       )
//       if (!cust) throw new Error('Customer not found.')
//       if (amount > Number(cust.current_balance) + 0.009)
//         throw new Error(
//           `Repayment exceeds outstanding (${Number(cust.current_balance).toLocaleString('en-PK')}). Enter up to that amount.`
//         )
//       const date = p.date || localToday()
//       const vno = await nextRepaymentNo(conn)
//       const [[acct]] = await conn.query(
//         `SELECT type FROM accounts WHERE id = ?`,
//         [p.accountId]
//       )
//       const method = acct?.type === 'bank' ? 'bank' : 'cash'
//       await conn.query(
//         `INSERT INTO vouchers
//            (voucher_no, voucher_type, party_type, party_id, account_id, amount,
//             payment_method, reference, description, voucher_date, created_by)
//          VALUES (?, 'receipt', 'customer', ?, ?, ?, ?, 'repayment', ?, ?, ?)`,
//         [
//           vno,
//           p.customerId,
//           p.accountId,
//           amount,
//           method,
//           p.note || 'Credit repayment',
//           date,
//           p.actingUserId
//         ]
//       )
//       await conn.query(
//         `UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`,
//         [amount, p.customerId]
//       )
//       await conn.query(
//         `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
//         [amount, p.accountId]
//       )
//       await postCustomerLedger(conn, {
//         customerId: p.customerId,
//         entryType: 'repayment',
//         credit: amount,
//         referenceType: 'voucher',
//         referenceId: null,
//         description: p.note || 'Credit repayment',
//         date,
//         createdBy: p.actingUserId
//       })
//       await conn.commit()
//       return { ok: true, data: { voucherNo: vno } }
//     } catch (err) {
//       await conn.rollback()
//       return { ok: false, error: err.message }
//     } finally {
//       conn.release()
//     }
//   })

//   ipcMain.handle('credit:update-repayment', async (_e, p) => {
//     const conn = await pool.getConnection()
//     try {
//       await authorize(p.actingUserId, ADMIN_ROLES)
//       await conn.beginTransaction()
//       const [[v]] = await conn.query(
//         `SELECT * FROM vouchers WHERE id = ? AND voucher_type='receipt'
//            AND reference='repayment' AND party_type='customer'`,
//         [p.voucherId]
//       )
//       if (!v) throw new Error('Repayment entry not found.')
//       const newAmount = +(Number(p.amount) || 0).toFixed(2)
//       if (newAmount <= 0) throw new Error('Amount must be greater than 0.')
//       const newAccountId = p.accountId || v.account_id
//       const newDate = p.date || v.voucher_date
//       const note = p.note !== undefined ? p.note : v.description

//       await conn.query(
//         `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`,
//         [v.amount, v.party_id]
//       )
//       await conn.query(
//         `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
//         [v.amount, v.account_id]
//       )
//       await conn.query(
//         `UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`,
//         [newAmount, v.party_id]
//       )
//       await conn.query(
//         `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
//         [newAmount, newAccountId]
//       )
//       const [[acct]] = await conn.query(
//         `SELECT type FROM accounts WHERE id = ?`,
//         [newAccountId]
//       )
//       const method = acct?.type === 'bank' ? 'bank' : 'cash'
//       await conn.query(
//         `UPDATE vouchers SET amount = ?, account_id = ?, voucher_date = ?, description = ?, payment_method = ?
//           WHERE id = ?`,
//         [newAmount, newAccountId, newDate, note, method, p.voucherId]
//       )
//       await postCustomerLedger(conn, {
//         customerId: v.party_id,
//         entryType: 'adjustment',
//         debit: Number(v.amount),
//         credit: newAmount,
//         referenceType: 'voucher',
//         referenceId: p.voucherId,
//         description: `Repayment edited ${v.amount} → ${newAmount}`,
//         date: newDate,
//         createdBy: p.actingUserId
//       })
//       await conn.commit()
//       return { ok: true, data: { id: p.voucherId } }
//     } catch (err) {
//       await conn.rollback()
//       return { ok: false, error: err.message }
//     } finally {
//       conn.release()
//     }
//   })

//   ipcMain.handle('credit:delete-repayment', async (_e, p) => {
//     const conn = await pool.getConnection()
//     try {
//       await authorize(p.actingUserId, ADMIN_ROLES)
//       await conn.beginTransaction()
//       const [[v]] = await conn.query(
//         `SELECT * FROM vouchers WHERE id = ? AND voucher_type='receipt'
//            AND reference='repayment' AND party_type='customer'`,
//         [p.voucherId]
//       )
//       if (!v) throw new Error('Repayment entry not found.')
//       await conn.query(
//         `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`,
//         [v.amount, v.party_id]
//       )
//       await conn.query(
//         `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
//         [v.amount, v.account_id]
//       )
//       await conn.query(`DELETE FROM vouchers WHERE id = ?`, [p.voucherId])
//       await postCustomerLedger(conn, {
//         customerId: v.party_id,
//         entryType: 'adjustment',
//         debit: Number(v.amount),
//         referenceType: 'voucher',
//         referenceId: p.voucherId,
//         description: `Repayment ${v.voucher_no} deleted (restored)`,
//         createdBy: p.actingUserId
//       })
//       await conn.commit()
//       return { ok: true, data: { deleted: true } }
//     } catch (err) {
//       await conn.rollback()
//       return { ok: false, error: err.message }
//     } finally {
//       conn.release()
//     }
//   })
// }

import pool from '../db/pool.js'
import { dialog, BrowserWindow } from 'electron'
import * as XLSX from 'xlsx'
import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'
import { postCustomerLedger } from '../services/customer.ledger.js'
import { creditBillRemaining } from '../services/credit.allocation.js'

import { localToday } from '../services/date.util.js'
async function nextRepaymentNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no,'RV-','') AS UNSIGNED)),0)+1 AS next
       FROM vouchers WHERE voucher_type='receipt' AND voucher_no LIKE 'RV-%'`
  )
  return 'RV-' + String(r.next).padStart(3, '0')
}

// ✅ helper — build a sortable timestamp string
function tsKey(d) {
  if (!d) return '0000-00-00T00:00:00.000Z'
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt.getTime())) return '0000-00-00T00:00:00.000Z'
  return dt.toISOString()
}

// The customer_ledger row that belongs to a repayment voucher.
// New rows carry reference_id = voucher id. Rows written before that fix have NULL, so fall
// back to the unlinked repayment row with the same customer, amount and date (identical rows
// are interchangeable, so picking the first is safe).
async function findRepaymentLedgerRow(conn, v) {
  const [[linked]] = await conn.query(
    `SELECT id FROM customer_ledger
      WHERE customer_id = ? AND entry_type = 'repayment'
        AND reference_type = 'voucher' AND reference_id = ?
      LIMIT 1`,
    [v.party_id, v.id]
  )
  if (linked) return linked.id
  const [[legacy]] = await conn.query(
    `SELECT id FROM customer_ledger
      WHERE customer_id = ? AND entry_type = 'repayment' AND reference_id IS NULL
        AND credit = ? AND entry_date = ?
      ORDER BY id LIMIT 1`,
    [v.party_id, v.amount, v.voucher_date]
  )
  return legacy?.id || null
}

export function registerCreditHandlers(ipcMain) {
  ipcMain.handle(
    'credit:customers',
    async (_e, { actingUserId, search, includeSettled } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const args = []
        let where
        if (includeSettled || (search && search.trim())) {
          where = `WHERE is_active = 1 AND (current_balance > 0
                     OR id IN (SELECT DISTINCT customer_id FROM customer_ledger)
                     OR id IN (SELECT DISTINCT customer_id FROM sales WHERE payment_type='credit' AND is_cancelled=0))`
        } else {
          where = 'WHERE is_active = 1 AND current_balance > 0'
        }
        if (search && search.trim()) {
          where += ' AND (name LIKE ? OR code LIKE ?)'
          const s = `%${search.trim()}%`
          args.push(s, s)
        }
        const [rows] = await pool.query(
          `SELECT id, code, name, telephone, current_balance
             FROM customers ${where} ORDER BY current_balance DESC, name ASC`,
          args
        )
        return { ok: true, data: rows }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle('credit:ledger', async (_e, { actingUserId, customerId }) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      const [[customer]] = await pool.query(
        `SELECT id, code, name, telephone, opening_balance, current_balance FROM customers WHERE id = ?`,
        [customerId]
      )
      if (!customer) return { ok: false, error: 'Customer not found.' }

      // ✅ created_at bhi fetch karo — sort ke liye
      const [creditSales] = await pool.query(
        `SELECT id, invoice_no, invoice_date, due_date, net_total, amount_received,
                (net_total - amount_received) AS due, created_at
           FROM sales
          WHERE customer_id = ? AND payment_type='credit' AND is_cancelled = 0
          ORDER BY invoice_date ASC, id ASC`,
        [customerId]
      )

      const [repayments] = await pool.query(
        `SELECT v.id, v.voucher_no, v.amount, v.description, v.voucher_date,
                v.account_id, v.created_at, a.name AS account_name
           FROM vouchers v LEFT JOIN accounts a ON a.id = v.account_id
          WHERE v.party_type='customer' AND v.party_id = ?
            AND v.voucher_type='receipt' AND v.reference='repayment'
          ORDER BY v.voucher_date ASC, v.id ASC`,
        [customerId]
      )

      const [ledgerEvents] = await pool.query(
        `SELECT cl.id, cl.entry_type, cl.debit, cl.credit, cl.description, cl.entry_date, cl.created_at,
                IF(v.reference = 'customer-refund', v.id, NULL) AS refund_voucher_id
           FROM customer_ledger cl
           LEFT JOIN vouchers v ON cl.reference_type = 'voucher' AND v.id = cl.reference_id
          WHERE cl.customer_id = ?
            AND cl.entry_type IN ('return_credit_offset','return_cash_refund','adjustment')
          ORDER BY cl.entry_date ASC, cl.id ASC`,
        [customerId]
      )

      const opening = Number(customer.opening_balance) || 0
      const outstanding = Number(customer.current_balance)
      const totalDue = creditSales.reduce((s, b) => s + Number(b.due), 0)
      const totalRepaid = repayments.reduce((s, r) => s + Number(r.amount), 0)

      // Per-bill paid / remaining from the ONE shared FIFO allocation (also used for the
      // overdue badges and the Dashboard overdues), so the two can never disagree.
      const alloc = await creditBillRemaining(pool, { customerIds: [customer.id] })
      const bills = creditSales.map((b) => {
        const due = Number(b.due)
        const a = alloc.get(b.id)
        const paid = a ? a.paid : 0
        const remaining = a ? a.remaining : +due.toFixed(2)
        return {
          id: b.id,
          invoice_no: b.invoice_no,
          invoice_date: b.invoice_date,
          net_total: Number(b.net_total),
          original_due: +due.toFixed(2),
          paid: +paid.toFixed(2),
          remaining,
          due_date: b.due_date || null,
          // promise-to-pay date passed and money still owed on this bill
          overdue: !!(b.due_date && String(b.due_date) < localToday() && remaining > 0.009),
          status:
            remaining <= 0.009 ? 'paid' : paid > 0.009 ? 'partial' : 'unpaid'
        }
      })

      // ✅ Unified timeline — sort by created_at timestamp
      const ev = []

      if (opening > 0)
        ev.push({
          kind: 'charge',
          label: 'Opening Balance',
          amount: opening,
          date: null,
          sort: '0000-00-00T00:00:00.000Z'
        })

      for (const b of creditSales)
        ev.push({
          kind: 'charge',
          label: `Invoice #${b.invoice_no}`,
          amount: Number(b.due),
          date: b.invoice_date,
          sort: tsKey(b.created_at)
        })

      for (const r of repayments)
        ev.push({
          kind: 'payment',
          id: r.id,
          voucher_no: r.voucher_no,
          label: r.voucher_no,
          amount: Number(r.amount),
          date: r.voucher_date,
          description: r.description,
          account_id: r.account_id,
          account_name: r.account_name,
          voucher_date: r.voucher_date,
          sort: tsKey(r.created_at)
        })

      for (const l of ledgerEvents) {
        const amt = +(Number(l.debit) - Number(l.credit)).toFixed(2)
        const labelMap = {
          return_credit_offset: 'Goods returned',
          return_cash_refund: 'Cash refunded to customer',
          adjustment: 'Adjustment'
        }
        ev.push({
          kind: amt >= 0 ? 'charge' : 'payment',
          // a return / adjustment row — NOT a repayment voucher, so it can't be edited or
          // deleted from here (it used to get Edit/Delete buttons that failed)
          isAdjustment: true,
          // money paid back to the customer with "Refund to customer" — can be undone
          refundVoucherId: l.refund_voucher_id || null,
          label: l.description || labelMap[l.entry_type] || 'Adjustment',
          amount: Math.abs(amt),
          date: l.entry_date,
          sort: tsKey(l.created_at)
        })
      }

      // ✅ Chronological sort by created_at
      ev.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))

      let running = 0
      for (const e of ev) {
        running += e.kind === 'charge' ? e.amount : -e.amount
        e.balance = +running.toFixed(2)
      }

      // Newest first for display
      const timeline = ev.reverse()

      const totalBilled = creditSales.reduce(
        (s, b) => s + Number(b.net_total),
        0
      )
      const unpaid = bills.filter((b) => b.remaining > 0.009)
      let oldest = null,
        ageDays = 0
      if (unpaid.length) {
        oldest = unpaid[0].invoice_date
        ageDays = Math.max(
          0,
          Math.floor((Date.now() - new Date(oldest).getTime()) / 86400000)
        )
      }

      return {
        ok: true,
        data: {
          customer,
          bills,
          timeline,
          summary: {
            opening,
            totalBilled: +totalBilled.toFixed(2),
            totalDue: +totalDue.toFixed(2),
            totalRepaid: +totalRepaid.toFixed(2),
            outstanding: +outstanding.toFixed(2),
            adjustment: 0,
            unpaidCount: unpaid.length,
            partialCount: bills.filter((b) => b.status === 'partial').length,
            oldestUnpaidDate: oldest,
            oldestAgeDays: ageDays
          }
        }
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('credit:record-repayment', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const amount = +(Number(p.amount) || 0).toFixed(2)
      if (amount <= 0)
        throw new Error('Enter a repayment amount greater than 0.')
      if (!p.accountId)
        throw new Error('Choose the account the money went into.')
      const [[cust]] = await conn.query(
        `SELECT id, name, code, current_balance FROM customers WHERE id = ? FOR UPDATE`,
        [p.customerId]
      )
      if (!cust) throw new Error('Customer not found.')
      if (amount > Number(cust.current_balance) + 0.009)
        throw new Error(
          `Repayment exceeds outstanding (${Number(cust.current_balance).toLocaleString('en-PK')}). Enter up to that amount.`
        )
      const date = p.date || localToday()
      const vno = await nextRepaymentNo(conn)
      const [[acct]] = await conn.query(
        `SELECT name, type FROM accounts WHERE id = ?`,
        [p.accountId]
      )
      const method = acct?.type === 'bank' ? 'bank' : 'cash'
      const [vres] = await conn.query(
        `INSERT INTO vouchers
           (voucher_no, voucher_type, party_type, party_id, account_id, amount,
            payment_method, reference, description, voucher_date, created_by)
         VALUES (?, 'receipt', 'customer', ?, ?, ?, ?, 'repayment', ?, ?, ?)`,
        [
          vno,
          p.customerId,
          p.accountId,
          amount,
          method,
          p.note || 'Credit repayment',
          date,
          p.actingUserId
        ]
      )
      await conn.query(
        `UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`,
        [amount, p.customerId]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
        [amount, p.accountId]
      )
      await postCustomerLedger(conn, {
        customerId: p.customerId,
        entryType: 'repayment',
        credit: amount,
        referenceType: 'voucher',
        // Link to the voucher so edit/delete can find THIS row (was null).
        referenceId: vres.insertId,
        description: p.note || 'Credit repayment',
        date,
        createdBy: p.actingUserId
      })
      await conn.commit()
      return {
        ok: true,
        data: {
          voucherNo: vno,
          amount,
          date,
          customerId: p.customerId,
          customerName: cust.name,
          customerCode: cust.code,
          accountName: acct?.name || null,
          method
        }
      }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // The SHOP owes the customer (balance below 0 — e.g. returned more than they owed) and pays
  // that money back. Payment voucher (cash/bank goes down), customer balance moves back toward
  // 0, and a 'Cash refunded to customer' ledger row keeps the history.
  ipcMain.handle('credit:refund-customer', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      const user = await authorize(p.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const amount = +(Number(p.amount) || 0).toFixed(2)
      if (amount <= 0) throw new Error('Enter an amount greater than 0.')
      if (!p.accountId) throw new Error('Choose the account the money is paid from.')
      const [[cust]] = await conn.query(
        `SELECT id, name, code, current_balance FROM customers WHERE id = ? FOR UPDATE`,
        [p.customerId]
      )
      if (!cust) throw new Error('Customer not found.')
      const weOwe = +(-Number(cust.current_balance)).toFixed(2)
      if (weOwe <= 0.009) throw new Error(`You do not owe ${cust.name} anything.`)
      if (amount > weOwe + 0.009)
        throw new Error(
          `That is more than you owe ${cust.name} (Rs. ${weOwe.toLocaleString('en-PK')}).`
        )
      const [[acct]] = await conn.query(
        `SELECT id, name, type FROM accounts WHERE id = ? AND is_active = 1`,
        [p.accountId]
      )
      if (!acct) throw new Error('Account not found.')
      const date = p.date || localToday()
      const [[nx]] = await conn.query(
        `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no, 'PV-', '') AS UNSIGNED)), 0) + 1 AS next
           FROM vouchers WHERE voucher_type = 'payment' AND voucher_no LIKE 'PV-%'`
      )
      const vno = 'PV-' + String(nx.next).padStart(3, '0')
      const note = (p.note || '').trim() || `Refund paid to ${cust.name}`
      const [vres] = await conn.query(
        `INSERT INTO vouchers
           (voucher_no, voucher_type, party_type, party_id, account_id, amount,
            payment_method, reference, description, voucher_date, created_by)
         VALUES (?, 'payment', 'customer', ?, ?, ?, ?, 'customer-refund', ?, ?, ?)`,
        [vno, cust.id, acct.id, amount, acct.type === 'bank' ? 'bank' : 'cash', note, date, user.id]
      )
      await conn.query(
        `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`,
        [amount, cust.id]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
        [amount, acct.id]
      )
      await postCustomerLedger(conn, {
        customerId: cust.id,
        entryType: 'return_cash_refund',
        debit: amount,
        referenceType: 'voucher',
        referenceId: vres.insertId,
        description: `${vno} · ${note} (${acct.name})`,
        date,
        createdBy: user.id
      })
      await conn.commit()
      return {
        ok: true,
        data: { voucherNo: vno, amount, date, customerName: cust.name, accountName: acct.name }
      }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // Undo a "Refund to customer" (mistake): money back into the account, customer is owed again.
  ipcMain.handle('credit:delete-customer-refund', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const [[v]] = await conn.query(
        `SELECT * FROM vouchers
          WHERE id = ? AND voucher_type = 'payment' AND party_type = 'customer'
            AND reference = 'customer-refund' FOR UPDATE`,
        [p.voucherId]
      )
      if (!v) throw new Error('Refund entry not found.')
      await conn.query(
        `UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`,
        [v.amount, v.party_id]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
        [v.amount, v.account_id]
      )
      await conn.query(
        `DELETE FROM customer_ledger
          WHERE customer_id = ? AND entry_type = 'return_cash_refund'
            AND reference_type = 'voucher' AND reference_id = ?`,
        [v.party_id, v.id]
      )
      await conn.query(`DELETE FROM vouchers WHERE id = ?`, [v.id])
      await conn.commit()
      return { ok: true, data: { deleted: true, amount: Number(v.amount) } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  ipcMain.handle('credit:update-repayment', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const [[v]] = await conn.query(
        `SELECT * FROM vouchers WHERE id = ? AND voucher_type='receipt'
           AND reference='repayment' AND party_type='customer'`,
        [p.voucherId]
      )
      if (!v) throw new Error('Repayment entry not found.')
      const newAmount = +(Number(p.amount) || 0).toFixed(2)
      if (newAmount <= 0) throw new Error('Amount must be greater than 0.')
      const newAccountId = p.accountId || v.account_id
      const newDate = p.date || v.voucher_date
      const note = p.note !== undefined ? p.note : v.description

      await conn.query(
        `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`,
        [v.amount, v.party_id]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
        [v.amount, v.account_id]
      )
      await conn.query(
        `UPDATE customers SET current_balance = current_balance - ? WHERE id = ?`,
        [newAmount, v.party_id]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`,
        [newAmount, newAccountId]
      )
      const [[acct]] = await conn.query(
        `SELECT type FROM accounts WHERE id = ?`,
        [newAccountId]
      )
      const method = acct?.type === 'bank' ? 'bank' : 'cash'
      await conn.query(
        `UPDATE vouchers SET amount = ?, account_id = ?, voucher_date = ?, description = ?, payment_method = ?
          WHERE id = ?`,
        [newAmount, newAccountId, newDate, note, method, p.voucherId]
      )
      // Rewrite the repayment's own ledger row (amount AND date). The old code posted an
      // adjustment dated the NEW date, so a date change left the old day's udhaar wrong.
      const rowId = await findRepaymentLedgerRow(conn, v)
      if (rowId) {
        await conn.query(
          `UPDATE customer_ledger
              SET credit = ?, debit = 0, entry_date = ?, description = ?,
                  reference_type = 'voucher', reference_id = ?
            WHERE id = ?`,
          [newAmount, newDate, note || 'Credit repayment', v.id, rowId]
        )
      } else {
        // Row not identifiable (older edit history): undo on the OLD date, redo on the new one.
        await postCustomerLedger(conn, {
          customerId: v.party_id,
          entryType: 'adjustment',
          debit: Number(v.amount),
          referenceType: 'voucher',
          referenceId: v.id,
          description: `Repayment ${v.voucher_no} edited (old ${v.amount} removed)`,
          date: v.voucher_date,
          createdBy: p.actingUserId
        })
        await postCustomerLedger(conn, {
          customerId: v.party_id,
          entryType: 'adjustment',
          credit: newAmount,
          referenceType: 'voucher',
          referenceId: v.id,
          description: `Repayment ${v.voucher_no} edited (new ${newAmount})`,
          date: newDate,
          createdBy: p.actingUserId
        })
      }
      await conn.commit()
      return { ok: true, data: { id: p.voucherId } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  ipcMain.handle('credit:delete-repayment', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      await conn.beginTransaction()
      const [[v]] = await conn.query(
        `SELECT * FROM vouchers WHERE id = ? AND voucher_type='receipt'
           AND reference='repayment' AND party_type='customer'`,
        [p.voucherId]
      )
      if (!v) throw new Error('Repayment entry not found.')
      await conn.query(
        `UPDATE customers SET current_balance = current_balance + ? WHERE id = ?`,
        [v.amount, v.party_id]
      )
      await conn.query(
        `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
        [v.amount, v.account_id]
      )
      // Remove the repayment's own ledger row, like the voucher itself. The old code posted
      // a restoring adjustment with NO date (→ today), so deleting last week's repayment
      // changed today's udhaar and left last week's balances wrong.
      const rowId = await findRepaymentLedgerRow(conn, v)
      await conn.query(`DELETE FROM vouchers WHERE id = ?`, [p.voucherId])
      if (rowId) {
        await conn.query(`DELETE FROM customer_ledger WHERE id = ?`, [rowId])
      } else {
        await postCustomerLedger(conn, {
          customerId: v.party_id,
          entryType: 'adjustment',
          debit: Number(v.amount),
          referenceType: 'voucher',
          referenceId: p.voucherId,
          description: `Repayment ${v.voucher_no} deleted (restored)`,
          date: v.voucher_date, // the repayment's own date, not today
          createdBy: p.actingUserId
        })
      }
      await conn.commit()
      return { ok: true, data: { deleted: true } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // 🆕 shared helper — build a full account ledger for a customer
  async function buildAccountLedger(customerId, from, to) {
    const [[customer]] = await pool.query(
      `SELECT id, code, name, telephone, address, current_balance FROM customers WHERE id = ?`,
      [customerId]
    )
    if (!customer) throw new Error('Customer not found.')

    // Opening carried into the period = current balance minus everything dated on/after `from`.
    // (Auto-absorbs opening balance + any pre-ledger history, so closing always reconciles.)
    let opening
    if (from) {
      const [[b]] = await pool.query(
        `SELECT COALESCE(SUM(debit - credit), 0) AS net FROM customer_ledger WHERE customer_id = ? AND entry_date >= ?`,
        [customerId, from]
      )
      opening = +(Number(customer.current_balance) - Number(b.net)).toFixed(2)
    } else {
      const [[b]] = await pool.query(
        `SELECT COALESCE(SUM(debit - credit), 0) AS net FROM customer_ledger WHERE customer_id = ?`,
        [customerId]
      )
      opening = +(Number(customer.current_balance) - Number(b.net)).toFixed(2)
    }

    const args = [customerId]
    let where = 'WHERE customer_id = ?'
    if (from) {
      where += ' AND entry_date >= ?'
      args.push(from)
    }
    if (to) {
      where += ' AND entry_date <= ?'
      args.push(to)
    }
    const [rows] = await pool.query(
      `SELECT id, entry_date, entry_type, reference_type, reference_id, debit, credit, description
         FROM customer_ledger ${where} ORDER BY entry_date ASC, id ASC`,
      args
    )

    // Enrich sale rows with invoice # + item list ("kya khareeda").
    const saleIds = [
      ...new Set(
        rows
          .filter((r) => r.reference_type === 'sale' && r.reference_id)
          .map((r) => r.reference_id)
      )
    ]
    const saleInfo = {}
    if (saleIds.length) {
      const [items] = await pool.query(
        `SELECT si.sale_id, s.invoice_no, si.description AS item_name, si.quantity
           FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.sale_id IN (?)`,
        [saleIds]
      )
      for (const it of items) {
        if (!saleInfo[it.sale_id])
          saleInfo[it.sale_id] = { invoice_no: it.invoice_no, items: [] }
        saleInfo[it.sale_id].items.push(
          `${it.item_name} ×${Number(it.quantity)}`
        )
      }
    }

    let bal = opening
    const out = rows.map((r) => {
      bal = +(bal + Number(r.debit) - Number(r.credit)).toFixed(2)
      let desc = r.description || '',
        ref = ''
      if (r.reference_type === 'sale' && saleInfo[r.reference_id]) {
        ref = 'INV #' + saleInfo[r.reference_id].invoice_no
        desc = saleInfo[r.reference_id].items.join(', ')
      } else if (r.reference_type === 'return') ref = 'RETURN'
      else if (r.entry_type === 'repayment') ref = 'RECEIPT'
      else if (r.entry_type === 'adjustment') ref = 'ADJ'
      return {
        date: r.entry_date,
        ref,
        type: r.entry_type,
        description: desc,
        debit: Number(r.debit),
        credit: Number(r.credit),
        balance: Math.abs(bal),
        status: bal >= 0 ? 'Dr' : 'Cr'
      }
    })
    const totalDebit = out.reduce((s, r) => s + r.debit, 0)
    const totalCredit = out.reduce((s, r) => s + r.credit, 0)
    return {
      customer,
      from: from || null,
      to: to || null,
      opening: {
        balance: Math.abs(opening),
        status: opening >= 0 ? 'Dr' : 'Cr'
      },
      rows: out,
      totals: {
        debit: +totalDebit.toFixed(2),
        credit: +totalCredit.toFixed(2),
        closing: Math.abs(bal),
        closingStatus: bal >= 0 ? 'Dr' : 'Cr'
      }
    }
  }

  // 🆕 credit:account-ledger — fetch account ledger for a customer
  ipcMain.handle(
    'credit:account-ledger',
    async (_e, { actingUserId, customerId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return {
          ok: true,
          data: await buildAccountLedger(customerId, from, to)
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 credit:export-account-ledger — Excel export
  ipcMain.handle(
    'credit:export-account-ledger',
    async (_e, { actingUserId, customerId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const led = await buildAccountLedger(customerId, from, to)
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showSaveDialog(win, {
          title: 'Export Account Ledger',
          defaultPath: `ledger-${led.customer.code}-${from || 'all'}_${to || 'all'}.xlsx`,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        })
        if (result.canceled || !result.filePath)
          return { ok: true, data: { canceled: true } }
        const sheet = [
          {
            Date: '',
            Tran: '',
            Description: 'Opening Balance',
            Debit: '',
            Credit: '',
            Balance: led.opening.balance,
            Status: led.opening.status
          },
          ...led.rows.map((r) => ({
            Date: r.date,
            Tran: r.ref,
            Description: r.description,
            Debit: r.debit || '',
            Credit: r.credit || '',
            Balance: r.balance,
            Status: r.status
          })),
          {
            Date: '',
            Tran: '',
            Description: 'TOTAL',
            Debit: led.totals.debit,
            Credit: led.totals.credit,
            Balance: led.totals.closing,
            Status: led.totals.closingStatus
          }
        ]
        const ws = XLSX.utils.json_to_sheet(sheet)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Ledger')
        XLSX.writeFile(wb, result.filePath)
        return {
          ok: true,
          data: { path: result.filePath, count: led.rows.length }
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )
}
