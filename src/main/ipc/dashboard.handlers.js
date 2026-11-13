// yah wo hai jo time kay mutabiqq kaya hai
import pool from '../db/pool.js'
import {
  resolveRange,
  accountBalanceAsOf,
  computeReconciliation,
  salesReturnsInRange,
  creditGivenInRange,
  receivableCustomers,
  VOUCHER_KIND_SQL,
  VENDOR_PAYMENT_SQL,
  VENDOR_REFUND_SQL
} from '../services/reconciliation.service.js'
import {
  creditBillRemaining,
  localToday
} from '../services/credit.allocation.js'

// Overdue = credit bill with a promise-to-pay date before today that is STILL unpaid after
// recoveries (FIFO, same as CreditBook). Previously (net_total - amount_received) was used,
// which never changes after the sale, so overdues never went down when a customer paid.
async function overdueBills() {
  const today = localToday()
  const map = await creditBillRemaining(pool)
  return [...map.entries()]
    .filter(([, b]) => b.dueDate && String(b.dueDate) < today && b.remaining > 0.009)
    .map(([id, b]) => ({ id, ...b }))
}

// Payments made to vendors in a range (optionally only from 'cash' or 'bank' accounts).
// Client's rule: they reduce the Cash in Hand / Bank-Online card they were paid from AND the
// Sales card, and appear in those cards' drill-downs.
async function vendorPaymentsIn(rangeStart, rangeEnd, acctType) {
  const [rows] = await pool.query(
    `SELECT v.id, v.voucher_no, v.voucher_date AS invoice_date, TIME(v.created_at) AS pay_time,
            -- refunds from a vendor (money back for returned goods) are shown as minus
            CASE WHEN ${VENDOR_REFUND_SQL} THEN -v.amount ELSE v.amount END AS amount,
            v.description, a.name AS account_name, a.type AS account_type,
            COALESCE(ve.name, '—') AS vendor, po.serial_no AS bill_no
       FROM vouchers v
       JOIN accounts a ON a.id = v.account_id
       LEFT JOIN vendors ve ON ve.id = v.party_id AND v.party_type = 'vendor'
       LEFT JOIN purchase_orders po ON po.id = v.purchase_order_id
      WHERE (${VENDOR_PAYMENT_SQL} OR ${VENDOR_REFUND_SQL}) AND v.voucher_date BETWEEN ? AND ?
        ${acctType ? 'AND a.type = ?' : ''}
      ORDER BY v.voucher_date DESC, v.id DESC`,
    acctType ? [rangeStart, rangeEnd, acctType] : [rangeStart, rangeEnd]
  )
  return rows
}
// Money handed BACK to customers for returned goods, from a 'cash' or 'bank' account, by the
// day it left the drawer/bank (return date). Client's rule: a return reduces the Cash in Hand /
// Bank-Online card too, not only the Sales card. "Reduce credit" returns move no money.
async function customerRefundsIn(rangeStart, rangeEnd, acctType) {
  const [rows] = await pool.query(
    `SELECT r.id, r.return_no, r.return_date AS invoice_date, TIME(r.created_at) AS pay_time,
            r.refund_amount AS amount, CONCAT('#', s.invoice_no) AS against_invoice,
            COALESCE(c.name, '—') AS customer, a.name AS account_name
       FROM sales_returns r
       JOIN accounts a ON a.id = r.account_id
       JOIN sales s ON s.id = r.sale_id
       LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.refund_mode <> 'credit_adjust' AND r.refund_amount > 0
        AND r.return_date BETWEEN ? AND ? AND a.type = ?
     UNION ALL
     -- money paid back later to a customer the shop owed ("Refund to customer")
     SELECT v.id, v.voucher_no, v.voucher_date, TIME(v.created_at), v.amount, '—',
            COALESCE(c.name, '—'), a.name
       FROM vouchers v
       JOIN accounts a ON a.id = v.account_id
       LEFT JOIN customers c ON c.id = v.party_id
      WHERE v.voucher_type = 'payment' AND v.reference = 'customer-refund'
        AND v.voucher_date BETWEEN ? AND ? AND a.type = ?
      ORDER BY invoice_date DESC, id DESC`,
    [rangeStart, rangeEnd, acctType, rangeStart, rangeEnd, acctType]
  )
  return rows
}
const refundTab = (rows, dateCol) => ({
  key: 'customer-refunds',
  label: 'Refunds to customers',
  note: 'Money given back to customers for returned goods on these dates — subtracted from this card.',
  columns: [
    { key: 'return_no', label: 'Return' },
    { key: 'against_invoice', label: 'Bill' },
    { key: 'customer', label: 'Customer' },
    { key: 'account_name', label: 'Paid from' },
    { key: 'amount', label: 'Amount', money: true, sum: true, danger: true },
    ...dateCol,
    { key: 'pay_time', label: 'Time' }
  ],
  rows,
  total: +rows.reduce((t, r) => t + Number(r.amount), 0).toFixed(2)
})

// Shop expenses (rent, refreshment, salary …) paid from a 'cash' or 'bank' account on these
// dates. Client's rule: they are cut from the Cash in Hand card (bank-paid ones from the
// Bank / Online card) and listed in its drill-down.
async function expensesIn(rangeStart, rangeEnd, acctType) {
  const [rows] = await pool.query(
    `SELECT v.id, v.voucher_no, v.voucher_date AS invoice_date, TIME(v.created_at) AS pay_time,
            v.amount, COALESCE(ec.name, 'General') AS category,
            COALESCE(v.payee, '') AS payee, COALESCE(v.description, '') AS description,
            a.name AS account_name
       FROM vouchers v
       JOIN accounts a ON a.id = v.account_id
       LEFT JOIN expense_categories ec ON ec.id = v.expense_category_id
      WHERE v.voucher_type = 'expense' AND v.voucher_date BETWEEN ? AND ? AND a.type = ?
      ORDER BY v.voucher_date DESC, v.id DESC`,
    [rangeStart, rangeEnd, acctType]
  )
  return rows
}
const expenseTab = (rows, dateCol) => ({
  key: 'expenses',
  label: 'Expenses',
  note: 'Shop expenses paid from this account on these dates — subtracted from this card.',
  columns: [
    { key: 'voucher_no', label: '#' },
    { key: 'category', label: 'Category' },
    { key: 'payee', label: 'Payee' },
    { key: 'description', label: 'Detail' },
    { key: 'account_name', label: 'Paid from' },
    { key: 'amount', label: 'Amount', money: true, sum: true, danger: true },
    ...dateCol,
    { key: 'pay_time', label: 'Time' }
  ],
  rows,
  total: +rows.reduce((t, r) => t + Number(r.amount), 0).toFixed(2)
})

const vendorTab = (rows, dateCol) => ({
  key: 'vendor-payments',
  label: 'Vendor Payments',
  note: 'Money paid OUT to vendors on these dates (minus any money a vendor paid back for returned goods) — subtracted from this card.',
  columns: [
    { key: 'voucher_no', label: '#' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'bill_no', label: 'Bill' },
    { key: 'account_name', label: 'Paid from' },
    { key: 'amount', label: 'Amount', money: true, sum: true, danger: true },
    ...dateCol,
    { key: 'pay_time', label: 'Time' }
  ],
  rows,
  total: +rows.reduce((t, r) => t + Number(r.amount), 0).toFixed(2)
})

export function registerDashboardHandlers(ipcMain) {
  ipcMain.handle('dashboard:summary', async (_e, params) => {
    try {
      // Accept either {date} or {from, to}. Blank from/to = "All Time" — previously `!from`
      // turned the blank into today, so "All Time" silently showed only today.
      const { to, rangeStart, rangeEnd } = resolveRange(params)

      // 1) Total sales in range (all payment types)
      const [[salesRow]] = await pool.query(
        `SELECT COALESCE(SUM(net_total),0) AS total, COUNT(*) AS bills
           FROM sales
          WHERE is_cancelled = 0
            AND invoice_date BETWEEN ? AND ?`,
        [rangeStart, rangeEnd]
      )

      // 2) Cash sales in range
      const [[cashRow]] = await pool.query(
        `SELECT COALESCE(SUM(net_total),0) AS total
           FROM sales
          WHERE is_cancelled = 0 AND payment_type = 'cash'
            AND invoice_date BETWEEN ? AND ?`,
        [rangeStart, rangeEnd]
      )

      // 3) Online sales in range
      const [[onlineRow]] = await pool.query(
        `SELECT COALESCE(SUM(net_total),0) AS total
           FROM sales
          WHERE is_cancelled = 0 AND payment_type = 'online'
            AND invoice_date BETWEEN ? AND ?`,
        [rangeStart, rangeEnd]
      )

      // 4) Credit given in range (Awaiting Payments)
      const [[creditRow]] = await pool.query(
        `SELECT COALESCE(SUM(net_total),0) AS total
           FROM sales
          WHERE is_cancelled = 0 AND payment_type = 'credit'
            AND invoice_date BETWEEN ? AND ?`,
        [rangeStart, rangeEnd]
      )

      // 4a) Udhaar actually added by credit bills in range = the unpaid part of each bill.
      // A credit bill with part-payment at the counter (e.g. 1800 with 300 paid) adds only
      // 1500 to receivables; the 300 is already in the drawer via the sale's receipt voucher.
      // Shared helper — the Credit-given drill-down and CreditBook use the same one.
      const creditGiven = await creditGivenInRange(pool, rangeStart, rangeEnd)

      // 4b) Credit repayments (recoveries) collected in range, split by the account type
      // they landed in. Recoveries are money coming back for OLD sales — they are NOT sales
      // and must never be added to the Sales figure (that caused Sales 1800 + 1000 = 2800).
      // They are reported only as creditRecovery / creditCollected.
      const [repaySplitRows] = await pool.query(
        `SELECT a.type AS acct_type, COALESCE(SUM(v.amount),0) AS total
           FROM vouchers v JOIN accounts a ON a.id = v.account_id
          WHERE v.voucher_type = 'receipt' AND v.reference = 'repayment'
            AND v.voucher_date BETWEEN ? AND ?
          GROUP BY a.type`,
        [rangeStart, rangeEnd]
      )
      let cashRepay = 0
      let bankRepay = 0
      for (const r of repaySplitRows) {
        if (r.acct_type === 'bank') bankRepay = Number(r.total)
        else cashRepay = Number(r.total)
      }
      const repaymentsTotal = cashRepay + bankRepay

      // 4c) Paid to vendors in range, by the account it came from (client's rule: reduces the
      //     Cash / Bank card and the Sales card).
      const [vpRows] = await pool.query(
        `SELECT a.type AS acct_type,
                COALESCE(SUM(CASE WHEN ${VENDOR_REFUND_SQL} THEN -v.amount ELSE v.amount END),0) AS total
           FROM vouchers v JOIN accounts a ON a.id = v.account_id
          WHERE (${VENDOR_PAYMENT_SQL} OR ${VENDOR_REFUND_SQL}) AND v.voucher_date BETWEEN ? AND ?
          GROUP BY a.type`,
        [rangeStart, rangeEnd]
      )
      let vendorPaidCash = 0
      let vendorPaidBank = 0
      for (const r of vpRows) {
        if (r.acct_type === 'bank') vendorPaidBank = Number(r.total)
        else vendorPaidCash = Number(r.total)
      }
      const vendorPaid = +(vendorPaidCash + vendorPaidBank).toFixed(2)

      // 5) Overdues — still-unpaid (after recoveries) credit bills past their due date.
      // Same definition as the 'overdues' drill-down, which it used to disagree with.
      const overdueList = await overdueBills()
      const overduesTotal = +overdueList
        .reduce((s, b) => s + b.remaining, 0)
        .toFixed(2)

      // 5b) Sales returns in range (by return date) — subtracted from Sales.
      const returns = await salesReturnsInRange(pool, rangeStart, rangeEnd)

      // Receipts & payments in range
      const [[receipts]] = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM vouchers
           WHERE voucher_type = 'receipt'
             AND voucher_date BETWEEN ? AND ?`,
        [rangeStart, rangeEnd]
      )
      const [[payments]] = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM vouchers
           WHERE voucher_type IN ('payment','expense')
             AND voucher_date BETWEEN ? AND ?`,
        [rangeStart, rangeEnd]
      )

      // Running cash / bank balances at the END of the range (not "today"), so a past
      // date shows what the drawer held that night. For today / All Time this equals
      // accounts.current_balance.
      const cashClosing = await accountBalanceAsOf(pool, 'cash', rangeEnd)
      const bankClosing = await accountBalanceAsOf(pool, 'bank', rangeEnd)

      const receiptsTotal = Number(receipts.total)
      const paymentsTotal = Number(payments.total)
      // Previously `closing` was always today's balance, so opening was wrong for past ranges.
      const closing = +(cashClosing + bankClosing).toFixed(2)
      const opening = +(closing - receiptsTotal + paymentsTotal).toFixed(2)

      // Lifetime receivables (shared helper — identical to the drill-down list) & payables
      const receivables = await receivableCustomers(pool)
      const [[payables]] = await pool.query(
        `SELECT COALESCE(SUM(current_balance),0) AS total
           FROM vendors WHERE current_balance > 0`
      )

      // Top items & customers in range — sales only, net of items/bills returned in range.
      const [topItems] = await pool.query(
        `SELECT i.name, SUM(x.qty) AS qty, SUM(x.amount) AS amount
           FROM (
             SELECT si.item_id, si.quantity AS qty, si.net_amount AS amount
               FROM sale_items si JOIN sales s ON s.id = si.sale_id
              WHERE s.is_cancelled = 0 AND s.invoice_date BETWEEN ? AND ?
             UNION ALL
             SELECT sri.item_id, -sri.quantity, -sri.amount
               FROM sales_return_items sri JOIN sales_returns r ON r.id = sri.return_id
              WHERE r.return_date BETWEEN ? AND ?
           ) x
           JOIN items i ON i.id = x.item_id
          GROUP BY x.item_id, i.name
          ORDER BY amount DESC LIMIT 5`,
        [rangeStart, rangeEnd, rangeStart, rangeEnd]
      )
      const [topCustomers] = await pool.query(
        `SELECT c.name, SUM(x.amount) AS amount
           FROM (
             SELECT s.customer_id, s.net_total AS amount
               FROM sales s
              WHERE s.is_cancelled = 0 AND s.invoice_date BETWEEN ? AND ?
             UNION ALL
             SELECT r.customer_id, -r.total_amount
               FROM sales_returns r WHERE r.return_date BETWEEN ? AND ?
           ) x
           JOIN customers c ON c.id = x.customer_id
          GROUP BY x.customer_id, c.name
          ORDER BY amount DESC LIMIT 5`,
        [rangeStart, rangeEnd, rangeStart, rangeEnd]
      )

      const cashSales = Number(cashRow.total)
      const onlineSales = Number(onlineRow.total)
      const creditSales = Number(creditRow.total)
      const newCredit = creditGiven.total
      const sumAmt = (rows) => +rows.reduce((t, r) => t + Number(r.amount), 0).toFixed(2)
      const refundCash = sumAmt(await customerRefundsIn(rangeStart, rangeEnd, 'cash'))
      const refundBank = sumAmt(await customerRefundsIn(rangeStart, rangeEnd, 'bank'))
      const expenseCash = sumAmt(await expensesIn(rangeStart, rangeEnd, 'cash'))
      const expenseBank = sumAmt(await expensesIn(rangeStart, rangeEnd, 'bank'))

      return {
        ok: true,
        data: {
          from: rangeStart,
          to: rangeEnd,
          date: to, // backward-compat
          // Sales = rows of the `sales` table ONLY (recoveries excluded), NET of returns
          // made in the range. cashSales/onlineSales/creditSales stay gross (by bill type).
          sales: +(Number(salesRow.total) - returns.total).toFixed(2),
          grossSales: Number(salesRow.total),
          // Paid to vendors in range + the Dashboard card values after those payments
          vendorPaidCash: +vendorPaidCash.toFixed(2),
          vendorPaidBank: +vendorPaidBank.toFixed(2),
          vendorPaid,
          salesCard: +(Number(salesRow.total) - returns.total - vendorPaid).toFixed(2),
          // cash/online sales − money refunded to customers from that account − paid to vendors
          refundCash,
          refundBank,
          // ... − shop expenses paid from that account (client's rule)
          expenseCash,
          expenseBank,
          cashCard: +(Number(cashRow.total) - refundCash - vendorPaidCash - expenseCash).toFixed(2),
          bankCard: +(Number(onlineRow.total) - refundBank - vendorPaidBank - expenseBank).toFixed(2),
          salesReturns: returns.total,
          returnCount: returns.count,
          bills: Number(salesRow.bills),
          cashSales,
          onlineSales,
          creditSales,
          // Recoveries (credit repayments) in range — reported on their own, never in Sales.
          creditRecovery: +repaymentsTotal.toFixed(2),
          creditCollected: +repaymentsTotal.toFixed(2), // existing field used by the card
          cashRecovery: +cashRepay.toFixed(2),
          bankRecovery: +bankRepay.toFixed(2),
          // Credit Given = udhaar created by credit bills in range (unpaid part), from the
          // ONE shared helper — the modal and CreditBook show the same number.
          // It is no longer netted against recoveries (that made the card show 1,100 while
          // the modal showed 2,100); the netted figure is kept as netCreditGiven.
          newCredit,
          creditGiven: newCredit,
          creditBills: creditGiven.bills,
          netCreditGiven: +(newCredit - repaymentsTotal).toFixed(2),
          // Running balances at the end of the range — should match the drawer / bank.
          cashBalance: cashClosing,
          bankBalance: bankClosing,
          // Restored to its original meaning: sales paid by cash + online in range.
          cashAndBank: +(cashSales + onlineSales).toFixed(2),
          receivables: receivables.total,
          payables: Number(payables.total),
          overdues: overduesTotal,
          cashflow: {
            opening,
            receipts: receiptsTotal,
            payments: paymentsTotal,
            closing
          },
          topItems,
          topCustomers
        }
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Daily reconciliation snapshot for the selected range (sales / cash / bank / udhaar
  // movement). Separate from dashboard:summary because it needs opening balances as of a
  // past date — heavier queries the stat cards don't need.
  // Credit bills whose promise-to-pay date has passed and are still unpaid (after recoveries
  // and returns) — for the Dashboard alert and the sidebar badge.
  ipcMain.handle('dashboard:overdue-summary', async () => {
    try {
      const list = await overdueBills()
      return {
        ok: true,
        data: {
          count: list.length,
          customers: new Set(list.map((b) => b.customerId)).size,
          total: +list.reduce((s, b) => s + b.remaining, 0).toFixed(2)
        }
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('dashboard:reconciliation', async (_e, params) => {
    try {
      return { ok: true, data: await computeReconciliation(pool, params) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // 📌 NEW: dashboard:detail — drill-down rows for a specific KPI card
  // Payment receipts = credit recoveries (repayment vouchers). Used by the Credit / Payments
  // card and the Sales card's reference-only "Payment Receipts" tab. Recoveries are paid against the
  // customer's udhaar balance, not a specific bill (vouchers have no invoice link for them),
  // hence "Against Invoice" reads "Udhaar balance".
  async function recoveryReceipts(rangeStart, rangeEnd) {
    const [rows] = await pool.query(
      `SELECT v.id, v.voucher_no, v.voucher_date, TIME(v.created_at) AS voucher_time,
              v.amount, v.payment_method, v.description,
              c.id AS customer_id, c.name AS customer, c.code AS customer_code,
              a.name AS account_name, 'Udhaar balance' AS against_invoice
         FROM vouchers v
         JOIN customers c ON c.id = v.party_id AND v.party_type = 'customer'
         LEFT JOIN accounts a ON a.id = v.account_id
        WHERE v.voucher_type = 'receipt' AND v.reference = 'repayment'
          AND v.voucher_date BETWEEN ? AND ?
        ORDER BY v.voucher_date DESC, v.id DESC`,
      [rangeStart, rangeEnd]
    )
    return rows
  }

  ipcMain.handle('dashboard:detail', async (_e, params = {}) => {
    try {
      const { type } = params
      // Range-aware: the cards show totals for the whole From→To range, so the drill-down
      // must list the same range (it used to list only the last day). Callers that still
      // send {date} (CreditBook) keep working through resolveRange.
      const { from, to, rangeStart, rangeEnd } = resolveRange(params)
      const multiDay = rangeStart !== rangeEnd
      const d =
        !multiDay ? rangeStart : !from && !to ? 'All Time' : `${from || '…'} → ${to || '…'}`
      const dateCol = multiDay ? [{ key: 'invoice_date', label: 'Date' }] : []

      // Sales card: Gross / Less Returns / Net summary on top (Net = the card value), then
      // [Sales Invoices (gross)] [Payment Receipts] [Returns]. Payment Receipts (recoveries)
      // are listed for reference only — they are NOT part of Sales (owner asked to keep the
      // tab; the summary block and tab note make the difference explicit).
      if (type === 'sales') {
        const [invoices] = await pool.query(
          `SELECT s.id, s.invoice_no, s.invoice_date, s.invoice_time, s.payment_type,
                  s.net_total, s.amount_received,
                  (s.net_total - s.amount_received) AS outstanding,
                  c.id AS customer_id, c.name AS customer, u.full_name AS salesman
             FROM sales s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN users u ON u.id = s.created_by
            WHERE s.invoice_date BETWEEN ? AND ? AND s.is_cancelled = 0
            ORDER BY s.invoice_date DESC, s.id DESC`,
          [rangeStart, rangeEnd]
        )
        // Returns made in the range (client's rule: cut from the day the customer returned
        // the goods) — they are subtracted from Sales. Each row = the record of that return.
        const [returns] = await pool.query(
          `SELECT r.id, r.return_no, r.return_date AS invoice_date, TIME(r.created_at) AS return_time,
                  r.total_amount, r.refund_mode, CONCAT('#', s.invoice_no) AS against_invoice,
                  s.invoice_date AS bill_date,
                  IF(r.refund_mode = 'credit_adjust', 0, r.refund_amount) AS cash_returned,
                  COALESCE(a.name, 'Credit reduced') AS refunded_from,
                  s.id AS sale_id, c.id AS customer_id, c.name AS customer
             FROM sales_returns r
             JOIN sales s ON s.id = r.sale_id
             JOIN customers c ON c.id = r.customer_id
             LEFT JOIN accounts a ON a.id = r.account_id
            WHERE r.return_date BETWEEN ? AND ?
            ORDER BY r.return_date DESC, r.id DESC`,
          [rangeStart, rangeEnd]
        )
        const gross = +invoices.reduce((s, r) => s + Number(r.net_total), 0).toFixed(2)
        const retTotal = +returns.reduce((s, r) => s + Number(r.total_amount), 0).toFixed(2)
        const net = +(gross - retTotal).toFixed(2)
        const receipts = await recoveryReceipts(rangeStart, rangeEnd)
        const recTotal = +receipts.reduce((s, r) => s + Number(r.amount), 0).toFixed(2)
        const vPay = await vendorPaymentsIn(rangeStart, rangeEnd)
        const vTab = vendorTab(vPay, dateCol)
        const cardNet = +(net - vTab.total).toFixed(2) // = the Sales card
        return {
          ok: true,
          data: {
            title: `Sales — ${d}`,
            // Rendered as a block above the tabs; `net` equals the Sales card.
            summary: { gross, returns: retTotal, netSales: net, vendorPaid: vTab.total, net: cardNet, recoveries: recTotal },
            summaryLines: [
              { label: 'Gross Sales', amount: gross },
              { label: 'Less: Returns', amount: retTotal, minus: true },
              { label: 'Less: Paid to vendors', amount: vTab.total, minus: true },
              { label: 'Sales (card)', amount: cardNet, total: true }
            ],
            summaryNote:
              'Payment Receipts (credit recoveries) are listed for reference only — they are NOT included in Sales.',
            tabs: [
              {
                key: 'invoices',
                label: 'Sales Invoices (gross)',
                columns: [
                  { key: 'invoice_no', label: '#', prefix: '#' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'payment_type', label: 'Type', badge: true },
                  { key: 'net_total', label: 'Amount', money: true, sum: true },
                  ...dateCol,
                  { key: 'invoice_time', label: 'Time' }
                ],
                rows: invoices,
                total: gross,
                rowInvoice: 'id'
              },
              {
                key: 'receipts',
                label: 'Payment Receipts',
                note: 'Credit recoveries — money received for earlier udhaar. NOT included in Sales.',
                columns: [
                  { key: 'voucher_no', label: '#' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'against_invoice', label: 'Against Invoice' },
                  { key: 'amount', label: 'Amount', money: true, sum: true },
                  ...(multiDay ? [{ key: 'voucher_date', label: 'Date' }] : []),
                  { key: 'voucher_time', label: 'Time' }
                ],
                rows: receipts,
                total: recTotal,
                rowCustomer: 'customer_id'
              },
              {
                key: 'returns',
                label: 'Returns',
                note: 'Goods returned on these dates — cut from the Sales of the day they came back. Cash returned = money handed back.',
                columns: [
                  { key: 'return_no', label: '#' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'against_invoice', label: 'Against Invoice' },
                  { key: 'bill_date', label: 'Bill Date' },
                  { key: 'refund_mode', label: 'Refund', badge: true },
                  { key: 'refunded_from', label: 'Paid from' },
                  { key: 'total_amount', label: 'Return Value', money: true, sum: true },
                  { key: 'cash_returned', label: 'Cash Returned', money: true, sum: true, danger: true },
                  ...dateCol,
                  { key: 'return_time', label: 'Time' }
                ],
                rows: returns,
                total: retTotal,
                rowInvoice: 'sale_id'
              },
              vTab
            ]
          }
        }
      }

      if (type === 'cash' || type === 'online') {
        const acctType = type === 'cash' ? 'cash' : 'bank'
        // `kind` labels each movement (SALE / RECOVERY / EXPENSE / …) so a recovery can
        // never be mistaken for a sale when reading the cash list.
        const [rows] = await pool.query(
          `SELECT v.voucher_no, v.voucher_type, v.voucher_date AS invoice_date, v.amount, v.description,
                  ${VOUCHER_KIND_SQL} AS kind,
                  COALESCE(cu.name, ve.name, '—') AS party, a.name AS account_name
             FROM vouchers v
             JOIN accounts a ON a.id = v.account_id
             LEFT JOIN customers cu ON cu.id = v.party_id AND v.party_type = 'customer'
             LEFT JOIN vendors   ve ON ve.id = v.party_id AND v.party_type = 'vendor'
            WHERE v.voucher_date BETWEEN ? AND ? AND a.type = ? AND a.is_active = 1
            ORDER BY v.voucher_date DESC, v.id DESC`,
          [rangeStart, rangeEnd, acctType]
        )
        const signed = rows.map((r) => ({
          ...r,
          direction: r.voucher_type === 'receipt' ? 'In' : 'Out',
          amount_signed:
            (r.voucher_type === 'receipt' ? 1 : -1) * Number(r.amount)
        }))
        const net = signed.reduce((s, r) => s + r.amount_signed, 0)
        // Owner's rule: the Cash in Hand / Bank-Online card shows the CASH (or ONLINE) SALES of
        // the selected dates, and clicking it lists exactly those sale receipts. The full
        // in/out movement stays available as a second tab (drawer check).
        const payType = type === 'cash' ? 'cash' : 'online'
        const [receipts] = await pool.query(
          `SELECT s.id, s.invoice_no, s.invoice_date, s.invoice_time, s.net_total,
                  c.id AS customer_id, c.name AS customer, c.code AS customer_code,
                  a.name AS account_name
             FROM sales s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN accounts a ON a.id = s.payment_account_id
            WHERE s.is_cancelled = 0 AND s.payment_type = ?
              AND s.invoice_date BETWEEN ? AND ?
            ORDER BY s.invoice_date DESC, s.invoice_time DESC, s.id DESC`,
          [payType, rangeStart, rangeEnd]
        )
        const salesTotal = +receipts.reduce((t, r) => t + Number(r.net_total), 0).toFixed(2)
        const label = type === 'cash' ? 'Cash' : 'Online'
        const vTab = vendorTab(await vendorPaymentsIn(rangeStart, rangeEnd, acctType), dateCol)
        const rTab = refundTab(await customerRefundsIn(rangeStart, rangeEnd, acctType), dateCol)
        const eTab = expenseTab(await expensesIn(rangeStart, rangeEnd, acctType), dateCol)
        const cardNet = +(salesTotal - rTab.total - vTab.total - eTab.total).toFixed(2) // = the card
        return {
          ok: true,
          data: {
            title: `${type === 'cash' ? 'Cash in Hand' : 'Bank / Online'} — ${d} · Rs. ${cardNet.toLocaleString('en-PK')}`,
            summaryLines: [
              { label: `${label} sales`, amount: salesTotal },
              { label: 'Less: Refunds to customers', amount: rTab.total, minus: true },
              { label: 'Less: Paid to vendors', amount: vTab.total, minus: true },
              { label: 'Less: Expenses', amount: eTab.total, minus: true },
              { label: type === 'cash' ? 'Cash in Hand (card)' : 'Bank / Online (card)', amount: cardNet, total: true }
            ],
            tabs: [
              {
                key: 'receipts',
                label: `${label} Sale Receipts`,
                note: `Every bill paid by ${payType} on these dates. Credit recoveries are on the Credit / Payments card.`,
                columns: [
                  { key: 'invoice_no', label: '#', prefix: '#' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'account_name', label: 'Account' },
                  { key: 'net_total', label: 'Amount', money: true, sum: true },
                  ...dateCol,
                  { key: 'invoice_time', label: 'Time' }
                ],
                rows: receipts,
                total: salesTotal,
                rowInvoice: 'id'
              },
              rTab,
              vTab,
              eTab,
              {
                key: 'movement',
                label: `All ${type === 'cash' ? 'cash' : 'bank'} in / out`,
                note: 'Everything that moved this account on these dates (sales, recoveries, expenses, purchases, refunds).',
                columns: [
                  { key: 'voucher_no', label: 'Voucher' },
                  ...dateCol,
                  { key: 'kind', label: 'Kind', badge: true },
                  { key: 'party', label: 'Party' },
                  { key: 'direction', label: 'In/Out', badge: true },
                  { key: 'description', label: 'Detail' },
                  { key: 'amount_signed', label: 'Amount', money: true, signed: true, sum: true }
                ],
                rows: signed,
                total: net
              }
            ]
          }
        }
      }

      if (type === 'receivables') {
        // Same shared helper as the "Awaiting Payments" card → totals always match.
        const { rows, total } = await receivableCustomers(pool)
        return {
          ok: true,
          data: {
            title: 'Customers who owe money',
            columns: [
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Customer' },
              { key: 'telephone', label: 'Phone' },
              {
                key: 'current_balance',
                label: 'Outstanding',
                money: true,
                danger: true
              }
            ],
            rows,
            total,
            rowCustomer: 'id'
          }
        }
      }

      // 🆕 Today's credit collections (repayments) — powers the "Credit / Payments" card.
      // Credit / Payments card: ONLY payment receipts (recoveries) — no sales invoices.
      if (type === 'credit-collections') {
        const rows = await recoveryReceipts(rangeStart, rangeEnd)
        return {
          ok: true,
          data: {
            title: `Payment Receipts (credit recovery) — ${d}`,
            note: 'Money received for earlier udhaar. NOT included in Sales.',
            columns: [
              { key: 'voucher_no', label: '#' },
              { key: 'customer', label: 'Customer' },
              { key: 'against_invoice', label: 'Against Invoice' },
              { key: 'payment_method', label: 'Method', badge: true },
              { key: 'account_name', label: 'Account' },
              { key: 'amount', label: 'Amount', money: true, sum: true },
              ...(multiDay ? [{ key: 'voucher_date', label: 'Date' }] : []),
              { key: 'voucher_time', label: 'Time' }
            ],
            rows,
            total: rows.reduce((s, r) => s + Number(r.amount), 0),
            rowCustomer: 'customer_id'
          }
        }
      }

      // 🆕 Today's credit sales specifically (distinct from the lifetime "receivables" list).
      if (type === 'credit') {
        const [rows] = await pool.query(
          `SELECT s.id, s.invoice_no, s.invoice_date, s.invoice_time, s.net_total, s.amount_received,
                  (s.net_total - s.amount_received) AS outstanding,
                  s.customer_id, c.name AS customer, c.code AS customer_code
             FROM sales s
             JOIN customers c ON c.id = s.customer_id
            WHERE s.invoice_date BETWEEN ? AND ? AND s.is_cancelled = 0 AND s.payment_type = 'credit'
            ORDER BY s.invoice_date DESC, s.id DESC`,
          [rangeStart, rangeEnd]
        )
        return {
          ok: true,
          data: {
            title: `Credit given — ${d}`,
            columns: [
              { key: 'invoice_no', label: 'Invoice', prefix: '#' },
              ...dateCol,
              { key: 'invoice_time', label: 'Time' },
              { key: 'customer', label: 'Customer' },
              { key: 'customer_code', label: 'Code' },
              { key: 'net_total', label: 'Total', money: true },
              { key: 'amount_received', label: 'Received', money: true },
              // Footer total = Credit Given (unpaid part) — same shared helper as the card.
              { key: 'outstanding', label: 'Credit Given', money: true, danger: true, sum: true }
            ],
            rows,
            total: (await creditGivenInRange(pool, rangeStart, rangeEnd)).total,
            rowInvoice: 'id',
            rowCustomer: 'customer_id'
          }
        }
      }

      if (type === 'overdues') {
        // Recovery-aware: `outstanding` is what is still unpaid after recoveries (FIFO).
        const list = await overdueBills()
        let rows = []
        if (list.length) {
          const [info] = await pool.query(
            `SELECT s.id, s.invoice_no, s.invoice_date, s.due_date, c.name AS customer,
                    c.telephone AS phone, DATEDIFF(CURDATE(), s.due_date) AS days_late
               FROM sales s JOIN customers c ON c.id = s.customer_id
              WHERE s.id IN (?)`,
            [list.map((b) => b.id)]
          )
          const rem = new Map(list.map((b) => [b.id, b.remaining]))
          rows = info
            .map((r) => ({ ...r, outstanding: rem.get(r.id) }))
            .sort((a, b) => (String(a.due_date) < String(b.due_date) ? -1 : 1))
        }
        return {
          ok: true,
          data: {
            title: 'Overdue bills',
            columns: [
              { key: 'invoice_no', label: 'Invoice', prefix: '#' },
              { key: 'customer', label: 'Customer' },
              { key: 'phone', label: 'Phone' },
              { key: 'invoice_date', label: 'Bill Date' },
              { key: 'due_date', label: 'Was Due' },
              { key: 'days_late', label: 'Days late' },
              {
                key: 'outstanding',
                label: 'Outstanding',
                money: true,
                danger: true
              }
            ],
            rows,
            total: rows.reduce((s, r) => s + Number(r.outstanding), 0),
            rowInvoice: 'id'
          }
        }
      }

      return { ok: false, error: 'Unknown detail type.' }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}
