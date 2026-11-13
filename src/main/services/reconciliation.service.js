// import { localToday } from './date.util.js'
// // Daily reconciliation maths — kept free of electron/pool imports so it can be run
// // against any mysql2 connection (the app passes the pool; the test script passes a
// // single connection inside a transaction that is rolled back).
// //
// // Rules (agreed with the owner):
// //  • Sales come ONLY from the `sales` table (net_total by payment_type). Recoveries are never sales.
// //  • Closing Cash = Opening + Cash Sales + Recovery + Other Receipts − Purchases − Expenses − Refunds
// //    (plus an "Other Payments" line so nothing that moved the drawer is hidden).
// //  • Refunds come from the `sales_returns` table; they never touch Sales.
// //  • Opening balances = the closing balance at the end of the previous day.

// // Signed effect of a voucher on its account: receipts add money, payments/expenses remove it.
// const SIGNED_VOUCHER = `CASE WHEN v.voucher_type = 'receipt' THEN v.amount ELSE -v.amount END`

// const r2 = (n) => +Number(n || 0).toFixed(2)

// // ONE rule for "money paid to a vendor" (alias `v`): any payment voucher to a vendor
// // (bill payments, later payments in parts) plus old purchase-order payments.
// export const VENDOR_PAYMENT_SQL = `(v.voucher_type = 'payment' AND (v.party_type = 'vendor'
//     OR v.purchase_order_id IS NOT NULL OR v.reference LIKE 'PO-%'))`

// // Money a vendor paid BACK to us (refund for goods returned to them) — alias `v`.
// export const VENDOR_REFUND_SQL = `(v.voucher_type = 'receipt' AND v.party_type = 'vendor')`

// // One label per voucher (alias `v`) so sales money and recoveries are never read as the same
// // thing in lists (Dashboard cash/bank drill-down, Day Book). Same rules as the maths below.
// export const VOUCHER_KIND_SQL = `CASE
//     WHEN v.voucher_type = 'receipt' AND v.reference = 'repayment' THEN 'RECOVERY'
//     WHEN ${VENDOR_REFUND_SQL} THEN 'VENDOR REFUND'
//     WHEN v.voucher_type = 'receipt' AND (v.sale_id IS NOT NULL OR v.reference LIKE 'Invoice %') THEN 'SALE'
//     WHEN v.voucher_type = 'receipt' THEN 'OTHER RECEIPT'
//     WHEN v.voucher_type = 'expense' THEN 'EXPENSE'
//     WHEN ${VENDOR_PAYMENT_SQL} THEN 'VENDOR PAYMENT'
//     WHEN v.voucher_type = 'payment' AND v.reference IN ('return', 'customer-refund') THEN 'REFUND'
//     ELSE 'OTHER PAYMENT'
//   END`

// // ── ONE definition of "Credit Given" for a period, used by EVERY screen ──
// // (Dashboard card, Credit-given drill-down, CreditBook "Today · Credit Given", reconciliation
// // "Naya Credit"). They used to disagree: the card netted off recoveries (1,100) while the
// // modal / CreditBook summed bill totals (2,100).
// //   creditGiven = SUM(net_total − amount_received) of non-cancelled credit bills in range
// // i.e. the udhaar actually created (part-payment taken at the counter is not udhaar).
// export async function creditGivenInRange(db, rangeStart, rangeEnd) {
//   const [[r]] = await db.query(
//     `SELECT COUNT(*) AS bills,
//             COALESCE(SUM(net_total - amount_received),0) AS total,
//             COALESCE(SUM(net_total),0) AS billed
//        FROM sales
//       WHERE payment_type = 'credit' AND is_cancelled = 0
//         AND invoice_date BETWEEN ? AND ?`,
//     [rangeStart, rangeEnd]
//   )
//   return { total: r2(r.total), bills: Number(r.bills), billed: r2(r.billed) }
// }

// // ── ONE definition of "Receivables / Awaiting Payments" (card AND drill-down) ──
// // Every customer who currently owes money (current_balance > 0). The card used to include
// // inactive customers while the drill-down excluded them, so the two could differ.
// export async function receivableCustomers(db) {
//   const [rows] = await db.query(
//     `SELECT id, code, name, telephone, current_balance, is_active
//        FROM customers WHERE current_balance > 0
//       ORDER BY current_balance DESC`
//   )
//   const total = r2(rows.reduce((s, r) => s + Number(r.current_balance), 0))
//   return { rows, total }
// }

// // Sales returns in a range. Client's rule: a return is cut from the Sales of the day the
// // customer RETURNED it (return_date), split by the payment type of the ORIGINAL bill so
// // Cash/Online/Credit can be netted too. The refund money also leaves the drawer that day.
// export async function salesReturnsInRange(db, rangeStart, rangeEnd) {
//   const [[r]] = await db.query(
//     `SELECT COUNT(*) AS cnt,
//             COALESCE(SUM(r.total_amount),0) AS total,
//             COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN r.total_amount ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN s.payment_type='online' THEN r.total_amount ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN r.total_amount ELSE 0 END),0) AS credit
//        FROM sales_returns r JOIN sales s ON s.id = r.sale_id
//       WHERE r.return_date BETWEEN ? AND ?`,
//     [rangeStart, rangeEnd]
//   )
//   return {
//     count: Number(r.cnt),
//     total: r2(r.total),
//     cash: r2(r.cash),
//     online: r2(r.online),
//     credit: r2(r.credit)
//   }
// }

// // Blank from/to = "All Time". Only default to today when the caller sent nothing at all.
// export function resolveRange(params) {
//   const today = localToday()
//   let from = params?.from
//   let to = params?.to
//   if (from == null && to == null && params?.date) {
//     from = params.date
//     to = params.date
//   }
//   if (from == null) from = today
//   if (to == null) to = today
//   return {
//     from,
//     to,
//     rangeStart: from || '1900-01-01',
//     rangeEnd: to || '9999-12-31'
//   }
// }

// // Balance of all active accounts of one type ('cash' | 'bank') at the END of `date`.
// // Anchored on accounts.current_balance (kept live by every money write) minus the net of
// // vouchers dated after `date`. Anchoring on the live balance instead of opening_balance keeps
// // this correct even when opening_balance was never kept in sync (e.g. the seeded Cash account).
// export async function accountBalanceAsOf(db, acctType, date) {
//   const [[cur]] = await db.query(
//     `SELECT COALESCE(SUM(current_balance),0) AS total
//        FROM accounts WHERE is_active = 1 AND type = ?`,
//     [acctType]
//   )
//   const [[after]] = await db.query(
//     `SELECT COALESCE(SUM(${SIGNED_VOUCHER}),0) AS net
//        FROM vouchers v JOIN accounts a ON a.id = v.account_id
//       WHERE a.is_active = 1 AND a.type = ? AND v.voucher_date > ?`,
//     [acctType, date]
//   )
//   return r2(Number(cur.total) - Number(after.net))
// }

// // Same, but at the START of `date` (= closing of the previous day) → used for opening balances.
// async function accountBalanceBefore(db, acctType, date) {
//   const [[cur]] = await db.query(
//     `SELECT COALESCE(SUM(current_balance),0) AS total
//        FROM accounts WHERE is_active = 1 AND type = ?`,
//     [acctType]
//   )
//   const [[after]] = await db.query(
//     `SELECT COALESCE(SUM(${SIGNED_VOUCHER}),0) AS net
//        FROM vouchers v JOIN accounts a ON a.id = v.account_id
//       WHERE a.is_active = 1 AND a.type = ? AND v.voucher_date >= ?`,
//     [acctType, date]
//   )
//   return r2(Number(cur.total) - Number(after.net))
// }

// // Total udhaar (all customers, incl. negative = advance) at the START / END of a date.
// // Same technique: live customers.current_balance minus the customer_ledger net after the point.
// async function receivablesAt(db, date, { inclusive }) {
//   const [[cur]] = await db.query(
//     `SELECT COALESCE(SUM(current_balance),0) AS total FROM customers`
//   )
//   // JOIN customers: ignore orphan ledger rows left behind when customers were deleted with
//   // FOREIGN_KEY_CHECKS=0 (scripts/reset-transactions.js), which otherwise skew the opening.
//   const [[after]] = await db.query(
//     `SELECT COALESCE(SUM(cl.debit - cl.credit),0) AS net
//        FROM customer_ledger cl JOIN customers c ON c.id = cl.customer_id
//       WHERE cl.entry_date ${inclusive ? '>=' : '>'} ?`,
//     [date]
//   )
//   return r2(Number(cur.total) - Number(after.net))
// }

// export async function computeReconciliation(db, params) {
//   const { from, to, rangeStart, rangeEnd } = resolveRange(params)

//   // ── BIKRI: sales table only, split by payment type ──
//   const [[s]] = await db.query(
//     `SELECT COUNT(*) AS bills,
//             COALESCE(SUM(net_total),0) AS total,
//             COALESCE(SUM(CASE WHEN payment_type='cash'   THEN net_total ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN payment_type='online' THEN net_total ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN payment_type='credit' THEN net_total ELSE 0 END),0) AS credit
//        FROM sales
//       WHERE is_cancelled = 0 AND invoice_date BETWEEN ? AND ?`,
//     [rangeStart, rangeEnd]
//   )
//   // Returns are subtracted from the Sales of the day they were RETURNED (client's rule; they used to be ignored, so
//   // Sales was always gross). Cash/Online/Credit and `total` stay GROSS so that
//   // total = cash + online + credit still holds; `returns` and `net` are shown beneath.
//   // Cash/bank money for refunds is already in the Refunds line of the movements below.
//   const ret = await salesReturnsInRange(db, rangeStart, rangeEnd)
//   const sales = {
//     cash: r2(s.cash),
//     online: r2(s.online),
//     credit: r2(s.credit),
//     total: r2(s.total),
//     returns: ret.total,
//     net: r2(Number(s.total) - ret.total),
//     bills: Number(s.bills),
//     returnCount: ret.count
//   }

//   // ── Voucher movement per account type ('cash' | 'bank') ──
//   // other_receipts = receipts that are neither recoveries nor the payment of a sale already
//   // counted in the Sales line for THIS account type (cash sales → cash, online sales → bank).
//   // So e.g. part-payment taken at the counter on a credit bill lands in "Other Receipts".
//   // Legacy sale receipts without sale_id are matched by their 'Invoice N' reference.
//   const [vRows] = await db.query(
//     `SELECT a.type AS acct_type,
//             COALESCE(SUM(CASE WHEN v.voucher_type='receipt' AND v.reference='repayment'
//                               THEN v.amount ELSE 0 END),0) AS recovery,
//             COALESCE(SUM(CASE WHEN v.voucher_type='receipt'
//                                AND COALESCE(v.reference,'') <> 'repayment'
//                                AND NOT EXISTS (
//                                  SELECT 1 FROM sales s2
//                                   WHERE s2.is_cancelled = 0
//                                     AND s2.payment_type = IF(a.type='cash','cash','online')
//                                     AND (s2.id = v.sale_id
//                                          OR (v.sale_id IS NULL
//                                              AND v.reference = CONCAT('Invoice ', s2.invoice_no))))
//                               THEN v.amount ELSE 0 END),0) AS other_receipts,
//             COALESCE(SUM(CASE WHEN ${VENDOR_PAYMENT_SQL}
//                               THEN v.amount ELSE 0 END),0) AS purchases,
//             COALESCE(SUM(CASE WHEN v.voucher_type='expense' THEN v.amount ELSE 0 END),0) AS expenses,
//             COALESCE(SUM(CASE WHEN v.voucher_type='payment'
//                                AND NOT ${VENDOR_PAYMENT_SQL}
//                                AND COALESCE(v.reference,'') <> 'return'
//                               THEN v.amount ELSE 0 END),0) AS other_payments
//        FROM vouchers v JOIN accounts a ON a.id = v.account_id
//       WHERE a.is_active = 1 AND v.voucher_date BETWEEN ? AND ?
//       GROUP BY a.type`,
//     [rangeStart, rangeEnd]
//   )
//   const mv = { cash: {}, bank: {} }
//   for (const r of vRows) mv[r.acct_type === 'bank' ? 'bank' : 'cash'] = r

//   // Refunds from the returns table (owner's rule), bucketed by the refund account's type.
//   // credit_adjust returns move no money, so they are excluded here (they show in Udhaar).
//   const [refRows] = await db.query(
//     `SELECT a.type AS acct_type, COALESCE(SUM(r.refund_amount),0) AS total
//        FROM sales_returns r JOIN accounts a ON a.id = r.account_id
//       WHERE a.is_active = 1 AND r.refund_mode <> 'credit_adjust'
//         AND r.return_date BETWEEN ? AND ?
//       GROUP BY a.type`,
//     [rangeStart, rangeEnd]
//   )
//   const refunds = { cash: 0, bank: 0 }
//   for (const r of refRows) refunds[r.acct_type === 'bank' ? 'bank' : 'cash'] = r2(r.total)

//   // ── CASH KA MOVEMENT ──
//   const cashOpening = await accountBalanceBefore(db, 'cash', rangeStart)
//   const cashMovement = {
//     opening: cashOpening,
//     cashSales: sales.cash,
//     recovery: r2(mv.cash.recovery),
//     otherReceipts: r2(mv.cash.other_receipts),
//     purchases: r2(mv.cash.purchases),
//     expenses: r2(mv.cash.expenses),
//     refunds: refunds.cash,
//     otherPayments: r2(mv.cash.other_payments)
//   }
//   cashMovement.closing = r2(
//     cashMovement.opening +
//       cashMovement.cashSales +
//       cashMovement.recovery +
//       cashMovement.otherReceipts -
//       cashMovement.purchases -
//       cashMovement.expenses -
//       cashMovement.refunds -
//       cashMovement.otherPayments
//   )

//   // ── BANK / ONLINE ──
//   // bankExpenses keeps the spec's name (expense vouchers). Purchases / refunds / other lines
//   // are extra fields so the bank closing also adds up.
//   const bankOpening = await accountBalanceBefore(db, 'bank', rangeStart)
//   const bankMovement = {
//     opening: bankOpening,
//     onlineSales: sales.online,
//     bankRecovery: r2(mv.bank.recovery),
//     otherReceipts: r2(mv.bank.other_receipts),
//     bankExpenses: r2(mv.bank.expenses),
//     purchases: r2(mv.bank.purchases),
//     refunds: refunds.bank,
//     otherPayments: r2(mv.bank.other_payments)
//   }
//   bankMovement.closing = r2(
//     bankMovement.opening +
//       bankMovement.onlineSales +
//       bankMovement.bankRecovery +
//       bankMovement.otherReceipts -
//       bankMovement.bankExpenses -
//       bankMovement.purchases -
//       bankMovement.refunds -
//       bankMovement.otherPayments
//   )

//   // ── UDHAAR MOVEMENT ──
//   // newCredit = unpaid part of credit bills (part-payment at the counter is not udhaar).
//   // adjustments = whatever else moved udhaar in the range (credit returns, bill edits/cancels,
//   // edited/deleted repayments). It is derived as the balancing figure so Closing always equals
//   // the real ledger balance; a non-zero value tells the owner "something other than sale/recovery
//   // changed udhaar today".
//   const recoveryTotal = r2(Number(mv.cash.recovery || 0) + Number(mv.bank.recovery || 0))
//   const creditOpening = await receivablesAt(db, rangeStart, { inclusive: true })
//   const creditClosing = await receivablesAt(db, rangeEnd, { inclusive: false })
//   // Same shared definition as every other "Credit Given" figure.
//   const newCredit = (await creditGivenInRange(db, rangeStart, rangeEnd)).total
//   const creditMovement = {
//     opening: creditOpening,
//     newCredit,
//     recovery: recoveryTotal,
//     adjustments: r2(creditClosing - creditOpening - newCredit + recoveryTotal),
//     closing: creditClosing
//   }

//   // ── Cash counter check: computed closing vs the Dashboard's cashBalance field ──
//   const cashBalance = await accountBalanceAsOf(db, 'cash', rangeEnd)
//   const bankBalance = await accountBalanceAsOf(db, 'bank', rangeEnd)
//   const cashDiff = r2(cashMovement.closing - cashBalance)

//   return {
//     from,
//     to,
//     sales,
//     cashMovement,
//     bankMovement,
//     creditMovement,
//     totalCounterCollection: r2(sales.cash + cashMovement.recovery),
//     actualSales: sales.net, // net of returns
//     netCreditGiven: r2(newCredit - recoveryTotal),
//     cashCounterCheck: {
//       computedClosing: cashMovement.closing,
//       cashBalance,
//       difference: cashDiff,
//       matched: Math.abs(cashDiff) < 0.01
//     },
//     bankCheck: {
//       computedClosing: bankMovement.closing,
//       bankBalance,
//       difference: r2(bankMovement.closing - bankBalance),
//       matched: Math.abs(bankMovement.closing - bankBalance) < 0.01
//     }
//   }
// }

import { localToday } from './date.util.js'
// Daily reconciliation maths — kept free of electron/pool imports so it can be run
// against any mysql2 connection (the app passes the pool; the test script passes a
// single connection inside a transaction that is rolled back).
//
// Rules (agreed with the owner):
//  • Sales come ONLY from the `sales` table (net_total by payment_type). Recoveries are never sales.
//  • Closing Cash = Opening + Cash Sales + Recovery + Other Receipts − Purchases − Expenses − Refunds
//    (plus an "Other Payments" line so nothing that moved the drawer is hidden).
//  • Refunds come from the `sales_returns` table; they never touch Sales.
//  • Opening balances = the closing balance at the end of the previous day.

// Signed effect of a voucher on its account: receipts add money, payments/expenses remove it.
const SIGNED_VOUCHER = `CASE WHEN v.voucher_type = 'receipt' THEN v.amount ELSE -v.amount END`

const r2 = (n) => +Number(n || 0).toFixed(2)

// ONE rule for "money paid to a vendor" (alias `v`): any payment voucher to a vendor
// (bill payments, later payments in parts) plus old purchase-order payments.
export const VENDOR_PAYMENT_SQL = `(v.voucher_type = 'payment' AND (v.party_type = 'vendor'
    OR v.purchase_order_id IS NOT NULL OR v.reference LIKE 'PO-%'))`

// Money a vendor paid BACK to us (refund for goods returned to them) — alias `v`.
export const VENDOR_REFUND_SQL = `(v.voucher_type = 'receipt' AND v.party_type = 'vendor')`

// One label per voucher (alias `v`) so sales money and recoveries are never read as the same
// thing in lists (Dashboard cash/bank drill-down, Day Book). Same rules as the maths below.
export const VOUCHER_KIND_SQL = `CASE
    WHEN v.voucher_type = 'receipt' AND v.reference = 'repayment' THEN 'RECOVERY'
    WHEN ${VENDOR_REFUND_SQL} THEN 'VENDOR REFUND'
    WHEN v.voucher_type = 'receipt' AND (v.sale_id IS NOT NULL OR v.reference LIKE 'Invoice %') THEN 'SALE'
    WHEN v.voucher_type = 'receipt' THEN 'OTHER RECEIPT'
    WHEN v.voucher_type = 'expense' THEN 'EXPENSE'
    WHEN ${VENDOR_PAYMENT_SQL} THEN 'VENDOR PAYMENT'
    WHEN v.voucher_type = 'payment' AND v.reference IN ('return', 'customer-refund') THEN 'REFUND'
    ELSE 'OTHER PAYMENT'
  END`

// ── ONE definition of "Credit Given" for a period, used by EVERY screen ──
// (Dashboard card, Credit-given drill-down, CreditBook "Today · Credit Given", reconciliation
// "Naya Credit"). They used to disagree: the card netted off recoveries (1,100) while the
// modal / CreditBook summed bill totals (2,100).
//   creditGiven = SUM(net_total − amount_received) of non-cancelled credit bills in range
// i.e. the udhaar actually created (part-payment taken at the counter is not udhaar).
export async function creditGivenInRange(db, rangeStart, rangeEnd) {
  const [[r]] = await db.query(
    `SELECT COUNT(*) AS bills,
            COALESCE(SUM(net_total - amount_received),0) AS total,
            COALESCE(SUM(net_total),0) AS billed
       FROM sales
      WHERE payment_type = 'credit' AND is_cancelled = 0
        AND invoice_date BETWEEN ? AND ?`,
    [rangeStart, rangeEnd]
  )
  return { total: r2(r.total), bills: Number(r.bills), billed: r2(r.billed) }
}

// ── ONE definition of "Receivables / Awaiting Payments" (card AND drill-down) ──
// Every customer who currently owes money (current_balance > 0). The card used to include
// inactive customers while the drill-down excluded them, so the two could differ.
export async function receivableCustomers(db) {
  const [rows] = await db.query(
    `SELECT id, code, name, telephone, current_balance, is_active
       FROM customers WHERE current_balance > 0
      ORDER BY current_balance DESC`
  )
  const total = r2(rows.reduce((s, r) => s + Number(r.current_balance), 0))
  return { rows, total }
}

// Sales returns in a range. Client's rule: a return is cut from the Sales of the day the
// customer RETURNED it (return_date), split by the payment type of the ORIGINAL bill so
// Cash/Online/Credit can be netted too. The refund money also leaves the drawer that day.
export async function salesReturnsInRange(db, rangeStart, rangeEnd) {
  const [[r]] = await db.query(
    `SELECT COUNT(*) AS cnt,
            COALESCE(SUM(r.total_amount),0) AS total,
            COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN r.total_amount ELSE 0 END),0) AS cash,
            COALESCE(SUM(CASE WHEN s.payment_type='online' THEN r.total_amount ELSE 0 END),0) AS online,
            COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN r.total_amount ELSE 0 END),0) AS credit
       FROM sales_returns r JOIN sales s ON s.id = r.sale_id
      WHERE r.return_date BETWEEN ? AND ?`,
    [rangeStart, rangeEnd]
  )
  return {
    count: Number(r.cnt),
    total: r2(r.total),
    cash: r2(r.cash),
    online: r2(r.online),
    credit: r2(r.credit)
  }
}

// Blank from/to = "All Time". Only default to today when the caller sent nothing at all.
export function resolveRange(params) {
  const today = localToday()
  let from = params?.from
  let to = params?.to
  if (from == null && to == null && params?.date) {
    from = params.date
    to = params.date
  }
  if (from == null) from = today
  if (to == null) to = today
  return {
    from,
    to,
    rangeStart: from || '1900-01-01',
    rangeEnd: to || '9999-12-31'
  }
}

// Balance of all active accounts of one type ('cash' | 'bank') at the END of `date`.
// Anchored on accounts.current_balance (kept live by every money write) minus the net of
// vouchers dated after `date`. Anchoring on the live balance instead of opening_balance keeps
// this correct even when opening_balance was never kept in sync (e.g. the seeded Cash account).
export async function accountBalanceAsOf(db, acctType, date) {
  const [[cur]] = await db.query(
    `SELECT COALESCE(SUM(current_balance),0) AS total
       FROM accounts WHERE is_active = 1 AND type = ?`,
    [acctType]
  )
  const [[after]] = await db.query(
    `SELECT COALESCE(SUM(${SIGNED_VOUCHER}),0) AS net
       FROM vouchers v JOIN accounts a ON a.id = v.account_id
      WHERE a.is_active = 1 AND a.type = ? AND v.voucher_date > ?`,
    [acctType, date]
  )
  return r2(Number(cur.total) - Number(after.net))
}

// Same, but at the START of `date` (= closing of the previous day) → used for opening balances.
async function accountBalanceBefore(db, acctType, date) {
  const [[cur]] = await db.query(
    `SELECT COALESCE(SUM(current_balance),0) AS total
       FROM accounts WHERE is_active = 1 AND type = ?`,
    [acctType]
  )
  const [[after]] = await db.query(
    `SELECT COALESCE(SUM(${SIGNED_VOUCHER}),0) AS net
       FROM vouchers v JOIN accounts a ON a.id = v.account_id
      WHERE a.is_active = 1 AND a.type = ? AND v.voucher_date >= ?`,
    [acctType, date]
  )
  return r2(Number(cur.total) - Number(after.net))
}

// Total udhaar (all customers, incl. negative = advance) at the START / END of a date.
// Same technique: live customers.current_balance minus the customer_ledger net after the point.
async function receivablesAt(db, date, { inclusive }) {
  const [[cur]] = await db.query(
    `SELECT COALESCE(SUM(current_balance),0) AS total FROM customers`
  )
  // JOIN customers: ignore orphan ledger rows left behind when customers were deleted with
  // FOREIGN_KEY_CHECKS=0 (scripts/reset-transactions.js), which otherwise skew the opening.
  const [[after]] = await db.query(
    `SELECT COALESCE(SUM(cl.debit - cl.credit),0) AS net
       FROM customer_ledger cl JOIN customers c ON c.id = cl.customer_id
      WHERE cl.entry_date ${inclusive ? '>=' : '>'} ?`,
    [date]
  )
  return r2(Number(cur.total) - Number(after.net))
}

export async function computeReconciliation(db, params) {
  const { from, to, rangeStart, rangeEnd } = resolveRange(params)

  // ── BIKRI: sales table only, split by payment type ──
  const [[s]] = await db.query(
    `SELECT COUNT(*) AS bills,
            COALESCE(SUM(net_total),0) AS total,
            COALESCE(SUM(CASE WHEN payment_type='cash'   THEN net_total ELSE 0 END),0) AS cash,
            COALESCE(SUM(CASE WHEN payment_type='online' THEN net_total ELSE 0 END),0) AS online,
            COALESCE(SUM(CASE WHEN payment_type='credit' THEN net_total ELSE 0 END),0) AS credit
       FROM sales
      WHERE is_cancelled = 0 AND invoice_date BETWEEN ? AND ?`,
    [rangeStart, rangeEnd]
  )
  // Returns are subtracted from the Sales of the day they were RETURNED (client's rule; they used to be ignored, so
  // Sales was always gross). Cash/Online/Credit and `total` stay GROSS so that
  // total = cash + online + credit still holds; `returns` and `net` are shown beneath.
  // Cash/bank money for refunds is already in the Refunds line of the movements below.
  const ret = await salesReturnsInRange(db, rangeStart, rangeEnd)
  const sales = {
    cash: r2(s.cash),
    online: r2(s.online),
    credit: r2(s.credit),
    total: r2(s.total),
    returns: ret.total,
    net: r2(Number(s.total) - ret.total),
    bills: Number(s.bills),
    returnCount: ret.count
  }

  // ── Voucher movement per account type ('cash' | 'bank') ──
  // other_receipts = receipts that are neither recoveries nor the payment of a sale already
  // counted in the Sales line for THIS account type (cash sales → cash, online sales → bank).
  // So e.g. part-payment taken at the counter on a credit bill lands in "Other Receipts".
  // Legacy sale receipts without sale_id are matched by their 'Invoice N' reference.
  const [vRows] = await db.query(
    `SELECT a.type AS acct_type,
            COALESCE(SUM(CASE WHEN v.voucher_type='receipt' AND v.reference='repayment'
                              THEN v.amount ELSE 0 END),0) AS recovery,
            COALESCE(SUM(CASE WHEN v.voucher_type='receipt'
                               AND COALESCE(v.reference,'') <> 'repayment'
                               AND NOT EXISTS (
                                 SELECT 1 FROM sales s2
                                  WHERE s2.is_cancelled = 0
                                    AND s2.payment_type = IF(a.type='cash','cash','online')
                                    AND (s2.id = v.sale_id
                                         OR (v.sale_id IS NULL
                                             AND v.reference = CONCAT('Invoice ', s2.invoice_no))))
                              THEN v.amount ELSE 0 END),0) AS other_receipts,
            COALESCE(SUM(CASE WHEN ${VENDOR_PAYMENT_SQL}
                              THEN v.amount ELSE 0 END),0) AS purchases,
            COALESCE(SUM(CASE WHEN v.voucher_type='expense' THEN v.amount ELSE 0 END),0) AS expenses,
            COALESCE(SUM(CASE WHEN v.voucher_type='payment'
                               AND NOT ${VENDOR_PAYMENT_SQL}
                               AND COALESCE(v.reference,'') <> 'return'
                              THEN v.amount ELSE 0 END),0) AS other_payments
       FROM vouchers v JOIN accounts a ON a.id = v.account_id
      WHERE a.is_active = 1 AND v.voucher_date BETWEEN ? AND ?
      GROUP BY a.type`,
    [rangeStart, rangeEnd]
  )
  const mv = { cash: {}, bank: {} }
  for (const r of vRows) mv[r.acct_type === 'bank' ? 'bank' : 'cash'] = r

  // Refunds from the returns table (owner's rule), bucketed by the refund account's type.
  // credit_adjust returns move no money, so they are excluded here (they show in Udhaar).
  const [refRows] = await db.query(
    `SELECT a.type AS acct_type, COALESCE(SUM(r.refund_amount),0) AS total
       FROM sales_returns r JOIN accounts a ON a.id = r.account_id
      WHERE a.is_active = 1 AND r.refund_mode <> 'credit_adjust'
        AND r.return_date BETWEEN ? AND ?
      GROUP BY a.type`,
    [rangeStart, rangeEnd]
  )
  const refunds = { cash: 0, bank: 0 }
  for (const r of refRows)
    refunds[r.acct_type === 'bank' ? 'bank' : 'cash'] = r2(r.total)

  // ── CASH KA MOVEMENT ──
  const cashOpening = await accountBalanceBefore(db, 'cash', rangeStart)
  const cashMovement = {
    opening: cashOpening,
    cashSales: sales.cash,
    recovery: r2(mv.cash.recovery),
    otherReceipts: r2(mv.cash.other_receipts),
    purchases: r2(mv.cash.purchases),
    expenses: r2(mv.cash.expenses),
    refunds: refunds.cash,
    otherPayments: r2(mv.cash.other_payments)
  }

  // NEW: Calculate Total Available Cash
  cashMovement.available = r2(
    cashMovement.opening +
      cashMovement.cashSales +
      cashMovement.recovery +
      cashMovement.otherReceipts
  )

  cashMovement.closing = r2(
    cashMovement.available - // <-- Changed to use 'available'
      cashMovement.purchases -
      cashMovement.expenses -
      cashMovement.refunds -
      cashMovement.otherPayments
  )

  // ── BANK / ONLINE ──
  // bankExpenses keeps the spec's name (expense vouchers). Purchases / refunds / other lines
  // are extra fields so the bank closing also adds up.
  const bankOpening = await accountBalanceBefore(db, 'bank', rangeStart)
  const bankMovement = {
    opening: bankOpening,
    onlineSales: sales.online,
    bankRecovery: r2(mv.bank.recovery),
    otherReceipts: r2(mv.bank.other_receipts),
    bankExpenses: r2(mv.bank.expenses),
    purchases: r2(mv.bank.purchases),
    refunds: refunds.bank,
    otherPayments: r2(mv.bank.other_payments)
  }

  // NEW: Calculate Total Available Bank
  bankMovement.available = r2(
    bankMovement.opening +
      bankMovement.onlineSales +
      bankMovement.bankRecovery +
      bankMovement.otherReceipts
  )

  bankMovement.closing = r2(
    bankMovement.available - // <-- Changed to use 'available'
      bankMovement.bankExpenses -
      bankMovement.purchases -
      bankMovement.refunds -
      bankMovement.otherPayments
  )

  // ── UDHAAR MOVEMENT ──
  // newCredit = unpaid part of credit bills (part-payment at the counter is not udhaar).
  // adjustments = whatever else moved udhaar in the range (credit returns, bill edits/cancels,
  // edited/deleted repayments). It is derived as the balancing figure so Closing always equals
  // the real ledger balance; a non-zero value tells the owner "something other than sale/recovery
  // changed udhaar today".
  const recoveryTotal = r2(
    Number(mv.cash.recovery || 0) + Number(mv.bank.recovery || 0)
  )
  const creditOpening = await receivablesAt(db, rangeStart, { inclusive: true })
  const creditClosing = await receivablesAt(db, rangeEnd, { inclusive: false })
  // Same shared definition as every other "Credit Given" figure.
  const newCredit = (await creditGivenInRange(db, rangeStart, rangeEnd)).total
  const creditMovement = {
    opening: creditOpening,
    newCredit,
    recovery: recoveryTotal,
    adjustments: r2(creditClosing - creditOpening - newCredit + recoveryTotal),
    closing: creditClosing
  }

  // ── Cash counter check: computed closing vs the Dashboard's cashBalance field ──
  const cashBalance = await accountBalanceAsOf(db, 'cash', rangeEnd)
  const bankBalance = await accountBalanceAsOf(db, 'bank', rangeEnd)
  const cashDiff = r2(cashMovement.closing - cashBalance)

  return {
    from,
    to,
    sales,
    cashMovement,
    bankMovement,
    creditMovement,
    totalCounterCollection: r2(sales.cash + cashMovement.recovery),
    actualSales: sales.net, // net of returns
    netCreditGiven: r2(newCredit - recoveryTotal),
    cashCounterCheck: {
      computedClosing: cashMovement.closing,
      cashBalance,
      difference: cashDiff,
      matched: Math.abs(cashDiff) < 0.01
    },
    bankCheck: {
      computedClosing: bankMovement.closing,
      bankBalance,
      difference: r2(bankMovement.closing - bankBalance),
      matched: Math.abs(bankMovement.closing - bankBalance) < 0.01
    }
  }
}
