// What is still unpaid on each credit bill.
//
// Recoveries are recorded against the customer's udhaar balance, not a specific bill, so
// sales.amount_received never changes after the sale. Using (net_total - amount_received) as
// "still due" therefore meant a bill stayed overdue forever, even after the customer paid.
//
// Rule (same as the CreditBook ledger's bill status, credit:ledger): everything the customer
// has settled — recoveries, credit returns, adjustments — pays the customer's opening balance
// first, then the OLDEST credit bills first (FIFO). No DB access to electron, so it can take
// any mysql2 pool/connection.

const r2 = (n) => +Number(n || 0).toFixed(2)

// ONE credit-limit rule for creating AND editing a bill (sales:create / sales:update).
//   balanceWithoutBill + billOutstanding must not exceed credit_limit (0 = no limit).
// For an edit, `balanceWithoutBill` is the customer's balance with this bill's OLD unpaid
// amount already taken out — so 300 → 1700 is judged as 0 + 1700, not 300 + 1700.
export function assertCreditLimit({ creditLimit, balanceWithoutBill, billOutstanding, isEdit }) {
  const lim = Number(creditLimit) || 0
  if (lim <= 0) return
  const bal = Number(balanceWithoutBill) || 0
  const newBal = bal + Number(billOutstanding || 0)
  if (newBal > lim + 0.009) {
    const f = (n) => 'Rs. ' + Number(n).toLocaleString('en-PK')
    throw new Error(
      `Credit limit exceeded — ${isEdit ? 'edit' : 'bill'} NOT saved. Limit: ${f(lim)}, ` +
        `balance ${isEdit ? 'without this bill' : 'before this bill'}: ${f(bal)}, ` +
        `this bill's credit: ${f(billOutstanding)} → would become ${f(newBal)} ` +
        `(over by ${f(newBal - lim)}).`
    )
  }
}

// Local calendar date — the ONE shared helper (re-exported for existing importers).
import { localToday } from './date.util.js'
export { localToday }

/**
 * @returns Map<saleId, { customerId, invoiceDate, dueDate, originalDue, paid, remaining }>
 *          for non-cancelled credit bills (optionally only for `customerIds`).
 */
export async function creditBillRemaining(db, { customerIds } = {}) {
  const args = []
  let where = `s.is_cancelled = 0 AND s.payment_type = 'credit'`
  if (customerIds) {
    const ids = [...new Set(customerIds.filter(Boolean))]
    if (!ids.length) return new Map()
    where += ' AND s.customer_id IN (?)'
    args.push(ids)
  }
  const [bills] = await db.query(
    `SELECT s.id, s.customer_id, s.invoice_date, s.due_date,
            (s.net_total - s.amount_received) AS due
       FROM sales s
      WHERE ${where}
      ORDER BY s.customer_id, s.invoice_date ASC, s.id ASC`,
    args
  )
  const out = new Map()
  if (!bills.length) return out

  const custIds = [...new Set(bills.map((b) => b.customer_id))]
  const [custs] = await db.query(
    `SELECT id, opening_balance, current_balance FROM customers WHERE id IN (?)`,
    [custIds]
  )
  const byCust = new Map()
  for (const b of bills) {
    if (!byCust.has(b.customer_id)) byCust.set(b.customer_id, [])
    byCust.get(b.customer_id).push(b)
  }
  for (const c of custs) {
    const list = byCust.get(c.id) || []
    const opening = Number(c.opening_balance) || 0
    const totalDue = list.reduce((s, b) => s + Number(b.due), 0)
    // Amount already settled = everything charged − what is still owed.
    let pool = r2(Math.max(0, opening + totalDue - Number(c.current_balance)))
    if (pool > 0 && opening > 0) pool = r2(pool - Math.min(pool, opening))
    for (const b of list) {
      const due = Number(b.due)
      const paid = Math.max(0, Math.min(pool, due))
      pool = r2(pool - paid)
      out.set(b.id, {
        customerId: b.customer_id,
        invoiceDate: b.invoice_date,
        dueDate: b.due_date,
        originalDue: r2(due),
        paid: r2(paid),
        remaining: r2(due - paid)
      })
    }
  }
  return out
}

// Adds `remaining_due` and a corrected `is_overdue` to sale rows (sales:list / get / track).
// Overdue = has a promise-to-pay date in the past AND something is still unpaid after
// recoveries. Non-credit bills are never overdue.
export async function applyRemainingDue(db, rows) {
  const list = Array.isArray(rows) ? rows : [rows]
  const credit = list.filter((r) => r && r.payment_type === 'credit')
  const map = await creditBillRemaining(db, {
    customerIds: credit.map((r) => r.customer_id)
  })
  const today = localToday()
  for (const r of list) {
    if (!r) continue
    const info = map.get(r.id)
    r.remaining_due = info ? info.remaining : 0
    r.is_overdue =
      info && r.due_date && String(r.due_date) < today && info.remaining > 0.009 ? 1 : 0
  }
  return rows
}
