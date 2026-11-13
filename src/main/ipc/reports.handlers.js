// import { dialog, BrowserWindow } from 'electron'
// import * as XLSX from 'xlsx'
// import pool from '../db/pool.js'
// import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'
// import {
//   VOUCHER_KIND_SQL,
//   VENDOR_PAYMENT_SQL,
//   salesReturnsInRange
// } from '../services/reconciliation.service.js'

// import { localToday } from '../services/date.util.js'
// // Build the sales-date filter fragment shared by summary + export.
// function dateFrag(from, to, args) {
//   let frag = ''
//   if (from) {
//     frag += ' AND s.invoice_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     frag += ' AND s.invoice_date <= ?'
//     args.push(to)
//   }
//   return frag
// }

// // Returns made in [from, to] (client's rule: cut from the day the goods came back, return_date)
// // grouped by a column of the ORIGINAL sale ('customer_id' | 'salesman_id'). Used to show
// // Returns / Net Sales beside gross sales.
// async function returnsBy(saleCol, from, to) {
//   const args = []
//   let w = ''
//   if (from) {
//     w += ' AND r.return_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     w += ' AND r.return_date <= ?'
//     args.push(to)
//   }
//   const [rows] = await pool.query(
//     `SELECT s.${saleCol} AS k, COALESCE(SUM(r.total_amount),0) AS total
//        FROM sales_returns r JOIN sales s ON s.id = r.sale_id
//       WHERE 1=1${w}
//       GROUP BY s.${saleCol}`,
//     args
//   )
//   return new Map(rows.map((r) => [r.k ?? null, Number(r.total)]))
// }

// async function customerSummary(from, to, search) {
//   const args = []
//   const df = dateFrag(from, to, args)
//   let searchWhere = ''
//   if (search && search.trim()) {
//     searchWhere = ' WHERE (c.name LIKE ? OR c.code LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s)
//   }
//   const [rows] = await pool.query(
//     `SELECT c.id, c.code, c.name, c.current_balance AS outstanding,
//             COUNT(s.id) AS bills,
//             COALESCE(SUM(s.net_total),0)        AS billed,
//             COALESCE(SUM(s.amount_received),0)  AS received,
//             COALESCE(SUM(s.cash_back),0)        AS change_given,
//             COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash_total,
//             COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online_total,
//             COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit_total
//        FROM customers c
//        LEFT JOIN sales s ON s.customer_id = c.id AND s.is_cancelled = 0${df}
//        ${searchWhere}
//       GROUP BY c.id, c.code, c.name, c.current_balance
//      HAVING bills > 0 OR outstanding > 0
//       ORDER BY billed DESC, outstanding DESC`,
//     args
//   )
//   // `billed` stays gross (it pairs with received / cash / online / credit);
//   // `returns` and `net_sales` show what the customer actually kept.
//   const ret = await returnsBy('customer_id', from, to)
//   for (const r of rows) {
//     r.returns = ret.get(r.id) || 0
//     r.net_sales = +(Number(r.billed) - r.returns).toFixed(2)
//   }
//   return rows
// }

// // Sales report — `sales` table ONLY (credit recoveries are in the Credit Recovery report).
// // groupBy: 'day' (default) | 'month' | 'year'. The period is returned in `invoice_date`
// // (existing field the page/export already read) and `period`.
// const SALES_PERIOD = {
//   day: 's.invoice_date',
//   month: "DATE_FORMAT(s.invoice_date, '%Y-%m')",
//   year: 'CAST(YEAR(s.invoice_date) AS CHAR)'
// }
// async function salesSummary(from, to, groupBy = 'day') {
//   const args = []
//   dateFrag(from, to, args)
//   const periodExpr = SALES_PERIOD[groupBy] || SALES_PERIOD.day
//   const [rows] = await pool.query(
//     `SELECT ${periodExpr} AS invoice_date, ${periodExpr} AS period, COUNT(*) AS bills,
//             COALESCE(SUM(s.net_total),0)       AS sales,
//             COALESCE(SUM(s.discount),0)        AS discount,
//             COALESCE(SUM(s.amount_received),0) AS received,
//             COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit,
//             -- how MANY bills of each type (owner wants counts, not just amounts)
//             COALESCE(SUM(s.payment_type='cash'),0)   AS cash_bills,
//             COALESCE(SUM(s.payment_type='online'),0) AS online_bills,
//             COALESCE(SUM(s.payment_type='credit'),0) AS credit_bills
//        FROM sales s
//       WHERE s.is_cancelled = 0 ${from ? 'AND s.invoice_date >= ?' : ''} ${to ? 'AND s.invoice_date <= ?' : ''}
//       GROUP BY ${periodExpr}
//       ORDER BY ${periodExpr} DESC`,
//     args
//   )

//   // Returns reduce Sales in the period they happen (return_date). `sales` and the
//   // cash/online/credit split stay gross; `returns` and `net_sales` are added per period.
//   // Client's rule: a return reduces the Sales of the period it came back in (return_date).
//   const retPeriod = periodExpr.replace(/s\.invoice_date/g, 'r.return_date')
//   const rArgs = []
//   let rWhere = ''
//   if (from) {
//     rWhere += ' AND r.return_date >= ?'
//     rArgs.push(from)
//   }
//   if (to) {
//     rWhere += ' AND r.return_date <= ?'
//     rArgs.push(to)
//   }
//   const [retRows] = await pool.query(
//     `SELECT ${retPeriod} AS period, COALESCE(SUM(r.total_amount),0) AS returns
//        FROM sales_returns r JOIN sales s ON s.id = r.sale_id WHERE 1=1${rWhere}
//       GROUP BY ${retPeriod}`,
//     rArgs
//   )
//   const byPeriod = new Map(rows.map((r) => [String(r.period), r]))
//   for (const rr of retRows) {
//     // A period with returns but no new bills still needs a row.
//     if (!byPeriod.has(String(rr.period))) {
//       const blank = {
//         invoice_date: rr.period,
//         period: rr.period,
//         bills: 0,
//         sales: 0,
//         discount: 0,
//         received: 0,
//         cash: 0,
//         online: 0,
//         credit: 0,
//         cash_bills: 0,
//         online_bills: 0,
//         credit_bills: 0
//       }
//       byPeriod.set(String(rr.period), blank)
//       rows.push(blank)
//     }
//     byPeriod.get(String(rr.period)).returns = Number(rr.returns)
//   }
//   for (const r of rows) {
//     r.returns = Number(r.returns || 0)
//     r.net_sales = +(Number(r.sales) - r.returns).toFixed(2)
//   }
//   rows.sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1))

//   const totals = rows.reduce(
//     (t, r) => ({
//       bills: t.bills + Number(r.bills),
//       sales: t.sales + Number(r.sales),
//       discount: t.discount + Number(r.discount),
//       received: t.received + Number(r.received),
//       cash: t.cash + Number(r.cash),
//       online: t.online + Number(r.online),
//       credit: t.credit + Number(r.credit),
//       returns: t.returns + r.returns,
//       net_sales: +(t.net_sales + r.net_sales).toFixed(2),
//       cash_bills: t.cash_bills + Number(r.cash_bills || 0),
//       online_bills: t.online_bills + Number(r.online_bills || 0),
//       credit_bills: t.credit_bills + Number(r.credit_bills || 0)
//     }),
//     {
//       bills: 0,
//       sales: 0,
//       discount: 0,
//       received: 0,
//       cash: 0,
//       online: 0,
//       credit: 0,
//       returns: 0,
//       net_sales: 0,
//       cash_bills: 0,
//       online_bills: 0,
//       credit_bills: 0
//     }
//   )
//   return { rows, totals }
// }

// // Sales-invoice search (F2). Runs in SQL so the on-screen list and the Excel export match.
// //   >1000  >=1000  <500  <=500  =1300   → invoice amount (net_total) comparisons
// //   1000-2000                           → amount range (inclusive)
// //   1001  (digits only)                 → invoice # 1001, OR customer code 1001 / ending in
// //                                          1001 (codes are long, e.g. 12001001), OR name
// //   anything else                       → invoice # / customer name / customer code contains
// export function invoiceSearchSql(search) {
//   const q = String(search || '').trim()
//   if (!q) return null
//   let m = q.match(/^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/)
//   if (m) return { sql: `s.net_total ${m[1]} ?`, args: [Number(m[2])] }
//   m = q.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
//   if (m) {
//     const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y)
//     return { sql: 's.net_total BETWEEN ? AND ?', args: [a, b] }
//   }
//   if (/^\d+$/.test(q))
//     return {
//       sql: '(s.invoice_no = ? OR c.code = ? OR c.code LIKE ? OR c.name LIKE ?)',
//       args: [q, q, `%${q}`, `%${q}%`]
//     }
//   const like = `%${q}%`
//   return {
//     sql: '(s.invoice_no LIKE ? OR c.name LIKE ? OR c.code LIKE ?)',
//     args: [like, like, like]
//   }
// }

// // Every individual sales invoice in the period (Sales report -> "All Invoices").
// // Lets the owner see each bill and count how many were cash / online / credit.
// // Sales table only (not cancelled); returns on each bill are shown alongside.
// async function salesInvoices(from, to, paymentType, search) {
//   const args = []
//   let where = 'WHERE s.is_cancelled = 0'
//   if (from) {
//     where += ' AND s.invoice_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     where += ' AND s.invoice_date <= ?'
//     args.push(to)
//   }
//   if (['cash', 'online', 'credit'].includes(paymentType)) {
//     where += ' AND s.payment_type = ?'
//     args.push(paymentType)
//   }
//   const sq = invoiceSearchSql(search)
//   if (sq) {
//     where += ` AND ${sq.sql}`
//     args.push(...sq.args)
//   }
//   const [rows] = await pool.query(
//     `SELECT s.id, s.invoice_no, s.invoice_date, s.invoice_time, s.payment_type,
//             s.net_total, s.discount, s.amount_received,
//             (s.net_total - s.amount_received) AS outstanding,
//             c.name AS customer, c.code AS customer_code,
//             sm.name AS salesman, u.full_name AS operator,
//             (SELECT COALESCE(SUM(r.total_amount),0) FROM sales_returns r WHERE r.sale_id = s.id) AS returned
//        FROM sales s
//        JOIN customers c ON c.id = s.customer_id
//        LEFT JOIN users u ON u.id = s.created_by
//        LEFT JOIN salesmen sm ON sm.id = s.salesman_id
//       ${where}
//       ORDER BY s.invoice_date DESC, s.invoice_time DESC, s.id DESC`,
//     args
//   )
//   const blank = () => ({ count: 0, amount: 0 })
//   const totals = { count: 0, amount: 0, cash: blank(), online: blank(), credit: blank(), returned: 0 }
//   for (const r of rows) {
//     totals.count += 1
//     totals.amount = +(totals.amount + Number(r.net_total)).toFixed(2)
//     const b = totals[r.payment_type]
//     if (b) {
//       b.count += 1
//       b.amount = +(b.amount + Number(r.net_total)).toFixed(2)
//     }
//     totals.returned = +(totals.returned + Number(r.returned)).toFixed(2)
//   }
//   return { rows, totals }
// }

// async function purchaseList(from, to) {
//   const args = []
//   const [rows] = await pool.query(
//     `SELECT p.id, p.serial_no, p.order_date, p.status, v.name AS vendor,
//             p.sub_total, p.gst_amount, p.total_incl_tax,
//             -- goods sent back to the vendor against this bill (was not shown at all)
//             (SELECT COALESCE(SUM(pr.total_amount),0) FROM purchase_returns pr
//               WHERE pr.purchase_order_id = p.id) AS returned
//        FROM purchase_orders p
//        LEFT JOIN vendors v ON v.id = p.vendor_id
//       WHERE 1=1 ${from ? 'AND p.order_date >= ?' : ''} ${to ? 'AND p.order_date <= ?' : ''}
//       ORDER BY p.order_date DESC, p.id DESC`,
//     [...(from ? [from] : []), ...(to ? [to] : [])]
//   )
//   for (const r of rows) {
//     r.returned = Number(r.returned) || 0
//     r.net = +(Number(r.total_incl_tax) - r.returned).toFixed(2)
//   }
//   const totals = rows.reduce(
//     (t, r) => {
//       const recv = r.status === 'received'
//       return {
//         orders: t.orders + 1,
//         received: t.received + (recv ? 1 : 0),
//         sub: t.sub + (recv ? Number(r.sub_total) : 0),
//         gst: t.gst + (recv ? Number(r.gst_amount) : 0),
//         total: t.total + (recv ? Number(r.total_incl_tax) : 0),
//         returned: t.returned + (recv ? r.returned : 0)
//       }
//     },
//     { orders: 0, received: 0, sub: 0, gst: 0, total: 0, returned: 0 }
//   )
//   totals.returned = +totals.returned.toFixed(2)
//   totals.net = +(totals.total - totals.returned).toFixed(2)
//   return { rows, totals }
// }

// async function purchasePayments(from, to) {
//   const args = []
//   let df = ''
//   if (from) {
//     df += ' AND v.voucher_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     df += ' AND v.voucher_date <= ?'
//     args.push(to)
//   }
//   const [rows] = await pool.query(
//     `SELECT v.voucher_no, v.voucher_date, v.amount, v.payment_method, v.reference,
//             a.name AS account_name, ve.name AS vendor, po.serial_no
//        FROM vouchers v
//        LEFT JOIN accounts a ON a.id = v.account_id
//        LEFT JOIN purchase_orders po ON po.id = v.purchase_order_id
//        LEFT JOIN vendors ve ON ve.id = v.party_id AND v.party_type = 'vendor'
//       WHERE ${VENDOR_PAYMENT_SQL} ${df}
//       ORDER BY v.voucher_date DESC, v.id DESC`,
//     args
//   )
//   const totals = rows.reduce(
//     (t, r) => ({
//       total: t.total + Number(r.amount),
//       cash: t.cash + (r.payment_method === 'cash' ? Number(r.amount) : 0),
//       bank: t.bank + (r.payment_method === 'bank' ? Number(r.amount) : 0)
//     }),
//     { total: 0, cash: 0, bank: 0 }
//   )
//   return { rows, totals }
// }

// // ✅ Phase A3 — salesman performance (with optional name search)
// async function salesmanPerformance(from, to, search) {
//   const dateArgs = []
//   let df = ''
//   if (from) {
//     df += ' AND s.invoice_date >= ?'
//     dateArgs.push(from)
//   }
//   if (to) {
//     df += ' AND s.invoice_date <= ?'
//     dateArgs.push(to)
//   }

//   const args = [...dateArgs]
//   let searchWhere = ''
//   if (search && search.trim()) {
//     searchWhere = ' WHERE sm.name LIKE ?'
//     args.push(`%${search.trim()}%`)
//   }

//   const [rows] = await pool.query(
//     `SELECT sm.id, sm.name, sm.phone,
//             COUNT(s.id) AS bills,
//             COALESCE(SUM(s.net_total),0)       AS sales,
//             COALESCE(SUM(s.discount),0)        AS discount,
//             COALESCE(SUM(s.amount_received),0) AS received,
//             COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit
//        FROM salesmen sm
//        LEFT JOIN sales s
//               ON s.salesman_id = sm.id
//              AND s.is_cancelled = 0${df}
//        ${searchWhere}
//       GROUP BY sm.id, sm.name, sm.phone
//       ORDER BY sales DESC, sm.name`,
//     args
//   )

//   // Unassigned row — only when NOT searching (skip when filtering by name)
//   if (!search || !search.trim()) {
//     const [un] = await pool.query(
//       `SELECT COUNT(*) AS bills,
//               COALESCE(SUM(s.net_total),0)       AS sales,
//               COALESCE(SUM(s.discount),0)        AS discount,
//               COALESCE(SUM(s.amount_received),0) AS received,
//               COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
//               COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
//               COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit
//          FROM sales s
//         WHERE s.is_cancelled = 0
//           AND s.salesman_id IS NULL${df}`,
//       dateArgs
//     )
//     if (un[0] && Number(un[0].bills) > 0) {
//       rows.push({ id: null, name: '(Unassigned)', phone: null, ...un[0] })
//     }
//   }

//   // Returns of each salesman's bills (by return date) → Net Sales. `sales` stays gross.
//   const ret = await returnsBy('salesman_id', from, to)
//   for (const r of rows) {
//     r.returns = ret.get(r.id ?? null) || 0
//     r.net_sales = +(Number(r.sales) - r.returns).toFixed(2)
//   }

//   const totals = rows.reduce(
//     (t, r) => ({
//       bills: t.bills + Number(r.bills),
//       sales: t.sales + Number(r.sales),
//       discount: t.discount + Number(r.discount),
//       received: t.received + Number(r.received),
//       cash: t.cash + Number(r.cash),
//       online: t.online + Number(r.online),
//       credit: t.credit + Number(r.credit),
//       returns: t.returns + r.returns,
//       net_sales: +(t.net_sales + r.net_sales).toFixed(2)
//     }),
//     {
//       bills: 0,
//       sales: 0,
//       discount: 0,
//       received: 0,
//       cash: 0,
//       online: 0,
//       credit: 0,
//       returns: 0,
//       net_sales: 0
//     }
//   )
//   return { rows, totals }
// }

// // ✅ CHANGED: now accepts categoryId
// async function stockValuation(search, categoryId) {
//   const args = []
//   let sw = ''
//   if (search && search.trim()) {
//     sw += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s)
//   }
//   if (categoryId) {
//     sw += ' AND COALESCE(sc.category_id, i.category_id) = ?'
//     args.push(categoryId)
//   }
//   const [rows] = await pool.query(
//     `SELECT i.item_code, i.name, i.unit, i.size, i.current_stock, i.purchase_price,
//             i.selling_price, i.average_cost, i.reorder_quantity, i.low_stock_threshold,
//             (i.current_stock * i.average_cost) AS value,
//             c.name AS category,
//             sc.name AS sub_category,
//             CASE WHEN i.low_stock_threshold > 0 THEN i.low_stock_threshold ELSE i.reorder_quantity END AS threshold
//        FROM items i
//        LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
//        LEFT JOIN categories c ON c.id = COALESCE(sc.category_id, i.category_id)
//       WHERE i.is_active = 1 ${sw}
//       ORDER BY value DESC`,
//     args
//   )
//   const totals = rows.reduce(
//     (t, r) => {
//       const th = Number(r.threshold)
//       const low = th > 0 && Number(r.current_stock) <= th
//       return {
//         items: t.items + 1,
//         qty: t.qty + Number(r.current_stock),
//         value: t.value + Number(r.value),
//         low: t.low + (low ? 1 : 0)
//       }
//     },
//     { items: 0, qty: 0, value: 0, low: 0 }
//   )
//   return { rows, totals }
// }

// async function dayBook(date) {
//   const d = date || localToday()
//   // `kind` = SALE / RECOVERY / OTHER RECEIPT / EXPENSE / PURCHASE / REFUND / OTHER PAYMENT,
//   // so sale money and credit recoveries are separate, clearly labelled rows.
//   const [vouchers] = await pool.query(
//     `SELECT v.voucher_no, v.voucher_type, v.payment_method, v.amount, v.reference,
//             v.description, a.name AS account_name, ${VOUCHER_KIND_SQL} AS kind,
//             COALESCE(cu.name, ve.name, v.payee) AS party
//        FROM vouchers v
//        LEFT JOIN accounts a ON a.id = v.account_id
//        LEFT JOIN customers cu ON cu.id = v.party_id AND v.party_type = 'customer'
//        LEFT JOIN vendors   ve ON ve.id = v.party_id AND v.party_type = 'vendor'
//       WHERE v.voucher_date = ?
//       ORDER BY v.voucher_type, v.id`,
//     [d]
//   )
//   const receipts = vouchers
//     .filter((v) => v.voucher_type === 'receipt')
//     .reduce((s, v) => s + Number(v.amount), 0)
//   const payments = vouchers
//     .filter((v) => v.voucher_type !== 'receipt')
//     .reduce((s, v) => s + Number(v.amount), 0)
//   // Per-kind totals (e.g. byKind.SALE vs byKind.RECOVERY) — never merged.
//   const byKind = {}
//   for (const v of vouchers)
//     byKind[v.kind] = +((byKind[v.kind] || 0) + Number(v.amount)).toFixed(2)
//   // Sales figure comes from the sales table only (includes credit bills, which move no cash).
//   const [[sales]] = await pool.query(
//     `SELECT COUNT(*) AS bills, COALESCE(SUM(net_total),0) AS total,
//             COALESCE(SUM(CASE WHEN payment_type='cash'   THEN net_total ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN payment_type='online' THEN net_total ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN payment_type='credit' THEN net_total ELSE 0 END),0) AS credit
//        FROM sales WHERE invoice_date = ? AND is_cancelled = 0`,
//     [d]
//   )
//   const [[purch]] = await pool.query(
//     `SELECT COUNT(*) AS orders, COALESCE(SUM(total_incl_tax),0) AS total
//        FROM purchase_orders WHERE order_date = ? AND status = 'received'`,
//     [d]
//   )
//   // Returns made today reduce today's Sales (client's rule; the refund money itself is a REFUND row).
//   const ret = await salesReturnsInRange(pool, d, d)
//   return {
//     date: d,
//     vouchers,
//     receipts: +receipts.toFixed(2),
//     payments: +payments.toFixed(2),
//     net: +(receipts - payments).toFixed(2),
//     salesBills: Number(sales.bills),
//     salesTotal: Number(sales.total),
//     salesCash: Number(sales.cash),
//     salesOnline: Number(sales.online),
//     salesCredit: Number(sales.credit),
//     salesReturns: ret.total,
//     salesReturnCount: ret.count,
//     netSales: +(Number(sales.total) - ret.total).toFixed(2),
//     recoveryTotal: byKind.RECOVERY || 0,
//     byKind,
//     purchaseOrders: Number(purch.orders),
//     purchaseTotal: Number(purch.total)
//   }
// }

// // 🆕 Credit Recovery report — repayment vouchers only (money received for earlier udhaar).
// // Kept completely apart from the Sales report so recoveries are never read as sales.
// async function creditRecovery(from, to, search) {
//   const args = []
//   let where = `WHERE v.voucher_type = 'receipt' AND v.reference = 'repayment'`
//   if (from) {
//     where += ' AND v.voucher_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     where += ' AND v.voucher_date <= ?'
//     args.push(to)
//   }
//   if (search && search.trim()) {
//     where += ' AND (c.name LIKE ? OR c.code LIKE ? OR v.voucher_no LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s, s)
//   }
//   const [rows] = await pool.query(
//     `SELECT v.id, v.voucher_no, v.voucher_date, TIME(v.created_at) AS voucher_time,
//             v.amount, v.payment_method, v.description,
//             a.name AS account_name, a.type AS account_type,
//             c.id AS customer_id, c.code AS customer_code, c.name AS customer,
//             c.current_balance AS balance_now, u.full_name AS received_by
//        FROM vouchers v
//        JOIN customers c ON c.id = v.party_id AND v.party_type = 'customer'
//        LEFT JOIN accounts a ON a.id = v.account_id
//        LEFT JOIN users u ON u.id = v.created_by
//       ${where}
//       ORDER BY v.voucher_date DESC, v.id DESC`,
//     args
//   )
//   const totals = rows.reduce(
//     (t, r) => ({
//       count: t.count + 1,
//       total: +(t.total + Number(r.amount)).toFixed(2),
//       cash: +(t.cash + (r.account_type === 'bank' ? 0 : Number(r.amount))).toFixed(2),
//       bank: +(t.bank + (r.account_type === 'bank' ? Number(r.amount) : 0)).toFixed(2)
//     }),
//     { count: 0, total: 0, cash: 0, bank: 0 }
//   )
//   totals.customers = new Set(rows.map((r) => r.customer_id)).size
//   return { rows, totals }
// }

// export function registerReportsHandlers(ipcMain) {
//   ipcMain.handle(
//     'reports:customer-summary',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         const rows = await customerSummary(from, to, search)
//         const totals = rows.reduce(
//           (t, r) => ({
//             bills: t.bills + Number(r.bills),
//             billed: t.billed + Number(r.billed),
//             received: t.received + Number(r.received),
//             change_given: t.change_given + Number(r.change_given),
//             cash_total: t.cash_total + Number(r.cash_total),
//             online_total: t.online_total + Number(r.online_total),
//             credit_total: t.credit_total + Number(r.credit_total),
//             outstanding: t.outstanding + Number(r.outstanding),
//             returns: t.returns + r.returns,
//             net_sales: +(t.net_sales + r.net_sales).toFixed(2)
//           }),
//           {
//             returns: 0,
//             net_sales: 0,
//             bills: 0,
//             billed: 0,
//             received: 0,
//             change_given: 0,
//             cash_total: 0,
//             online_total: 0,
//             credit_total: 0,
//             outstanding: 0
//           }
//         )
//         return { ok: true, data: { rows, totals } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:customer-detail',
//     async (_e, { actingUserId, customerId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         const [[customer]] = await pool.query(
//           `SELECT id, code, name, telephone, current_balance FROM customers WHERE id = ?`,
//           [customerId]
//         )
//         if (!customer) return { ok: false, error: 'Customer not found.' }

//         const sArgs = [customerId]
//         const df = dateFrag(from, to, sArgs)
//         const [sales] = await pool.query(
//           `SELECT s.id, s.invoice_no, s.invoice_date, s.payment_type,
//                 s.net_total, s.amount_received, s.cash_back AS change_given,
//                 (s.net_total - s.amount_received) AS outstanding,
//                 sm.name AS salesman, u.full_name AS operator
//            FROM sales s
//            LEFT JOIN users u ON u.id = s.created_by
//            LEFT JOIN salesmen sm ON sm.id = s.salesman_id
//           WHERE s.customer_id = ? AND s.is_cancelled = 0${df}
//           ORDER BY s.invoice_date DESC, s.id DESC`,
//           sArgs
//         )

//         const rArgs = [customerId]
//         const rdf = dateFrag(from, to, rArgs).replace(
//           /s\.invoice_date/g,
//           'v.voucher_date'
//         )
//         const [repayments] = await pool.query(
//           `SELECT v.id, v.voucher_no, v.amount, v.description, v.voucher_date, a.name AS account_name
//            FROM vouchers v LEFT JOIN accounts a ON a.id = v.account_id
//           WHERE v.party_type='customer' AND v.party_id = ?
//             AND v.voucher_type='receipt' AND v.reference='repayment'${rdf}
//           ORDER BY v.voucher_date DESC, v.id DESC`,
//           rArgs
//         )

//         return { ok: true, data: { customer, sales, repayments } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:export-customer-summary',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         const rows = await customerSummary(from, to, search)
//         const win = BrowserWindow.getFocusedWindow()
//         const result = await dialog.showSaveDialog(win, {
//           title: 'Export Customer Report',
//           defaultPath: `customer-report-${from || 'all'}_${to || 'all'}.xlsx`,
//           filters: [{ name: 'Excel', extensions: ['xlsx'] }]
//         })
//         if (result.canceled || !result.filePath)
//           return { ok: true, data: { canceled: true } }
//         const sheet = rows.map((r) => ({
//           Code: r.code,
//           Customer: r.name,
//           Bills: Number(r.bills),
//           Billed: Number(r.billed),
//           Returns: Number(r.returns),
//           'Net Sales': Number(r.net_sales),
//           Received: Number(r.received),
//           'Change Given': Number(r.change_given),
//           Cash: Number(r.cash_total),
//           Online: Number(r.online_total),
//           Credit: Number(r.credit_total),
//           Outstanding: Number(r.outstanding)
//         }))
//         const ws = XLSX.utils.json_to_sheet(sheet)
//         const wb = XLSX.utils.book_new()
//         XLSX.utils.book_append_sheet(wb, ws, 'Customer Report')
//         XLSX.writeFile(wb, result.filePath)
//         return { ok: true, data: { path: result.filePath, count: rows.length } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:sales-summary',
//     async (_e, { actingUserId, from, to, groupBy } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await salesSummary(from, to, groupBy) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // Every sales invoice in the period (Sales report -> All Invoices)
//   ipcMain.handle(
//     'reports:sales-invoices',
//     async (_e, { actingUserId, from, to, paymentType, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await salesInvoices(from, to, paymentType, search) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Credit Recovery report (repayments only — never part of Sales)
//   ipcMain.handle(
//     'reports:credit-recovery',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await creditRecovery(from, to, search) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:purchase-list',
//     async (_e, { actingUserId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await purchaseList(from, to) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:purchase-payments',
//     async (_e, { actingUserId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await purchasePayments(from, to) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ✅ CHANGED: accept categoryId
//   ipcMain.handle(
//     'reports:stock-valuation',
//     async (_e, { actingUserId, search, categoryId } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await stockValuation(search, categoryId) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:day-book',
//     async (_e, { actingUserId, date } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await dayBook(date) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Customer Ledger — printable single-customer statement
//   ipcMain.handle(
//     'reports:customer-ledger',
//     async (_e, { actingUserId, customerId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         if (!customerId) return { ok: false, error: 'Pick a customer.' }

//         const [[customer]] = await pool.query(
//           `SELECT id, code, name, telephone, opening_balance, current_balance
//              FROM customers WHERE id = ?`,
//           [customerId]
//         )
//         if (!customer) return { ok: false, error: 'Customer not found.' }

//         let openingAtFrom = Number(customer.opening_balance) || 0
//         if (from) {
//           const [[pre]] = await pool.query(
//             `SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS c
//                FROM customer_ledger
//               WHERE customer_id = ? AND entry_date < ?`,
//             [customerId, from]
//           )
//           openingAtFrom = +(
//             Number(customer.opening_balance) +
//             Number(pre.d) -
//             Number(pre.c)
//           ).toFixed(2)
//         }

//         const args = [customerId]
//         let where = ''
//         if (from) {
//           where += ' AND entry_date >= ?'
//           args.push(from)
//         }
//         if (to) {
//           where += ' AND entry_date <= ?'
//           args.push(to)
//         }

//         const [entries] = await pool.query(
//           `SELECT cl.id, cl.entry_type, cl.entry_date, cl.debit, cl.credit, cl.description,
//                   cl.reference_type, cl.reference_id, cl.created_at,
//                   vv.voucher_no, ss.invoice_no, sr.return_no, srs.invoice_no AS return_invoice_no
//              FROM customer_ledger cl
//              LEFT JOIN vouchers vv
//                     ON cl.reference_type = 'voucher' AND vv.id = cl.reference_id
//              LEFT JOIN sales ss
//                     ON cl.reference_type = 'sale' AND ss.id = cl.reference_id
//              LEFT JOIN sales_returns sr
//                     ON cl.reference_type = 'return' AND sr.id = cl.reference_id
//              LEFT JOIN sales srs ON srs.id = sr.sale_id
//             WHERE cl.customer_id = ?${where.replace(/entry_date/g, 'cl.entry_date')}
//             ORDER BY cl.entry_date ASC, cl.id ASC`,
//           args
//         )

//         const labelMap = {
//           credit_sale: 'Credit Sale',
//           repayment: 'Cash Received',
//           return_credit_offset: 'Goods Returned',
//           return_cash_refund: 'Cash Refund Paid',
//           adjustment: 'Adjustment'
//         }

//         const rows = []
//         rows.push({
//           date: null,
//           tran_no: '',
//           ref_no: '',
//           description: 'Opening Balance',
//           // Debit = what the customer owes us (bills); Credit = what came off it (payments,
//           // returns). Before, the two columns were swapped.
//           debit: openingAtFrom > 0 ? openingAtFrom : 0,
//           credit: openingAtFrom < 0 ? Math.abs(openingAtFrom) : 0,
//           sortKey: '0000-00-00T00:00:00.000Z'
//         })

//         for (const l of entries) {
//           const d = Number(l.debit) || 0
//           const c = Number(l.credit) || 0
//           let tranNo = ''
//           if (l.entry_type === 'credit_sale' && l.reference_id)
//             tranNo = l.invoice_no ? 'INV #' + l.invoice_no : ''
//           else if (l.entry_type === 'repayment')
//             // Real voucher number via the reference_id link. (It used to be built from
//             // reference_id itself, which is the voucher's row id — not its RV number.)
//             tranNo =
//               l.voucher_no ||
//               ((l.description || '').match(/RV-\d+/) || [])[0] ||
//               ''
//           else if (l.reference_type === 'return' && l.reference_id)
//             tranNo = l.return_no || '' // real return number (was built from the row id)

//           let refNo = ''
//           if (l.reference_type === 'sale' && l.invoice_no) refNo = '#' + l.invoice_no
//           else if (l.reference_type === 'return' && l.return_invoice_no)
//             refNo = '#' + l.return_invoice_no

//           rows.push({
//             date: l.entry_date,
//             tran_no: tranNo,
//             ref_no: refNo,
//             description:
//               l.description || labelMap[l.entry_type] || l.entry_type,
//             debit: d,
//             credit: c,
//             sortKey: l.created_at
//               ? new Date(l.created_at).toISOString()
//               : l.entry_date + 'T00:00:00.000Z'
//           })
//         }

//         rows.sort((a, b) =>
//           a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0
//         )

//         let running = 0
//         for (const r of rows) {
//           running = +(running + r.debit - r.credit).toFixed(2) // + = customer owes (Dr)
//           r.balance = running
//           r.status = running > 0.009 ? 'Dr' : running < -0.009 ? 'Cr' : ''
//         }

//         const totals = rows.reduce(
//           (t, r) => ({
//             debit: +(t.debit + r.debit).toFixed(2),
//             credit: +(t.credit + r.credit).toFixed(2)
//           }),
//           { debit: 0, credit: 0 }
//         )
//         totals.closing = running

//         // "Total Sales" counts ONLY this customer's invoices in the period (sales table,
//         // all payment types). Recoveries are a separate line — the ledger rows above show
//         // both (sale = +, payment = −) but the two totals are never added together.
//         const sArgs = [customerId]
//         let sw = ''
//         if (from) {
//           sw += ' AND invoice_date >= ?'
//           sArgs.push(from)
//         }
//         if (to) {
//           sw += ' AND invoice_date <= ?'
//           sArgs.push(to)
//         }
//         const [[saleTot]] = await pool.query(
//           `SELECT COUNT(*) AS bills, COALESCE(SUM(net_total),0) AS total
//              FROM sales WHERE customer_id = ? AND is_cancelled = 0${sw}`,
//           sArgs
//         )
//         const [[recTot]] = await pool.query(
//           `SELECT COALESCE(SUM(amount),0) AS total FROM vouchers
//             WHERE voucher_type = 'receipt' AND reference = 'repayment'
//               AND party_type = 'customer' AND party_id = ?${sw.replace(/invoice_date/g, 'voucher_date')}`,
//           sArgs
//         )
//         const [[retTot]] = await pool.query(
//           `SELECT COALESCE(SUM(total_amount),0) AS total FROM sales_returns
//             WHERE customer_id = ?${sw.replace(/invoice_date/g, 'return_date')}`,
//           sArgs
//         )
//         // Total Sales is NET of goods this customer returned in the period.
//         totals.grossSales = Number(saleTot.total)
//         totals.salesReturns = Number(retTot.total)
//         totals.totalSales = +(totals.grossSales - totals.salesReturns).toFixed(2)
//         totals.salesBills = Number(saleTot.bills)
//         totals.totalRecovery = Number(recTot.total)

//         return {
//           ok: true,
//           data: {
//             customer,
//             rows,
//             totals,
//             from: from || null,
//             to: to || null
//           }
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Customers' Balances — list of all customers
//   ipcMain.handle(
//     'reports:customer-balances',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         let where = 'WHERE c.is_active = 1'
//         const args = []
//         if (search && search.trim()) {
//           where += ' AND (c.name LIKE ? OR c.code LIKE ?)'
//           const s = `%${search.trim()}%`
//           args.push(s, s)
//         }

//         const [custs] = await pool.query(
//           `SELECT c.id, c.code, c.name, c.telephone,
//                   c.opening_balance, c.current_balance
//              FROM customers c ${where}
//             ORDER BY CAST(c.code AS UNSIGNED), c.name`,
//           args
//         )

//         const rows = []
//         for (const c of custs) {
//           let openingAtFrom = Number(c.opening_balance) || 0
//           if (from) {
//             const [[pre]] = await pool.query(
//               `SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS cr
//                  FROM customer_ledger
//                 WHERE customer_id = ? AND entry_date < ?`,
//               [c.id, from]
//             )
//             openingAtFrom = +(
//               Number(c.opening_balance) +
//               Number(pre.d) -
//               Number(pre.cr)
//             ).toFixed(2)
//           }

//           const pArgs = [c.id]
//           let pw = ''
//           if (from) {
//             pw += ' AND entry_date >= ?'
//             pArgs.push(from)
//           }
//           if (to) {
//             pw += ' AND entry_date <= ?'
//             pArgs.push(to)
//           }
//           const [[per]] = await pool.query(
//             `SELECT COALESCE(SUM(debit),0) AS d,
//                     COALESCE(SUM(credit),0) AS cr
//                FROM customer_ledger WHERE customer_id = ?${pw}`,
//             pArgs
//           )
//           // Debit = bills (customer owes more), Credit = payments/returns (was swapped).
//           const periodDebit = +Number(per.d).toFixed(2)
//           const periodCredit = +Number(per.cr).toFixed(2)
//           const closing = +(openingAtFrom + periodDebit - periodCredit).toFixed(
//             2
//           )

//           if (
//             !search &&
//             Math.abs(openingAtFrom) < 0.01 &&
//             Math.abs(periodCredit) < 0.01 &&
//             Math.abs(periodDebit) < 0.01
//           )
//             continue

//           rows.push({
//             id: c.id,
//             code: c.code,
//             name: c.name,
//             telephone: c.telephone,
//             opening: openingAtFrom,
//             debit: periodDebit,
//             credit: periodCredit,
//             closing,
//             status: closing > 0.009 ? 'Dr' : closing < -0.009 ? 'Cr' : ''
//           })
//         }

//         const totals = rows.reduce(
//           (t, r) => ({
//             opening: +(t.opening + r.opening).toFixed(2),
//             debit: +(t.debit + r.debit).toFixed(2),
//             credit: +(t.credit + r.credit).toFixed(2),
//             closing: +(t.closing + r.closing).toFixed(2)
//           }),
//           { opening: 0, debit: 0, credit: 0, closing: 0 }
//         )

//         return {
//           ok: true,
//           data: { rows, totals, from: from || null, to: to || null }
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ✅ Phase A3 — 📌 PINNED HERE (dayBook ke baad, export se pehle)
//   // ✅ CHANGED: now accepts and passes `search`
//   ipcMain.handle(
//     'reports:salesman-performance',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return {
//           ok: true,
//           data: await salesmanPerformance(from, to, search)
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ✅ CHANGED: accept categoryId and pass it through to stockValuation
//   ipcMain.handle(
//     'reports:export',
//     async (
//       _e,
//       { actingUserId, reportType, from, to, search, date, categoryId, groupBy, paymentType } = {}
//     ) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         let sheet = [],
//           name = 'Report',
//           file = 'report'
//         if (reportType === 'sales') {
//           const { rows } = await salesSummary(from, to, groupBy)
//           sheet = rows.map((r) => ({
//             [groupBy === 'month' ? 'Month' : groupBy === 'year' ? 'Year' : 'Date']:
//               r.invoice_date,
//             Bills: Number(r.bills),
//             Sales: Number(r.sales),
//             Discount: Number(r.discount),
//             Received: Number(r.received),
//             Cash: Number(r.cash),
//             Online: Number(r.online),
//             Credit: Number(r.credit),
//             Returns: Number(r.returns),
//             'Net Sales': Number(r.net_sales),
//             'Cash Bills': Number(r.cash_bills || 0),
//             'Online Bills': Number(r.online_bills || 0),
//             'Credit Bills': Number(r.credit_bills || 0)
//           }))
//           name = 'Sales'
//           file = `sales-report-${groupBy || 'day'}-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'salesInvoices') {
//           const { rows } = await salesInvoices(from, to, paymentType, search)
//           sheet = rows.map((r) => ({
//             Invoice: r.invoice_no,
//             Date: r.invoice_date,
//             Time: r.invoice_time || '',
//             Customer: r.customer,
//             Code: r.customer_code,
//             Salesman: r.salesman || '',
//             Type: r.payment_type,
//             Amount: Number(r.net_total),
//             Received: Number(r.amount_received),
//             'Due at sale': Number(r.outstanding),
//             Returned: Number(r.returned)
//           }))
//           name = 'Sales Invoices'
//           file = `sales-invoices-${paymentType || 'all'}-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'creditRecovery') {
//           const { rows } = await creditRecovery(from, to, search)
//           sheet = rows.map((r) => ({
//             Voucher: r.voucher_no,
//             Date: r.voucher_date,
//             Time: r.voucher_time || '',
//             Code: r.customer_code,
//             Customer: r.customer,
//             Account: r.account_name || '',
//             Method: r.payment_method,
//             Note: r.description || '',
//             Amount: Number(r.amount),
//             'Balance Now': Number(r.balance_now)
//           }))
//           name = 'Credit Recovery'
//           file = `credit-recovery-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'purchases') {
//           const { rows } = await purchaseList(from, to)
//           sheet = rows.map((r) => ({
//             Serial: r.serial_no,
//             Date: r.order_date,
//             Vendor: r.vendor || '',
//             Status: r.status,
//             SubTotal: Number(r.sub_total),
//             GST: Number(r.gst_amount),
//             Total: Number(r.total_incl_tax),
//             Returned: Number(r.returned),
//             Net: Number(r.net)
//           }))
//           name = 'Purchases'
//           file = `purchase-report-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'purchasePayments') {
//           const { rows } = await purchasePayments(from, to)
//           sheet = rows.map((r) => ({
//             Voucher: r.voucher_no,
//             Date: r.voucher_date,
//             PO: r.serial_no || '',
//             Vendor: r.vendor || '',
//             Method: r.payment_method,
//             Account: r.account_name || '',
//             Amount: Number(r.amount)
//           }))
//           name = 'Purchase Payments'
//           file = `purchase-payments-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'stock') {
//           // ✅ pass categoryId; ✅ Size column added
//           const { rows } = await stockValuation(search, categoryId)
//           sheet = rows.map((r) => ({
//             Code: r.item_code,
//             Item: r.name,
//             Size: r.size || '',
//             Category: r.category || '',
//             SubCategory: r.sub_category || '',
//             Stock: Number(r.current_stock),
//             PurchasePrice: Number(r.purchase_price),
//             SellingPrice: Number(r.selling_price),
//             AvgCost: Number(r.average_cost),
//             Value: Number(r.value)
//           }))
//           name = 'Stock'
//           file = 'stock-valuation'
//         } else if (reportType === 'salesman') {
//           // ✅ pass search through
//           const { rows } = await salesmanPerformance(from, to, search)
//           sheet = rows.map((r) => ({
//             Salesman: r.name,
//             Phone: r.phone || '',
//             Bills: Number(r.bills),
//             Sales: Number(r.sales),
//             Returns: Number(r.returns),
//             'Net Sales': Number(r.net_sales),
//             Discount: Number(r.discount),
//             Received: Number(r.received),
//             Cash: Number(r.cash),
//             Online: Number(r.online),
//             Credit: Number(r.credit)
//           }))
//           name = 'Salesman Performance'
//           file = `salesman-perf-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'daybook') {
//           const d = await dayBook(date)
//           sheet = d.vouchers.map((v) => ({
//             Voucher: v.voucher_no,
//             Kind: v.kind, // SALE / RECOVERY / EXPENSE … — never mixed
//             Type: v.voucher_type,
//             Party: v.party || '',
//             Method: v.payment_method,
//             Account: v.account_name || '',
//             Reference: v.reference || '',
//             Description: v.description || '',
//             Amount: Number(v.amount)
//           }))
//           name = 'Day Book'
//           file = `day-book-${d.date}`
//         } else return { ok: false, error: 'Unknown report type.' }

//         const win = BrowserWindow.getFocusedWindow()
//         const result = await dialog.showSaveDialog(win, {
//           title: `Export ${name} Report`,
//           defaultPath: `${file}.xlsx`,
//           filters: [{ name: 'Excel', extensions: ['xlsx'] }]
//         })
//         if (result.canceled || !result.filePath)
//           return { ok: true, data: { canceled: true } }
//         const ws = XLSX.utils.json_to_sheet(
//           sheet.length ? sheet : [{ Note: 'No data in range' }]
//         )
//         const wb = XLSX.utils.book_new()
//         XLSX.utils.book_append_sheet(wb, ws, name)
//         XLSX.writeFile(wb, result.filePath)
//         return {
//           ok: true,
//           data: { path: result.filePath, count: sheet.length }
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )
// }

// import { dialog, BrowserWindow } from 'electron'
// import * as XLSX from 'xlsx'
// import pool from '../db/pool.js'
// import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'
// import {
//   VOUCHER_KIND_SQL,
//   VENDOR_PAYMENT_SQL,
//   salesReturnsInRange
// } from '../services/reconciliation.service.js'

// import { localToday } from '../services/date.util.js'
// // Build the sales-date filter fragment shared by summary + export.
// function dateFrag(from, to, args) {
//   let frag = ''
//   if (from) {
//     frag += ' AND s.invoice_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     frag += ' AND s.invoice_date <= ?'
//     args.push(to)
//   }
//   return frag
// }

// // Returns made in [from, to] (client's rule: cut from the day the goods came back, return_date)
// // grouped by a column of the ORIGINAL sale ('customer_id' | 'salesman_id'). Used to show
// // Returns / Net Sales beside gross sales.
// async function returnsBy(saleCol, from, to) {
//   const args = []
//   let w = ''
//   if (from) {
//     w += ' AND r.return_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     w += ' AND r.return_date <= ?'
//     args.push(to)
//   }
//   const [rows] = await pool.query(
//     `SELECT s.${saleCol} AS k, COALESCE(SUM(r.total_amount),0) AS total
//        FROM sales_returns r JOIN sales s ON s.id = r.sale_id
//       WHERE 1=1${w}
//       GROUP BY s.${saleCol}`,
//     args
//   )
//   return new Map(rows.map((r) => [r.k ?? null, Number(r.total)]))
// }

// async function customerSummary(from, to, search) {
//   const args = []
//   const df = dateFrag(from, to, args)
//   let searchWhere = ''
//   if (search && search.trim()) {
//     searchWhere = ' WHERE (c.name LIKE ? OR c.code LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s)
//   }
//   const [rows] = await pool.query(
//     `SELECT c.id, c.code, c.name, c.current_balance AS outstanding,
//             COUNT(s.id) AS bills,
//             COALESCE(SUM(s.net_total),0)        AS billed,
//             COALESCE(SUM(s.amount_received),0)  AS received,
//             COALESCE(SUM(s.cash_back),0)        AS change_given,
//             COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash_total,
//             COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online_total,
//             COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit_total
//        FROM customers c
//        LEFT JOIN sales s ON s.customer_id = c.id AND s.is_cancelled = 0${df}
//        ${searchWhere}
//       GROUP BY c.id, c.code, c.name, c.current_balance
//      HAVING bills > 0 OR outstanding > 0
//       ORDER BY billed DESC, outstanding DESC`,
//     args
//   )
//   // `billed` stays gross (it pairs with received / cash / online / credit);
//   // `returns` and `net_sales` show what the customer actually kept.
//   const ret = await returnsBy('customer_id', from, to)
//   for (const r of rows) {
//     r.returns = ret.get(r.id) || 0
//     r.net_sales = +(Number(r.billed) - r.returns).toFixed(2)
//   }
//   return rows
// }

// // Sales report — `sales` table ONLY (credit recoveries are in the Credit Recovery report).
// // groupBy: 'day' (default) | 'month' | 'year'. The period is returned in `invoice_date`
// // (existing field the page/export already read) and `period`.
// const SALES_PERIOD = {
//   day: 's.invoice_date',
//   month: "DATE_FORMAT(s.invoice_date, '%Y-%m')",
//   year: 'CAST(YEAR(s.invoice_date) AS CHAR)'
// }
// async function salesSummary(from, to, groupBy = 'day') {
//   const args = []
//   dateFrag(from, to, args)
//   const periodExpr = SALES_PERIOD[groupBy] || SALES_PERIOD.day
//   const [rows] = await pool.query(
//     `SELECT ${periodExpr} AS invoice_date, ${periodExpr} AS period, COUNT(*) AS bills,
//             COALESCE(SUM(s.net_total),0)       AS sales,
//             COALESCE(SUM(s.discount),0)        AS discount,
//             COALESCE(SUM(s.amount_received),0) AS received,
//             COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit,
//             -- how MANY bills of each type (owner wants counts, not just amounts)
//             COALESCE(SUM(s.payment_type='cash'),0)   AS cash_bills,
//             COALESCE(SUM(s.payment_type='online'),0) AS online_bills,
//             COALESCE(SUM(s.payment_type='credit'),0) AS credit_bills
//        FROM sales s
//       WHERE s.is_cancelled = 0 ${from ? 'AND s.invoice_date >= ?' : ''} ${to ? 'AND s.invoice_date <= ?' : ''}
//       GROUP BY ${periodExpr}
//       ORDER BY ${periodExpr} DESC`,
//     args
//   )

//   // Returns reduce Sales in the period they happen (return_date). `sales` and the
//   // cash/online/credit split stay gross; `returns` and `net_sales` are added per period.
//   // Client's rule: a return reduces the Sales of the period it came back in (return_date).
//   const retPeriod = periodExpr.replace(/s\.invoice_date/g, 'r.return_date')
//   const rArgs = []
//   let rWhere = ''
//   if (from) {
//     rWhere += ' AND r.return_date >= ?'
//     rArgs.push(from)
//   }
//   if (to) {
//     rWhere += ' AND r.return_date <= ?'
//     rArgs.push(to)
//   }
//   const [retRows] = await pool.query(
//     `SELECT ${retPeriod} AS period, COALESCE(SUM(r.total_amount),0) AS returns
//        FROM sales_returns r JOIN sales s ON s.id = r.sale_id WHERE 1=1${rWhere}
//       GROUP BY ${retPeriod}`,
//     rArgs
//   )
//   const byPeriod = new Map(rows.map((r) => [String(r.period), r]))
//   for (const rr of retRows) {
//     // A period with returns but no new bills still needs a row.
//     if (!byPeriod.has(String(rr.period))) {
//       const blank = {
//         invoice_date: rr.period,
//         period: rr.period,
//         bills: 0,
//         sales: 0,
//         discount: 0,
//         received: 0,
//         cash: 0,
//         online: 0,
//         credit: 0,
//         cash_bills: 0,
//         online_bills: 0,
//         credit_bills: 0
//       }
//       byPeriod.set(String(rr.period), blank)
//       rows.push(blank)
//     }
//     byPeriod.get(String(rr.period)).returns = Number(rr.returns)
//   }
//   for (const r of rows) {
//     r.returns = Number(r.returns || 0)
//     r.net_sales = +(Number(r.sales) - r.returns).toFixed(2)
//   }
//   rows.sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1))

//   const totals = rows.reduce(
//     (t, r) => ({
//       bills: t.bills + Number(r.bills),
//       sales: t.sales + Number(r.sales),
//       discount: t.discount + Number(r.discount),
//       received: t.received + Number(r.received),
//       cash: t.cash + Number(r.cash),
//       online: t.online + Number(r.online),
//       credit: t.credit + Number(r.credit),
//       returns: t.returns + r.returns,
//       net_sales: +(t.net_sales + r.net_sales).toFixed(2),
//       cash_bills: t.cash_bills + Number(r.cash_bills || 0),
//       online_bills: t.online_bills + Number(r.online_bills || 0),
//       credit_bills: t.credit_bills + Number(r.credit_bills || 0)
//     }),
//     {
//       bills: 0,
//       sales: 0,
//       discount: 0,
//       received: 0,
//       cash: 0,
//       online: 0,
//       credit: 0,
//       returns: 0,
//       net_sales: 0,
//       cash_bills: 0,
//       online_bills: 0,
//       credit_bills: 0
//     }
//   )
//   return { rows, totals }
// }

// // Sales-invoice search (F2). Runs in SQL so the on-screen list and the Excel export match.
// //   >1000  >=1000  <500  <=500  =1300   → invoice amount (net_total) comparisons
// //   1000-2000                           → amount range (inclusive)
// //   1001  (digits only)                 → invoice # 1001, OR customer code 1001 / ending in
// //                                          1001 (codes are long, e.g. 12001001), OR name
// //   anything else                       → invoice # / customer name / customer code contains
// export function invoiceSearchSql(search) {
//   const q = String(search || '').trim()
//   if (!q) return null
//   let m = q.match(/^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/)
//   if (m) return { sql: `s.net_total ${m[1]} ?`, args: [Number(m[2])] }
//   m = q.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
//   if (m) {
//     const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y)
//     return { sql: 's.net_total BETWEEN ? AND ?', args: [a, b] }
//   }
//   if (/^\d+$/.test(q))
//     return {
//       sql: '(s.invoice_no = ? OR c.code = ? OR c.code LIKE ? OR c.name LIKE ?)',
//       args: [q, q, `%${q}`, `%${q}%`]
//     }
//   const like = `%${q}%`
//   return {
//     sql: '(s.invoice_no LIKE ? OR c.name LIKE ? OR c.code LIKE ?)',
//     args: [like, like, like]
//   }
// }

// // Every individual sales invoice in the period (Sales report -> "All Invoices").
// // Lets the owner see each bill and count how many were cash / online / credit.
// // Sales table only (not cancelled); returns on each bill are shown alongside.
// async function salesInvoices(from, to, paymentType, search) {
//   const args = []
//   let where = 'WHERE s.is_cancelled = 0'
//   if (from) {
//     where += ' AND s.invoice_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     where += ' AND s.invoice_date <= ?'
//     args.push(to)
//   }
//   if (['cash', 'online', 'credit'].includes(paymentType)) {
//     where += ' AND s.payment_type = ?'
//     args.push(paymentType)
//   }
//   const sq = invoiceSearchSql(search)
//   if (sq) {
//     where += ` AND ${sq.sql}`
//     args.push(...sq.args)
//   }
//   const [rows] = await pool.query(
//     `SELECT s.id, s.invoice_no, s.invoice_date, s.invoice_time, s.payment_type,
//             s.net_total, s.discount, s.amount_received,
//             (s.net_total - s.amount_received) AS outstanding,
//             c.name AS customer, c.code AS customer_code,
//             sm.name AS salesman, u.full_name AS operator,
//             (SELECT COALESCE(SUM(r.total_amount),0) FROM sales_returns r WHERE r.sale_id = s.id) AS returned
//        FROM sales s
//        JOIN customers c ON c.id = s.customer_id
//        LEFT JOIN users u ON u.id = s.created_by
//        LEFT JOIN salesmen sm ON sm.id = s.salesman_id
//       ${where}
//       ORDER BY s.invoice_date DESC, s.invoice_time DESC, s.id DESC`,
//     args
//   )
//   const blank = () => ({ count: 0, amount: 0 })
//   const totals = {
//     count: 0,
//     amount: 0,
//     cash: blank(),
//     online: blank(),
//     credit: blank(),
//     returned: 0
//   }
//   for (const r of rows) {
//     totals.count += 1
//     totals.amount = +(totals.amount + Number(r.net_total)).toFixed(2)
//     const b = totals[r.payment_type]
//     if (b) {
//       b.count += 1
//       b.amount = +(b.amount + Number(r.net_total)).toFixed(2)
//     }
//     totals.returned = +(totals.returned + Number(r.returned)).toFixed(2)
//   }
//   return { rows, totals }
// }

// async function purchaseList(from, to) {
//   const args = []
//   const [rows] = await pool.query(
//     `SELECT p.id, p.serial_no, p.order_date, p.status, v.name AS vendor,
//             p.sub_total, p.gst_amount, p.total_incl_tax,
//             -- goods sent back to the vendor against this bill (was not shown at all)
//             (SELECT COALESCE(SUM(pr.total_amount),0) FROM purchase_returns pr
//               WHERE pr.purchase_order_id = p.id) AS returned
//        FROM purchase_orders p
//        LEFT JOIN vendors v ON v.id = p.vendor_id
//       WHERE 1=1 ${from ? 'AND p.order_date >= ?' : ''} ${to ? 'AND p.order_date <= ?' : ''}
//       ORDER BY p.order_date DESC, p.id DESC`,
//     [...(from ? [from] : []), ...(to ? [to] : [])]
//   )
//   for (const r of rows) {
//     r.returned = Number(r.returned) || 0
//     r.net = +(Number(r.total_incl_tax) - r.returned).toFixed(2)
//   }
//   const totals = rows.reduce(
//     (t, r) => {
//       const recv = r.status === 'received'
//       return {
//         orders: t.orders + 1,
//         received: t.received + (recv ? 1 : 0),
//         sub: t.sub + (recv ? Number(r.sub_total) : 0),
//         gst: t.gst + (recv ? Number(r.gst_amount) : 0),
//         total: t.total + (recv ? Number(r.total_incl_tax) : 0),
//         returned: t.returned + (recv ? r.returned : 0)
//       }
//     },
//     { orders: 0, received: 0, sub: 0, gst: 0, total: 0, returned: 0 }
//   )
//   totals.returned = +totals.returned.toFixed(2)
//   totals.net = +(totals.total - totals.returned).toFixed(2)
//   return { rows, totals }
// }

// // Per-product purchase report. Gross vs net (returns to vendor in the same range).
// async function purchasesByProduct(from, to, search) {
//   const args = []
//   let w = "WHERE po.status = 'received' AND poi.item_id IS NOT NULL"
//   if (from) {
//     w += ' AND po.order_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     w += ' AND po.order_date <= ?'
//     args.push(to)
//   }
//   if (search && search.trim()) {
//     w += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s)
//   }

//   const [rows] = await pool.query(
//     `SELECT i.id AS item_id, i.item_code, i.name, i.size, i.unit,
//             COUNT(DISTINCT po.id)   AS bill_count,
//             SUM(poi.quantity)       AS qty_purchased,
//             SUM(poi.amount)         AS gross_amount,
//             AVG(poi.rate)           AS avg_rate,
//             MIN(po.order_date)      AS first_purchase,
//             MAX(po.order_date)      AS last_purchase
//        FROM purchase_order_items poi
//        JOIN purchase_orders po ON po.id = poi.purchase_order_id
//        JOIN items i ON i.id = poi.item_id
//        ${w}
//        GROUP BY i.id, i.item_code, i.name, i.size, i.unit
//        ORDER BY gross_amount DESC`,
//     args
//   )

//   const rArgs = []
//   let rw = ''
//   if (from) {
//     rw += ' AND pr.return_date >= ?'
//     rArgs.push(from)
//   }
//   if (to) {
//     rw += ' AND pr.return_date <= ?'
//     rArgs.push(to)
//   }
//   const [retRows] = await pool.query(
//     `SELECT pri.item_id, SUM(pri.quantity) AS qty_returned, SUM(pri.amount) AS amount_returned
//        FROM purchase_return_items pri
//        JOIN purchase_returns pr ON pr.id = pri.return_id
//       WHERE 1=1 ${rw}
//       GROUP BY pri.item_id`,
//     rArgs
//   )
//   const retMap = new Map(retRows.map((r) => [r.item_id, r]))

//   let totQty = 0,
//     totAmt = 0,
//     totRetQty = 0,
//     totRetAmt = 0
//   const out = rows.map((r) => {
//     const ret = retMap.get(r.item_id)
//     const qtyReturned = Number(ret?.qty_returned || 0)
//     const amountReturned = Number(ret?.amount_returned || 0)
//     totQty += Number(r.qty_purchased)
//     totAmt += Number(r.gross_amount)
//     totRetQty += qtyReturned
//     totRetAmt += amountReturned
//     return {
//       item_id: r.item_id,
//       item_code: r.item_code,
//       name: r.name,
//       size: r.size,
//       unit: r.unit,
//       bill_count: Number(r.bill_count),
//       qty_purchased: Number(r.qty_purchased),
//       qty_returned: qtyReturned,
//       qty_net: Number(r.qty_purchased) - qtyReturned,
//       gross_amount: +Number(r.gross_amount).toFixed(2),
//       amount_returned: +amountReturned.toFixed(2),
//       net_amount: +(Number(r.gross_amount) - amountReturned).toFixed(2),
//       avg_rate: +Number(r.avg_rate || 0).toFixed(2),
//       first_purchase: r.first_purchase,
//       last_purchase: r.last_purchase
//     }
//   })

//   return {
//     rows: out,
//     totals: {
//       items: out.length,
//       bills: out.reduce((s, r) => s + r.bill_count, 0),
//       qty_purchased: totQty,
//       qty_returned: totRetQty,
//       qty_net: totQty - totRetQty,
//       gross_amount: +totAmt.toFixed(2),
//       amount_returned: +totRetAmt.toFixed(2),
//       net_amount: +(totAmt - totRetAmt).toFixed(2)
//     }
//   }
// }

// // One product's purchase bills + returns-to-vendor for the period (drill-down).
// async function purchasesByProductDetail(itemId, from, to) {
//   const [[item]] = await pool.query(
//     `SELECT id, item_code, name, size, unit,
//             purchase_price, selling_price, average_cost, current_stock
//        FROM items WHERE id = ?`,
//     [itemId]
//   )
//   if (!item) throw new Error('Item not found.')

//   const args = [itemId]
//   let w = ''
//   if (from) {
//     w += ' AND po.order_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     w += ' AND po.order_date <= ?'
//     args.push(to)
//   }
//   const [bills] = await pool.query(
//     `SELECT po.id AS bill_id, po.serial_no, po.order_date, po.vendor_bill_no,
//             v.name AS vendor,
//             poi.quantity, poi.unit, poi.rate, poi.amount,
//             poi.gst_rate, poi.gst_amount, poi.value_incl_tax
//        FROM purchase_order_items poi
//        JOIN purchase_orders po ON po.id = poi.purchase_order_id
//        LEFT JOIN vendors v ON v.id = po.vendor_id
//       WHERE poi.item_id = ? AND po.status = 'received' ${w}
//       ORDER BY po.order_date DESC, po.id DESC`,
//     args
//   )

//   const rArgs = [itemId]
//   let rw = ''
//   if (from) {
//     rw += ' AND pr.return_date >= ?'
//     rArgs.push(from)
//   }
//   if (to) {
//     rw += ' AND pr.return_date <= ?'
//     rArgs.push(to)
//   }
//   const [returns] = await pool.query(
//     `SELECT pr.id AS return_id, pr.return_no, pr.return_date, pr.settlement,
//             po.serial_no AS original_bill_no, v.name AS vendor,
//             pri.quantity, pri.rate, pri.amount
//        FROM purchase_return_items pri
//        JOIN purchase_returns pr ON pr.id = pri.return_id
//        LEFT JOIN purchase_orders po ON po.id = pr.purchase_order_id
//        LEFT JOIN vendors v ON v.id = pr.vendor_id
//       WHERE pri.item_id = ? ${rw}
//       ORDER BY pr.return_date DESC, pr.id DESC`,
//     rArgs
//   )

//   return { item, bills, returns }
// }

// async function purchasePayments(from, to) {
//   const args = []
//   let df = ''
//   if (from) {
//     df += ' AND v.voucher_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     df += ' AND v.voucher_date <= ?'
//     args.push(to)
//   }
//   const [rows] = await pool.query(
//     `SELECT v.voucher_no, v.voucher_date, v.amount, v.payment_method, v.reference,
//             a.name AS account_name, ve.name AS vendor, po.serial_no
//        FROM vouchers v
//        LEFT JOIN accounts a ON a.id = v.account_id
//        LEFT JOIN purchase_orders po ON po.id = v.purchase_order_id
//        LEFT JOIN vendors ve ON ve.id = v.party_id AND v.party_type = 'vendor'
//       WHERE ${VENDOR_PAYMENT_SQL} ${df}
//       ORDER BY v.voucher_date DESC, v.id DESC`,
//     args
//   )
//   const totals = rows.reduce(
//     (t, r) => ({
//       total: t.total + Number(r.amount),
//       cash: t.cash + (r.payment_method === 'cash' ? Number(r.amount) : 0),
//       bank: t.bank + (r.payment_method === 'bank' ? Number(r.amount) : 0)
//     }),
//     { total: 0, cash: 0, bank: 0 }
//   )
//   return { rows, totals }
// }

// // ✅ Phase A3 — salesman performance (with optional name search)
// async function salesmanPerformance(from, to, search) {
//   const dateArgs = []
//   let df = ''
//   if (from) {
//     df += ' AND s.invoice_date >= ?'
//     dateArgs.push(from)
//   }
//   if (to) {
//     df += ' AND s.invoice_date <= ?'
//     dateArgs.push(to)
//   }

//   const args = [...dateArgs]
//   let searchWhere = ''
//   if (search && search.trim()) {
//     searchWhere = ' WHERE sm.name LIKE ?'
//     args.push(`%${search.trim()}%`)
//   }

//   const [rows] = await pool.query(
//     `SELECT sm.id, sm.name, sm.phone,
//             COUNT(s.id) AS bills,
//             COALESCE(SUM(s.net_total),0)       AS sales,
//             COALESCE(SUM(s.discount),0)        AS discount,
//             COALESCE(SUM(s.amount_received),0) AS received,
//             COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit
//        FROM salesmen sm
//        LEFT JOIN sales s
//               ON s.salesman_id = sm.id
//              AND s.is_cancelled = 0${df}
//        ${searchWhere}
//       GROUP BY sm.id, sm.name, sm.phone
//       ORDER BY sales DESC, sm.name`,
//     args
//   )

//   // Unassigned row — only when NOT searching (skip when filtering by name)
//   if (!search || !search.trim()) {
//     const [un] = await pool.query(
//       `SELECT COUNT(*) AS bills,
//               COALESCE(SUM(s.net_total),0)       AS sales,
//               COALESCE(SUM(s.discount),0)        AS discount,
//               COALESCE(SUM(s.amount_received),0) AS received,
//               COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
//               COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
//               COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit
//          FROM sales s
//         WHERE s.is_cancelled = 0
//           AND s.salesman_id IS NULL${df}`,
//       dateArgs
//     )
//     if (un[0] && Number(un[0].bills) > 0) {
//       rows.push({ id: null, name: '(Unassigned)', phone: null, ...un[0] })
//     }
//   }

//   // Returns of each salesman's bills (by return date) → Net Sales. `sales` stays gross.
//   const ret = await returnsBy('salesman_id', from, to)
//   for (const r of rows) {
//     r.returns = ret.get(r.id ?? null) || 0
//     r.net_sales = +(Number(r.sales) - r.returns).toFixed(2)
//   }

//   const totals = rows.reduce(
//     (t, r) => ({
//       bills: t.bills + Number(r.bills),
//       sales: t.sales + Number(r.sales),
//       discount: t.discount + Number(r.discount),
//       received: t.received + Number(r.received),
//       cash: t.cash + Number(r.cash),
//       online: t.online + Number(r.online),
//       credit: t.credit + Number(r.credit),
//       returns: t.returns + r.returns,
//       net_sales: +(t.net_sales + r.net_sales).toFixed(2)
//     }),
//     {
//       bills: 0,
//       sales: 0,
//       discount: 0,
//       received: 0,
//       cash: 0,
//       online: 0,
//       credit: 0,
//       returns: 0,
//       net_sales: 0
//     }
//   )
//   return { rows, totals }
// }

// // ✅ CHANGED: now accepts categoryId
// async function stockValuation(search, categoryId) {
//   const args = []
//   let sw = ''
//   if (search && search.trim()) {
//     sw += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s)
//   }
//   if (categoryId) {
//     sw += ' AND COALESCE(sc.category_id, i.category_id) = ?'
//     args.push(categoryId)
//   }
//   const [rows] = await pool.query(
//     `SELECT i.item_code, i.name, i.unit, i.size, i.current_stock, i.purchase_price,
//             i.selling_price, i.average_cost, i.reorder_quantity, i.low_stock_threshold,
//             (i.current_stock * i.average_cost) AS value,
//             c.name AS category,
//             sc.name AS sub_category,
//             CASE WHEN i.low_stock_threshold > 0 THEN i.low_stock_threshold ELSE i.reorder_quantity END AS threshold
//        FROM items i
//        LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
//        LEFT JOIN categories c ON c.id = COALESCE(sc.category_id, i.category_id)
//       WHERE i.is_active = 1 ${sw}
//       ORDER BY value DESC`,
//     args
//   )
//   const totals = rows.reduce(
//     (t, r) => {
//       const th = Number(r.threshold)
//       const low = th > 0 && Number(r.current_stock) <= th
//       return {
//         items: t.items + 1,
//         qty: t.qty + Number(r.current_stock),
//         value: t.value + Number(r.value),
//         low: t.low + (low ? 1 : 0)
//       }
//     },
//     { items: 0, qty: 0, value: 0, low: 0 }
//   )
//   return { rows, totals }
// }

// // Product-wise Profit & Loss — revenue (net of line discounts) minus cost of goods sold,
// // net of returns in the same period. Cost basis is the weighted-average cost captured
// // on the sale movement in stock_ledger; items.average_cost is only a fallback for
// // legacy rows that predate the ledger.
// async function profitLossSummary(from, to, search) {
//   const args = []
//   let w = ''
//   if (from) {
//     w += ' AND s.invoice_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     w += ' AND s.invoice_date <= ?'
//     args.push(to)
//   }
//   if (search && search.trim()) {
//     w += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s)
//   }

//   const [rows] = await pool.query(
//     `SELECT
//        i.id, i.item_code, i.name, i.unit, i.size,
//        COALESCE(sc.name, '') AS sub_category,
//        COALESCE(c.name, '')  AS category,
//        SUM(si.quantity)                    AS qty_sold,
//        SUM(si.net_amount)                  AS revenue,
//        SUM(si.quantity * COALESCE(
//          (SELECT sl.balance_avg_cost FROM stock_ledger sl
//            WHERE sl.reference_type = 'sale'
//              AND sl.reference_id   = si.sale_id
//              AND sl.item_id        = si.item_id
//            LIMIT 1),
//          i.average_cost
//        ))                                  AS cost
//      FROM sale_items si
//      JOIN sales s ON s.id = si.sale_id AND s.is_cancelled = 0
//      JOIN items i ON i.id = si.item_id
//      LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
//      LEFT JOIN categories c       ON c.id = COALESCE(sc.category_id, i.category_id)
//      WHERE 1=1 ${w}
//      GROUP BY i.id, i.item_code, i.name, i.unit, i.size, sc.name, c.name
//      HAVING qty_sold > 0`,
//     args
//   )

//   // Returns in the period. Restocked goods recover their cost, so subtract both
//   // revenue and cost for the returned quantity. Traced back to the ORIGINAL sale line
//   // via sales_return_items.sale_item_id so we use the same historical cost.
//   const rArgs = []
//   let rw = ''
//   if (from) {
//     rw += ' AND sr.return_date >= ?'
//     rArgs.push(from)
//   }
//   if (to) {
//     rw += ' AND sr.return_date <= ?'
//     rArgs.push(to)
//   }
//   const [retRows] = await pool.query(
//     `SELECT
//        sri.item_id,
//        SUM(sri.quantity) AS ret_qty,
//        SUM(sri.amount)   AS ret_amount,
//        SUM(sri.quantity * COALESCE(
//          (SELECT sl.balance_avg_cost FROM stock_ledger sl
//            WHERE sl.reference_type = 'sale'
//              AND sl.reference_id   = si.sale_id
//              AND sl.item_id        = si.item_id
//            LIMIT 1),
//          i.average_cost
//        )) AS ret_cost
//      FROM sales_return_items sri
//      JOIN sales_returns sr ON sr.id = sri.return_id
//      JOIN sale_items si    ON si.id = sri.sale_item_id
//      JOIN items i          ON i.id  = sri.item_id
//      WHERE 1=1 ${rw}
//      GROUP BY sri.item_id`,
//     rArgs
//   )
//   const retMap = new Map(retRows.map((r) => [r.item_id, r]))

//   let totQty = 0,
//     totRev = 0,
//     totCost = 0
//   const out = rows.map((r) => {
//     const ret = retMap.get(r.id)
//     const retQty = Number(ret?.ret_qty || 0)
//     const retAmt = Number(ret?.ret_amount || 0)
//     const retCost = Number(ret?.ret_cost || 0)

//     const qty = Number(r.qty_sold) - retQty
//     const revenue = +(Number(r.revenue) - retAmt).toFixed(2)
//     const cost = +(Number(r.cost) - retCost).toFixed(2)
//     const profit = +(revenue - cost).toFixed(2)
//     const margin = revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0

//     totQty += qty
//     totRev += revenue
//     totCost += cost
//     return {
//       id: r.id,
//       item_code: r.item_code,
//       name: r.name,
//       unit: r.unit,
//       size: r.size,
//       category: r.category,
//       sub_category: r.sub_category,
//       qty_sold: qty,
//       qty_returned: retQty,
//       revenue,
//       cost,
//       profit,
//       margin
//     }
//   })
//   out.sort((a, b) => b.profit - a.profit)

//   return {
//     rows: out,
//     totals: {
//       items: out.length,
//       qty: +totQty.toFixed(2),
//       revenue: +totRev.toFixed(2),
//       cost: +totCost.toFixed(2),
//       profit: +(totRev - totCost).toFixed(2),
//       margin: totRev > 0 ? +(((totRev - totCost) / totRev) * 100).toFixed(1) : 0
//     }
//   }
// }

// // One product's individual sales and returns in the period (the drill-down).
// async function profitLossDetail(itemId, from, to) {
//   const [[item]] = await pool.query(
//     `SELECT id, item_code, name, unit, size, purchase_price, selling_price,
//             average_cost, current_stock
//        FROM items WHERE id = ?`,
//     [itemId]
//   )
//   if (!item) throw new Error('Item not found.')

//   const sArgs = [itemId]
//   let sw = ''
//   if (from) {
//     sw += ' AND s.invoice_date >= ?'
//     sArgs.push(from)
//   }
//   if (to) {
//     sw += ' AND s.invoice_date <= ?'
//     sArgs.push(to)
//   }
//   const [sales] = await pool.query(
//     `SELECT s.id AS sale_id, s.invoice_no, s.invoice_date, s.invoice_time,
//             s.payment_type,
//             c.name AS customer, c.code AS customer_code,
//             si.quantity, si.rate, si.discount_percent, si.discount_amount,
//             si.net_amount,
//             COALESCE(
//               (SELECT sl.balance_avg_cost FROM stock_ledger sl
//                 WHERE sl.reference_type = 'sale'
//                   AND sl.reference_id   = si.sale_id
//                   AND sl.item_id        = si.item_id
//                 LIMIT 1),
//               i.average_cost
//             ) AS unit_cost
//        FROM sale_items si
//        JOIN sales s ON s.id = si.sale_id AND s.is_cancelled = 0
//        JOIN items i ON i.id = si.item_id
//        LEFT JOIN customers c ON c.id = s.customer_id
//       WHERE si.item_id = ? ${sw}
//       ORDER BY s.invoice_date DESC, s.invoice_time DESC, s.id DESC`,
//     sArgs
//   )
//   for (const r of sales) {
//     r.cost = +(Number(r.quantity) * Number(r.unit_cost)).toFixed(2)
//     r.profit = +(Number(r.net_amount) - r.cost).toFixed(2)
//   }

//   const rArgs = [itemId]
//   let rw = ''
//   if (from) {
//     rw += ' AND sr.return_date >= ?'
//     rArgs.push(from)
//   }
//   if (to) {
//     rw += ' AND sr.return_date <= ?'
//     rArgs.push(to)
//   }
//   const [returns] = await pool.query(
//     `SELECT sr.id AS return_id, sr.return_no, sr.return_date, sr.refund_mode,
//             s.invoice_no AS original_invoice,
//             c.name AS customer, c.code AS customer_code,
//             sri.quantity, sri.rate, sri.amount,
//             COALESCE(
//               (SELECT sl.balance_avg_cost FROM stock_ledger sl
//                 WHERE sl.reference_type = 'sale'
//                   AND sl.reference_id   = si.sale_id
//                   AND sl.item_id        = si.item_id
//                 LIMIT 1),
//               i.average_cost
//             ) AS unit_cost
//        FROM sales_return_items sri
//        JOIN sales_returns sr ON sr.id = sri.return_id
//        JOIN sale_items si    ON si.id = sri.sale_item_id
//        JOIN sales s          ON s.id  = sr.sale_id
//        JOIN items i          ON i.id  = sri.item_id
//        LEFT JOIN customers c ON c.id  = sr.customer_id
//       WHERE sri.item_id = ? ${rw}
//       ORDER BY sr.return_date DESC, sr.id DESC`,
//     rArgs
//   )
//   for (const r of returns) {
//     r.cost = +(Number(r.quantity) * Number(r.unit_cost)).toFixed(2)
//     // Goods restocked: cost recovered. Net impact on the period's profit = amount - cost.
//     r.profit_impact = +(Number(r.amount) - r.cost).toFixed(2)
//   }

//   return { item, sales, returns }
// }

// async function dayBook(date) {
//   const d = date || localToday()
//   // `kind` = SALE / RECOVERY / OTHER RECEIPT / EXPENSE / PURCHASE / REFUND / OTHER PAYMENT,
//   // so sale money and credit recoveries are separate, clearly labelled rows.
//   const [vouchers] = await pool.query(
//     `SELECT v.voucher_no, v.voucher_type, v.payment_method, v.amount, v.reference,
//             v.description, a.name AS account_name, ${VOUCHER_KIND_SQL} AS kind,
//             COALESCE(cu.name, ve.name, v.payee) AS party
//        FROM vouchers v
//        LEFT JOIN accounts a ON a.id = v.account_id
//        LEFT JOIN customers cu ON cu.id = v.party_id AND v.party_type = 'customer'
//        LEFT JOIN vendors   ve ON ve.id = v.party_id AND v.party_type = 'vendor'
//       WHERE v.voucher_date = ?
//       ORDER BY v.voucher_type, v.id`,
//     [d]
//   )
//   const receipts = vouchers
//     .filter((v) => v.voucher_type === 'receipt')
//     .reduce((s, v) => s + Number(v.amount), 0)
//   const payments = vouchers
//     .filter((v) => v.voucher_type !== 'receipt')
//     .reduce((s, v) => s + Number(v.amount), 0)
//   // Per-kind totals (e.g. byKind.SALE vs byKind.RECOVERY) — never merged.
//   const byKind = {}
//   for (const v of vouchers)
//     byKind[v.kind] = +((byKind[v.kind] || 0) + Number(v.amount)).toFixed(2)
//   // Sales figure comes from the sales table only (includes credit bills, which move no cash).
//   const [[sales]] = await pool.query(
//     `SELECT COUNT(*) AS bills, COALESCE(SUM(net_total),0) AS total,
//             COALESCE(SUM(CASE WHEN payment_type='cash'   THEN net_total ELSE 0 END),0) AS cash,
//             COALESCE(SUM(CASE WHEN payment_type='online' THEN net_total ELSE 0 END),0) AS online,
//             COALESCE(SUM(CASE WHEN payment_type='credit' THEN net_total ELSE 0 END),0) AS credit
//        FROM sales WHERE invoice_date = ? AND is_cancelled = 0`,
//     [d]
//   )
//   const [[purch]] = await pool.query(
//     `SELECT COUNT(*) AS orders, COALESCE(SUM(total_incl_tax),0) AS total
//        FROM purchase_orders WHERE order_date = ? AND status = 'received'`,
//     [d]
//   )
//   // Returns made today reduce today's Sales (client's rule; the refund money itself is a REFUND row).
//   const ret = await salesReturnsInRange(pool, d, d)
//   return {
//     date: d,
//     vouchers,
//     receipts: +receipts.toFixed(2),
//     payments: +payments.toFixed(2),
//     net: +(receipts - payments).toFixed(2),
//     salesBills: Number(sales.bills),
//     salesTotal: Number(sales.total),
//     salesCash: Number(sales.cash),
//     salesOnline: Number(sales.online),
//     salesCredit: Number(sales.credit),
//     salesReturns: ret.total,
//     salesReturnCount: ret.count,
//     netSales: +(Number(sales.total) - ret.total).toFixed(2),
//     recoveryTotal: byKind.RECOVERY || 0,
//     byKind,
//     purchaseOrders: Number(purch.orders),
//     purchaseTotal: Number(purch.total)
//   }
// }

// // 🆕 Credit Recovery report — repayment vouchers only (money received for earlier udhaar).
// // Kept completely apart from the Sales report so recoveries are never read as sales.
// async function creditRecovery(from, to, search) {
//   const args = []
//   let where = `WHERE v.voucher_type = 'receipt' AND v.reference = 'repayment'`
//   if (from) {
//     where += ' AND v.voucher_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     where += ' AND v.voucher_date <= ?'
//     args.push(to)
//   }
//   if (search && search.trim()) {
//     where += ' AND (c.name LIKE ? OR c.code LIKE ? OR v.voucher_no LIKE ?)'
//     const s = `%${search.trim()}%`
//     args.push(s, s, s)
//   }
//   const [rows] = await pool.query(
//     `SELECT v.id, v.voucher_no, v.voucher_date, TIME(v.created_at) AS voucher_time,
//             v.amount, v.payment_method, v.description,
//             a.name AS account_name, a.type AS account_type,
//             c.id AS customer_id, c.code AS customer_code, c.name AS customer,
//             c.current_balance AS balance_now, u.full_name AS received_by
//        FROM vouchers v
//        JOIN customers c ON c.id = v.party_id AND v.party_type = 'customer'
//        LEFT JOIN accounts a ON a.id = v.account_id
//        LEFT JOIN users u ON u.id = v.created_by
//       ${where}
//       ORDER BY v.voucher_date DESC, v.id DESC`,
//     args
//   )
//   const totals = rows.reduce(
//     (t, r) => ({
//       count: t.count + 1,
//       total: +(t.total + Number(r.amount)).toFixed(2),
//       cash: +(
//         t.cash + (r.account_type === 'bank' ? 0 : Number(r.amount))
//       ).toFixed(2),
//       bank: +(
//         t.bank + (r.account_type === 'bank' ? Number(r.amount) : 0)
//       ).toFixed(2)
//     }),
//     { count: 0, total: 0, cash: 0, bank: 0 }
//   )
//   totals.customers = new Set(rows.map((r) => r.customer_id)).size
//   return { rows, totals }
// }

// export function registerReportsHandlers(ipcMain) {
//   ipcMain.handle(
//     'reports:customer-summary',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         const rows = await customerSummary(from, to, search)
//         const totals = rows.reduce(
//           (t, r) => ({
//             bills: t.bills + Number(r.bills),
//             billed: t.billed + Number(r.billed),
//             received: t.received + Number(r.received),
//             change_given: t.change_given + Number(r.change_given),
//             cash_total: t.cash_total + Number(r.cash_total),
//             online_total: t.online_total + Number(r.online_total),
//             credit_total: t.credit_total + Number(r.credit_total),
//             outstanding: t.outstanding + Number(r.outstanding),
//             returns: t.returns + r.returns,
//             net_sales: +(t.net_sales + r.net_sales).toFixed(2)
//           }),
//           {
//             returns: 0,
//             net_sales: 0,
//             bills: 0,
//             billed: 0,
//             received: 0,
//             change_given: 0,
//             cash_total: 0,
//             online_total: 0,
//             credit_total: 0,
//             outstanding: 0
//           }
//         )
//         return { ok: true, data: { rows, totals } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:customer-detail',
//     async (_e, { actingUserId, customerId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         const [[customer]] = await pool.query(
//           `SELECT id, code, name, telephone, current_balance FROM customers WHERE id = ?`,
//           [customerId]
//         )
//         if (!customer) return { ok: false, error: 'Customer not found.' }

//         const sArgs = [customerId]
//         const df = dateFrag(from, to, sArgs)
//         const [sales] = await pool.query(
//           `SELECT s.id, s.invoice_no, s.invoice_date, s.payment_type,
//                 s.net_total, s.amount_received, s.cash_back AS change_given,
//                 (s.net_total - s.amount_received) AS outstanding,
//                 sm.name AS salesman, u.full_name AS operator
//            FROM sales s
//            LEFT JOIN users u ON u.id = s.created_by
//            LEFT JOIN salesmen sm ON sm.id = s.salesman_id
//           WHERE s.customer_id = ? AND s.is_cancelled = 0${df}
//           ORDER BY s.invoice_date DESC, s.id DESC`,
//           sArgs
//         )

//         const rArgs = [customerId]
//         const rdf = dateFrag(from, to, rArgs).replace(
//           /s\.invoice_date/g,
//           'v.voucher_date'
//         )
//         const [repayments] = await pool.query(
//           `SELECT v.id, v.voucher_no, v.amount, v.description, v.voucher_date, a.name AS account_name
//            FROM vouchers v LEFT JOIN accounts a ON a.id = v.account_id
//           WHERE v.party_type='customer' AND v.party_id = ?
//             AND v.voucher_type='receipt' AND v.reference='repayment'${rdf}
//           ORDER BY v.voucher_date DESC, v.id DESC`,
//           rArgs
//         )

//         return { ok: true, data: { customer, sales, repayments } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:export-customer-summary',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         const rows = await customerSummary(from, to, search)
//         const win = BrowserWindow.getFocusedWindow()
//         const result = await dialog.showSaveDialog(win, {
//           title: 'Export Customer Report',
//           defaultPath: `customer-report-${from || 'all'}_${to || 'all'}.xlsx`,
//           filters: [{ name: 'Excel', extensions: ['xlsx'] }]
//         })
//         if (result.canceled || !result.filePath)
//           return { ok: true, data: { canceled: true } }
//         const sheet = rows.map((r) => ({
//           Code: r.code,
//           Customer: r.name,
//           Bills: Number(r.bills),
//           Billed: Number(r.billed),
//           Returns: Number(r.returns),
//           'Net Sales': Number(r.net_sales),
//           Received: Number(r.received),
//           'Change Given': Number(r.change_given),
//           Cash: Number(r.cash_total),
//           Online: Number(r.online_total),
//           Credit: Number(r.credit_total),
//           Outstanding: Number(r.outstanding)
//         }))
//         const ws = XLSX.utils.json_to_sheet(sheet)
//         const wb = XLSX.utils.book_new()
//         XLSX.utils.book_append_sheet(wb, ws, 'Customer Report')
//         XLSX.writeFile(wb, result.filePath)
//         return { ok: true, data: { path: result.filePath, count: rows.length } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:sales-summary',
//     async (_e, { actingUserId, from, to, groupBy } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await salesSummary(from, to, groupBy) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // Every sales invoice in the period (Sales report -> All Invoices)
//   ipcMain.handle(
//     'reports:sales-invoices',
//     async (_e, { actingUserId, from, to, paymentType, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return {
//           ok: true,
//           data: await salesInvoices(from, to, paymentType, search)
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Credit Recovery report (repayments only — never part of Sales)
//   ipcMain.handle(
//     'reports:credit-recovery',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await creditRecovery(from, to, search) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:purchase-list',
//     async (_e, { actingUserId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await purchaseList(from, to) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Per-product purchases — gross vs net of returns-to-vendor
//   ipcMain.handle(
//     'reports:purchases-by-product',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await purchasesByProduct(from, to, search) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Per-product purchases drill-down
//   ipcMain.handle(
//     'reports:purchases-by-product-detail',
//     async (_e, { actingUserId, itemId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return {
//           ok: true,
//           data: await purchasesByProductDetail(itemId, from, to)
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:purchase-payments',
//     async (_e, { actingUserId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await purchasePayments(from, to) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ✅ CHANGED: accept categoryId
//   ipcMain.handle(
//     'reports:stock-valuation',
//     async (_e, { actingUserId, search, categoryId } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await stockValuation(search, categoryId) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Product-wise Profit & Loss summary
//   ipcMain.handle(
//     'reports:profit-loss',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await profitLossSummary(from, to, search) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Product-wise Profit & Loss drill-down
//   ipcMain.handle(
//     'reports:profit-loss-detail',
//     async (_e, { actingUserId, itemId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await profitLossDetail(itemId, from, to) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle(
//     'reports:day-book',
//     async (_e, { actingUserId, date } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return { ok: true, data: await dayBook(date) }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Customer Ledger — printable single-customer statement
//   ipcMain.handle(
//     'reports:customer-ledger',
//     async (_e, { actingUserId, customerId, from, to } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         if (!customerId) return { ok: false, error: 'Pick a customer.' }

//         const [[customer]] = await pool.query(
//           `SELECT id, code, name, telephone, opening_balance, current_balance
//              FROM customers WHERE id = ?`,
//           [customerId]
//         )
//         if (!customer) return { ok: false, error: 'Customer not found.' }

//         let openingAtFrom = Number(customer.opening_balance) || 0
//         if (from) {
//           const [[pre]] = await pool.query(
//             `SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS c
//                FROM customer_ledger
//               WHERE customer_id = ? AND entry_date < ?`,
//             [customerId, from]
//           )
//           openingAtFrom = +(
//             Number(customer.opening_balance) +
//             Number(pre.d) -
//             Number(pre.c)
//           ).toFixed(2)
//         }

//         const args = [customerId]
//         let where = ''
//         if (from) {
//           where += ' AND entry_date >= ?'
//           args.push(from)
//         }
//         if (to) {
//           where += ' AND entry_date <= ?'
//           args.push(to)
//         }

//         const [entries] = await pool.query(
//           `SELECT cl.id, cl.entry_type, cl.entry_date, cl.debit, cl.credit, cl.description,
//                   cl.reference_type, cl.reference_id, cl.created_at,
//                   vv.voucher_no, ss.invoice_no, sr.return_no, srs.invoice_no AS return_invoice_no
//              FROM customer_ledger cl
//              LEFT JOIN vouchers vv
//                     ON cl.reference_type = 'voucher' AND vv.id = cl.reference_id
//              LEFT JOIN sales ss
//                     ON cl.reference_type = 'sale' AND ss.id = cl.reference_id
//              LEFT JOIN sales_returns sr
//                     ON cl.reference_type = 'return' AND sr.id = cl.reference_id
//              LEFT JOIN sales srs ON srs.id = sr.sale_id
//             WHERE cl.customer_id = ?${where.replace(/entry_date/g, 'cl.entry_date')}
//             ORDER BY cl.entry_date ASC, cl.id ASC`,
//           args
//         )

//         const labelMap = {
//           credit_sale: 'Credit Sale',
//           repayment: 'Cash Received',
//           return_credit_offset: 'Goods Returned',
//           return_cash_refund: 'Cash Refund Paid',
//           adjustment: 'Adjustment'
//         }

//         const rows = []
//         rows.push({
//           date: null,
//           tran_no: '',
//           ref_no: '',
//           description: 'Opening Balance',
//           // Debit = what the customer owes us (bills); Credit = what came off it (payments,
//           // returns). Before, the two columns were swapped.
//           debit: openingAtFrom > 0 ? openingAtFrom : 0,
//           credit: openingAtFrom < 0 ? Math.abs(openingAtFrom) : 0,
//           sortKey: '0000-00-00T00:00:00.000Z'
//         })

//         for (const l of entries) {
//           const d = Number(l.debit) || 0
//           const c = Number(l.credit) || 0
//           let tranNo = ''
//           if (l.entry_type === 'credit_sale' && l.reference_id)
//             tranNo = l.invoice_no ? 'INV #' + l.invoice_no : ''
//           else if (l.entry_type === 'repayment')
//             // Real voucher number via the reference_id link. (It used to be built from
//             // reference_id itself, which is the voucher's row id — not its RV number.)
//             tranNo =
//               l.voucher_no ||
//               ((l.description || '').match(/RV-\d+/) || [])[0] ||
//               ''
//           else if (l.reference_type === 'return' && l.reference_id)
//             tranNo = l.return_no || '' // real return number (was built from the row id)

//           let refNo = ''
//           if (l.reference_type === 'sale' && l.invoice_no)
//             refNo = '#' + l.invoice_no
//           else if (l.reference_type === 'return' && l.return_invoice_no)
//             refNo = '#' + l.return_invoice_no

//           rows.push({
//             date: l.entry_date,
//             tran_no: tranNo,
//             ref_no: refNo,
//             description:
//               l.description || labelMap[l.entry_type] || l.entry_type,
//             debit: d,
//             credit: c,
//             sortKey: l.created_at
//               ? new Date(l.created_at).toISOString()
//               : l.entry_date + 'T00:00:00.000Z'
//           })
//         }

//         rows.sort((a, b) =>
//           a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0
//         )

//         let running = 0
//         for (const r of rows) {
//           running = +(running + r.debit - r.credit).toFixed(2) // + = customer owes (Dr)
//           r.balance = running
//           r.status = running > 0.009 ? 'Dr' : running < -0.009 ? 'Cr' : ''
//         }

//         const totals = rows.reduce(
//           (t, r) => ({
//             debit: +(t.debit + r.debit).toFixed(2),
//             credit: +(t.credit + r.credit).toFixed(2)
//           }),
//           { debit: 0, credit: 0 }
//         )
//         totals.closing = running

//         // "Total Sales" counts ONLY this customer's invoices in the period (sales table,
//         // all payment types). Recoveries are a separate line — the ledger rows above show
//         // both (sale = +, payment = −) but the two totals are never added together.
//         const sArgs = [customerId]
//         let sw = ''
//         if (from) {
//           sw += ' AND invoice_date >= ?'
//           sArgs.push(from)
//         }
//         if (to) {
//           sw += ' AND invoice_date <= ?'
//           sArgs.push(to)
//         }
//         const [[saleTot]] = await pool.query(
//           `SELECT COUNT(*) AS bills, COALESCE(SUM(net_total),0) AS total
//              FROM sales WHERE customer_id = ? AND is_cancelled = 0${sw}`,
//           sArgs
//         )
//         const [[recTot]] = await pool.query(
//           `SELECT COALESCE(SUM(amount),0) AS total FROM vouchers
//             WHERE voucher_type = 'receipt' AND reference = 'repayment'
//               AND party_type = 'customer' AND party_id = ?${sw.replace(/invoice_date/g, 'voucher_date')}`,
//           sArgs
//         )
//         const [[retTot]] = await pool.query(
//           `SELECT COALESCE(SUM(total_amount),0) AS total FROM sales_returns
//             WHERE customer_id = ?${sw.replace(/invoice_date/g, 'return_date')}`,
//           sArgs
//         )
//         // Total Sales is NET of goods this customer returned in the period.
//         totals.grossSales = Number(saleTot.total)
//         totals.salesReturns = Number(retTot.total)
//         totals.totalSales = +(totals.grossSales - totals.salesReturns).toFixed(
//           2
//         )
//         totals.salesBills = Number(saleTot.bills)
//         totals.totalRecovery = Number(recTot.total)

//         return {
//           ok: true,
//           data: {
//             customer,
//             rows,
//             totals,
//             from: from || null,
//             to: to || null
//           }
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // 🆕 Customers' Balances — list of all customers
//   ipcMain.handle(
//     'reports:customer-balances',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         let where = 'WHERE c.is_active = 1'
//         const args = []
//         if (search && search.trim()) {
//           where += ' AND (c.name LIKE ? OR c.code LIKE ?)'
//           const s = `%${search.trim()}%`
//           args.push(s, s)
//         }

//         const [custs] = await pool.query(
//           `SELECT c.id, c.code, c.name, c.telephone,
//                   c.opening_balance, c.current_balance
//              FROM customers c ${where}
//             ORDER BY CAST(c.code AS UNSIGNED), c.name`,
//           args
//         )

//         const rows = []
//         for (const c of custs) {
//           let openingAtFrom = Number(c.opening_balance) || 0
//           if (from) {
//             const [[pre]] = await pool.query(
//               `SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS cr
//                  FROM customer_ledger
//                 WHERE customer_id = ? AND entry_date < ?`,
//               [c.id, from]
//             )
//             openingAtFrom = +(
//               Number(c.opening_balance) +
//               Number(pre.d) -
//               Number(pre.cr)
//             ).toFixed(2)
//           }

//           const pArgs = [c.id]
//           let pw = ''
//           if (from) {
//             pw += ' AND entry_date >= ?'
//             pArgs.push(from)
//           }
//           if (to) {
//             pw += ' AND entry_date <= ?'
//             pArgs.push(to)
//           }
//           const [[per]] = await pool.query(
//             `SELECT COALESCE(SUM(debit),0) AS d,
//                     COALESCE(SUM(credit),0) AS cr
//                FROM customer_ledger WHERE customer_id = ?${pw}`,
//             pArgs
//           )
//           // Debit = bills (customer owes more), Credit = payments/returns (was swapped).
//           const periodDebit = +Number(per.d).toFixed(2)
//           const periodCredit = +Number(per.cr).toFixed(2)
//           const closing = +(openingAtFrom + periodDebit - periodCredit).toFixed(
//             2
//           )

//           if (
//             !search &&
//             Math.abs(openingAtFrom) < 0.01 &&
//             Math.abs(periodCredit) < 0.01 &&
//             Math.abs(periodDebit) < 0.01
//           )
//             continue

//           rows.push({
//             id: c.id,
//             code: c.code,
//             name: c.name,
//             telephone: c.telephone,
//             opening: openingAtFrom,
//             debit: periodDebit,
//             credit: periodCredit,
//             closing,
//             status: closing > 0.009 ? 'Dr' : closing < -0.009 ? 'Cr' : ''
//           })
//         }

//         const totals = rows.reduce(
//           (t, r) => ({
//             opening: +(t.opening + r.opening).toFixed(2),
//             debit: +(t.debit + r.debit).toFixed(2),
//             credit: +(t.credit + r.credit).toFixed(2),
//             closing: +(t.closing + r.closing).toFixed(2)
//           }),
//           { opening: 0, debit: 0, credit: 0, closing: 0 }
//         )

//         return {
//           ok: true,
//           data: { rows, totals, from: from || null, to: to || null }
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ✅ Phase A3 — 📌 PINNED HERE (dayBook ke baad, export se pehle)
//   // ✅ CHANGED: now accepts and passes `search`
//   ipcMain.handle(
//     'reports:salesman-performance',
//     async (_e, { actingUserId, from, to, search } = {}) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         return {
//           ok: true,
//           data: await salesmanPerformance(from, to, search)
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ✅ CHANGED: accept categoryId and pass it through to stockValuation
//   ipcMain.handle(
//     'reports:export',
//     async (
//       _e,
//       {
//         actingUserId,
//         reportType,
//         from,
//         to,
//         search,
//         date,
//         categoryId,
//         groupBy,
//         paymentType
//       } = {}
//     ) => {
//       try {
//         await authorize(actingUserId, ADMIN_ROLES)
//         let sheet = [],
//           name = 'Report',
//           file = 'report'
//         if (reportType === 'sales') {
//           const { rows } = await salesSummary(from, to, groupBy)
//           sheet = rows.map((r) => ({
//             [groupBy === 'month'
//               ? 'Month'
//               : groupBy === 'year'
//                 ? 'Year'
//                 : 'Date']: r.invoice_date,
//             Bills: Number(r.bills),
//             Sales: Number(r.sales),
//             Discount: Number(r.discount),
//             Received: Number(r.received),
//             Cash: Number(r.cash),
//             Online: Number(r.online),
//             Credit: Number(r.credit),
//             Returns: Number(r.returns),
//             'Net Sales': Number(r.net_sales),
//             'Cash Bills': Number(r.cash_bills || 0),
//             'Online Bills': Number(r.online_bills || 0),
//             'Credit Bills': Number(r.credit_bills || 0)
//           }))
//           name = 'Sales'
//           file = `sales-report-${groupBy || 'day'}-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'salesInvoices') {
//           const { rows } = await salesInvoices(from, to, paymentType, search)
//           sheet = rows.map((r) => ({
//             Invoice: r.invoice_no,
//             Date: r.invoice_date,
//             Time: r.invoice_time || '',
//             Customer: r.customer,
//             Code: r.customer_code,
//             Salesman: r.salesman || '',
//             Type: r.payment_type,
//             Amount: Number(r.net_total),
//             Received: Number(r.amount_received),
//             'Due at sale': Number(r.outstanding),
//             Returned: Number(r.returned)
//           }))
//           name = 'Sales Invoices'
//           file = `sales-invoices-${paymentType || 'all'}-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'creditRecovery') {
//           const { rows } = await creditRecovery(from, to, search)
//           sheet = rows.map((r) => ({
//             Voucher: r.voucher_no,
//             Date: r.voucher_date,
//             Time: r.voucher_time || '',
//             Code: r.customer_code,
//             Customer: r.customer,
//             Account: r.account_name || '',
//             Method: r.payment_method,
//             Note: r.description || '',
//             Amount: Number(r.amount),
//             'Balance Now': Number(r.balance_now)
//           }))
//           name = 'Credit Recovery'
//           file = `credit-recovery-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'purchases') {
//           const { rows } = await purchaseList(from, to)
//           sheet = rows.map((r) => ({
//             Serial: r.serial_no,
//             Date: r.order_date,
//             Vendor: r.vendor || '',
//             Status: r.status,
//             SubTotal: Number(r.sub_total),
//             GST: Number(r.gst_amount),
//             Total: Number(r.total_incl_tax),
//             Returned: Number(r.returned),
//             Net: Number(r.net)
//           }))
//           name = 'Purchases'
//           file = `purchase-report-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'purchasePayments') {
//           const { rows } = await purchasePayments(from, to)
//           sheet = rows.map((r) => ({
//             Voucher: r.voucher_no,
//             Date: r.voucher_date,
//             PO: r.serial_no || '',
//             Vendor: r.vendor || '',
//             Method: r.payment_method,
//             Account: r.account_name || '',
//             Amount: Number(r.amount)
//           }))
//           name = 'Purchase Payments'
//           file = `purchase-payments-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'stock') {
//           // ✅ pass categoryId; ✅ Size column added
//           const { rows } = await stockValuation(search, categoryId)
//           sheet = rows.map((r) => ({
//             Code: r.item_code,
//             Item: r.name,
//             Size: r.size || '',
//             Category: r.category || '',
//             SubCategory: r.sub_category || '',
//             Stock: Number(r.current_stock),
//             PurchasePrice: Number(r.purchase_price),
//             SellingPrice: Number(r.selling_price),
//             AvgCost: Number(r.average_cost),
//             Value: Number(r.value)
//           }))
//           name = 'Stock'
//           file = 'stock-valuation'
//         } else if (reportType === 'profitLoss') {
//           const { rows } = await profitLossSummary(from, to, search)
//           sheet = rows.map((r) => ({
//             Code: r.item_code,
//             Item: r.name,
//             Size: r.size || '',
//             Category: r.category || '',
//             'Qty Sold': Number(r.qty_sold),
//             'Qty Returned': Number(r.qty_returned),
//             Revenue: Number(r.revenue),
//             Cost: Number(r.cost),
//             'Profit / Loss': Number(r.profit),
//             'Margin %': Number(r.margin)
//           }))
//           name = 'Profit & Loss'
//           file = `profit-loss-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'salesman') {
//           // ✅ pass search through
//           const { rows } = await salesmanPerformance(from, to, search)
//           sheet = rows.map((r) => ({
//             Salesman: r.name,
//             Phone: r.phone || '',
//             Bills: Number(r.bills),
//             Sales: Number(r.sales),
//             Returns: Number(r.returns),
//             'Net Sales': Number(r.net_sales),
//             Discount: Number(r.discount),
//             Received: Number(r.received),
//             Cash: Number(r.cash),
//             Online: Number(r.online),
//             Credit: Number(r.credit)
//           }))
//           name = 'Salesman Performance'
//           file = `salesman-perf-${from || 'all'}_${to || 'all'}`
//         } else if (reportType === 'daybook') {
//           const d = await dayBook(date)
//           sheet = d.vouchers.map((v) => ({
//             Voucher: v.voucher_no,
//             Kind: v.kind, // SALE / RECOVERY / EXPENSE … — never mixed
//             Type: v.voucher_type,
//             Party: v.party || '',
//             Method: v.payment_method,
//             Account: v.account_name || '',
//             Reference: v.reference || '',
//             Description: v.description || '',
//             Amount: Number(v.amount)
//           }))
//           name = 'Day Book'
//           file = `day-book-${d.date}`
//         } else if (reportType === 'purchasesByProduct') {
//           const { rows } = await purchasesByProduct(from, to, search)
//           sheet = rows.map((r) => ({
//             Code: r.item_code,
//             Item: r.name,
//             Size: r.size || '',
//             Unit: r.unit || '',
//             Bills: r.bill_count,
//             'Qty Purchased': r.qty_purchased,
//             'Qty Returned': r.qty_returned,
//             'Qty Net': r.qty_net,
//             'Gross Amount': r.gross_amount,
//             'Returned Value': r.amount_returned,
//             'Net Amount': r.net_amount,
//             'Avg Rate': r.avg_rate,
//             'First Purchase': r.first_purchase,
//             'Last Purchase': r.last_purchase
//           }))
//           name = 'Purchases by Product'
//           file = `purchases-by-product-${from || 'all'}_${to || 'all'}`
//         } else return { ok: false, error: 'Unknown report type.' }

//         const win = BrowserWindow.getFocusedWindow()
//         const result = await dialog.showSaveDialog(win, {
//           title: `Export ${name} Report`,
//           defaultPath: `${file}.xlsx`,
//           filters: [{ name: 'Excel', extensions: ['xlsx'] }]
//         })
//         if (result.canceled || !result.filePath)
//           return { ok: true, data: { canceled: true } }
//         const ws = XLSX.utils.json_to_sheet(
//           sheet.length ? sheet : [{ Note: 'No data in range' }]
//         )
//         const wb = XLSX.utils.book_new()
//         XLSX.utils.book_append_sheet(wb, ws, name)
//         XLSX.writeFile(wb, result.filePath)
//         return {
//           ok: true,
//           data: { path: result.filePath, count: sheet.length }
//         }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )
// }

import { dialog, BrowserWindow } from 'electron'
import * as XLSX from 'xlsx'
import pool from '../db/pool.js'
import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'
import {
  VOUCHER_KIND_SQL,
  VENDOR_PAYMENT_SQL,
  salesReturnsInRange
} from '../services/reconciliation.service.js'

import { localToday } from '../services/date.util.js'
// Build the sales-date filter fragment shared by summary + export.
function dateFrag(from, to, args) {
  let frag = ''
  if (from) {
    frag += ' AND s.invoice_date >= ?'
    args.push(from)
  }
  if (to) {
    frag += ' AND s.invoice_date <= ?'
    args.push(to)
  }
  return frag
}

// Returns made in [from, to] (client's rule: cut from the day the goods came back, return_date)
// grouped by a column of the ORIGINAL sale ('customer_id' | 'salesman_id'). Used to show
// Returns / Net Sales beside gross sales.
async function returnsBy(saleCol, from, to) {
  const args = []
  let w = ''
  if (from) {
    w += ' AND r.return_date >= ?'
    args.push(from)
  }
  if (to) {
    w += ' AND r.return_date <= ?'
    args.push(to)
  }
  const [rows] = await pool.query(
    `SELECT s.${saleCol} AS k, COALESCE(SUM(r.total_amount),0) AS total
       FROM sales_returns r JOIN sales s ON s.id = r.sale_id
      WHERE 1=1${w}
      GROUP BY s.${saleCol}`,
    args
  )
  return new Map(rows.map((r) => [r.k ?? null, Number(r.total)]))
}

async function customerSummary(from, to, search) {
  const args = []
  const df = dateFrag(from, to, args)
  let searchWhere = ''
  if (search && search.trim()) {
    searchWhere = ' WHERE (c.name LIKE ? OR c.code LIKE ?)'
    const s = `%${search.trim()}%`
    args.push(s, s)
  }
  const [rows] = await pool.query(
    `SELECT c.id, c.code, c.name, c.current_balance AS outstanding,
            COUNT(s.id) AS bills,
            COALESCE(SUM(s.net_total),0)        AS billed,
            COALESCE(SUM(s.amount_received),0)  AS received,
            COALESCE(SUM(s.cash_back),0)        AS change_given,
            COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash_total,
            COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online_total,
            COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit_total
       FROM customers c
       LEFT JOIN sales s ON s.customer_id = c.id AND s.is_cancelled = 0${df}
       ${searchWhere}
      GROUP BY c.id, c.code, c.name, c.current_balance
     HAVING bills > 0 OR outstanding > 0
      ORDER BY billed DESC, outstanding DESC`,
    args
  )
  // `billed` stays gross (it pairs with received / cash / online / credit);
  // `returns` and `net_sales` show what the customer actually kept.
  const ret = await returnsBy('customer_id', from, to)
  for (const r of rows) {
    r.returns = ret.get(r.id) || 0
    r.net_sales = +(Number(r.billed) - r.returns).toFixed(2)
  }
  return rows
}

// Sales report — `sales` table ONLY (credit recoveries are in the Credit Recovery report).
// groupBy: 'day' (default) | 'month' | 'year'. The period is returned in `invoice_date`
// (existing field the page/export already read) and `period`.
const SALES_PERIOD = {
  day: 's.invoice_date',
  month: "DATE_FORMAT(s.invoice_date, '%Y-%m')",
  year: 'CAST(YEAR(s.invoice_date) AS CHAR)'
}
async function salesSummary(from, to, groupBy = 'day') {
  const args = []
  dateFrag(from, to, args)
  const periodExpr = SALES_PERIOD[groupBy] || SALES_PERIOD.day
  const [rows] = await pool.query(
    `SELECT ${periodExpr} AS invoice_date, ${periodExpr} AS period, COUNT(*) AS bills,
            COALESCE(SUM(s.net_total),0)       AS sales,
            COALESCE(SUM(s.discount),0)        AS discount,
            COALESCE(SUM(s.amount_received),0) AS received,
            COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
            COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
            COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit,
            -- how MANY bills of each type (owner wants counts, not just amounts)
            COALESCE(SUM(s.payment_type='cash'),0)   AS cash_bills,
            COALESCE(SUM(s.payment_type='online'),0) AS online_bills,
            COALESCE(SUM(s.payment_type='credit'),0) AS credit_bills
       FROM sales s
      WHERE s.is_cancelled = 0 ${from ? 'AND s.invoice_date >= ?' : ''} ${to ? 'AND s.invoice_date <= ?' : ''}
      GROUP BY ${periodExpr}
      ORDER BY ${periodExpr} DESC`,
    args
  )

  // Returns reduce Sales in the period they happen (return_date). `sales` and the
  // cash/online/credit split stay gross; `returns` and `net_sales` are added per period.
  // Client's rule: a return reduces the Sales of the period it came back in (return_date).
  const retPeriod = periodExpr.replace(/s\.invoice_date/g, 'r.return_date')
  const rArgs = []
  let rWhere = ''
  if (from) {
    rWhere += ' AND r.return_date >= ?'
    rArgs.push(from)
  }
  if (to) {
    rWhere += ' AND r.return_date <= ?'
    rArgs.push(to)
  }
  const [retRows] = await pool.query(
    `SELECT ${retPeriod} AS period, COALESCE(SUM(r.total_amount),0) AS returns
       FROM sales_returns r JOIN sales s ON s.id = r.sale_id WHERE 1=1${rWhere}
      GROUP BY ${retPeriod}`,
    rArgs
  )
  const byPeriod = new Map(rows.map((r) => [String(r.period), r]))
  for (const rr of retRows) {
    // A period with returns but no new bills still needs a row.
    if (!byPeriod.has(String(rr.period))) {
      const blank = {
        invoice_date: rr.period,
        period: rr.period,
        bills: 0,
        sales: 0,
        discount: 0,
        received: 0,
        cash: 0,
        online: 0,
        credit: 0,
        cash_bills: 0,
        online_bills: 0,
        credit_bills: 0
      }
      byPeriod.set(String(rr.period), blank)
      rows.push(blank)
    }
    byPeriod.get(String(rr.period)).returns = Number(rr.returns)
  }
  for (const r of rows) {
    r.returns = Number(r.returns || 0)
    r.net_sales = +(Number(r.sales) - r.returns).toFixed(2)
  }
  rows.sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1))

  const totals = rows.reduce(
    (t, r) => ({
      bills: t.bills + Number(r.bills),
      sales: t.sales + Number(r.sales),
      discount: t.discount + Number(r.discount),
      received: t.received + Number(r.received),
      cash: t.cash + Number(r.cash),
      online: t.online + Number(r.online),
      credit: t.credit + Number(r.credit),
      returns: t.returns + r.returns,
      net_sales: +(t.net_sales + r.net_sales).toFixed(2),
      cash_bills: t.cash_bills + Number(r.cash_bills || 0),
      online_bills: t.online_bills + Number(r.online_bills || 0),
      credit_bills: t.credit_bills + Number(r.credit_bills || 0)
    }),
    {
      bills: 0,
      sales: 0,
      discount: 0,
      received: 0,
      cash: 0,
      online: 0,
      credit: 0,
      returns: 0,
      net_sales: 0,
      cash_bills: 0,
      online_bills: 0,
      credit_bills: 0
    }
  )
  return { rows, totals }
}

// Sales-invoice search (F2). Runs in SQL so the on-screen list and the Excel export match.
//   >1000  >=1000  <500  <=500  =1300   → invoice amount (net_total) comparisons
//   1000-2000                           → amount range (inclusive)
//   1001  (digits only)                 → invoice # 1001, OR customer code 1001 / ending in
//                                          1001 (codes are long, e.g. 12001001), OR name
//   anything else                       → invoice # / customer name / customer code contains
export function invoiceSearchSql(search) {
  const q = String(search || '').trim()
  if (!q) return null
  let m = q.match(/^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/)
  if (m) return { sql: `s.net_total ${m[1]} ?`, args: [Number(m[2])] }
  m = q.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y)
    return { sql: 's.net_total BETWEEN ? AND ?', args: [a, b] }
  }
  if (/^\d+$/.test(q))
    return {
      sql: '(s.invoice_no = ? OR c.code = ? OR c.code LIKE ? OR c.name LIKE ?)',
      args: [q, q, `%${q}`, `%${q}%`]
    }
  const like = `%${q}%`
  return {
    sql: '(s.invoice_no LIKE ? OR c.name LIKE ? OR c.code LIKE ?)',
    args: [like, like, like]
  }
}

// Every individual sales invoice in the period (Sales report -> "All Invoices").
// Lets the owner see each bill and count how many were cash / online / credit.
// Sales table only (not cancelled); returns on each bill are shown alongside.
async function salesInvoices(from, to, paymentType, search) {
  const args = []
  let where = 'WHERE s.is_cancelled = 0'
  if (from) {
    where += ' AND s.invoice_date >= ?'
    args.push(from)
  }
  if (to) {
    where += ' AND s.invoice_date <= ?'
    args.push(to)
  }
  if (['cash', 'online', 'credit'].includes(paymentType)) {
    where += ' AND s.payment_type = ?'
    args.push(paymentType)
  }
  const sq = invoiceSearchSql(search)
  if (sq) {
    where += ` AND ${sq.sql}`
    args.push(...sq.args)
  }
  const [rows] = await pool.query(
    `SELECT s.id, s.invoice_no, s.invoice_date, s.invoice_time, s.payment_type,
            s.net_total, s.discount, s.amount_received,
            (s.net_total - s.amount_received) AS outstanding,
            c.name AS customer, c.code AS customer_code,
            sm.name AS salesman, u.full_name AS operator,
            (SELECT COALESCE(SUM(r.total_amount),0) FROM sales_returns r WHERE r.sale_id = s.id) AS returned
       FROM sales s
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users u ON u.id = s.created_by
       LEFT JOIN salesmen sm ON sm.id = s.salesman_id
      ${where}
      ORDER BY s.invoice_date DESC, s.invoice_time DESC, s.id DESC`,
    args
  )
  const blank = () => ({ count: 0, amount: 0 })
  const totals = {
    count: 0,
    amount: 0,
    cash: blank(),
    online: blank(),
    credit: blank(),
    returned: 0
  }
  for (const r of rows) {
    totals.count += 1
    totals.amount = +(totals.amount + Number(r.net_total)).toFixed(2)
    const b = totals[r.payment_type]
    if (b) {
      b.count += 1
      b.amount = +(b.amount + Number(r.net_total)).toFixed(2)
    }
    totals.returned = +(totals.returned + Number(r.returned)).toFixed(2)
  }
  return { rows, totals }
}

async function purchaseList(from, to) {
  const args = []
  const [rows] = await pool.query(
    `SELECT p.id, p.serial_no, p.order_date, p.status, v.name AS vendor,
            p.sub_total, p.gst_amount, p.total_incl_tax,
            -- goods sent back to the vendor against this bill (was not shown at all)
            (SELECT COALESCE(SUM(pr.total_amount),0) FROM purchase_returns pr
              WHERE pr.purchase_order_id = p.id) AS returned
       FROM purchase_orders p
       LEFT JOIN vendors v ON v.id = p.vendor_id
      WHERE 1=1 ${from ? 'AND p.order_date >= ?' : ''} ${to ? 'AND p.order_date <= ?' : ''}
      ORDER BY p.order_date DESC, p.id DESC`,
    [...(from ? [from] : []), ...(to ? [to] : [])]
  )
  for (const r of rows) {
    r.returned = Number(r.returned) || 0
    r.net = +(Number(r.total_incl_tax) - r.returned).toFixed(2)
  }
  const totals = rows.reduce(
    (t, r) => {
      const recv = r.status === 'received'
      return {
        orders: t.orders + 1,
        received: t.received + (recv ? 1 : 0),
        sub: t.sub + (recv ? Number(r.sub_total) : 0),
        gst: t.gst + (recv ? Number(r.gst_amount) : 0),
        total: t.total + (recv ? Number(r.total_incl_tax) : 0),
        returned: t.returned + (recv ? r.returned : 0)
      }
    },
    { orders: 0, received: 0, sub: 0, gst: 0, total: 0, returned: 0 }
  )
  totals.returned = +totals.returned.toFixed(2)
  totals.net = +(totals.total - totals.returned).toFixed(2)
  return { rows, totals }
}

// Per-product purchase report. Gross vs net (returns to vendor in the same range).
async function purchasesByProduct(from, to, search) {
  const args = []
  let w = "WHERE po.status = 'received' AND poi.item_id IS NOT NULL"
  if (from) {
    w += ' AND po.order_date >= ?'
    args.push(from)
  }
  if (to) {
    w += ' AND po.order_date <= ?'
    args.push(to)
  }
  if (search && search.trim()) {
    w += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'
    const s = `%${search.trim()}%`
    args.push(s, s)
  }

  const [rows] = await pool.query(
    `SELECT i.id AS item_id, i.item_code, i.name, i.size, i.unit,
            COUNT(DISTINCT po.id)   AS bill_count,
            SUM(poi.quantity)       AS qty_purchased,
            SUM(poi.amount)         AS gross_amount,
            AVG(poi.rate)           AS avg_rate,
            MIN(po.order_date)      AS first_purchase,
            MAX(po.order_date)      AS last_purchase
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
       JOIN items i ON i.id = poi.item_id
       ${w}
       GROUP BY i.id, i.item_code, i.name, i.size, i.unit
       ORDER BY gross_amount DESC`,
    args
  )

  const rArgs = []
  let rw = ''
  if (from) {
    rw += ' AND pr.return_date >= ?'
    rArgs.push(from)
  }
  if (to) {
    rw += ' AND pr.return_date <= ?'
    rArgs.push(to)
  }
  const [retRows] = await pool.query(
    `SELECT pri.item_id, SUM(pri.quantity) AS qty_returned, SUM(pri.amount) AS amount_returned
       FROM purchase_return_items pri
       JOIN purchase_returns pr ON pr.id = pri.return_id
      WHERE 1=1 ${rw}
      GROUP BY pri.item_id`,
    rArgs
  )
  const retMap = new Map(retRows.map((r) => [r.item_id, r]))

  let totQty = 0,
    totAmt = 0,
    totRetQty = 0,
    totRetAmt = 0
  const out = rows.map((r) => {
    const ret = retMap.get(r.item_id)
    const qtyReturned = Number(ret?.qty_returned || 0)
    const amountReturned = Number(ret?.amount_returned || 0)
    totQty += Number(r.qty_purchased)
    totAmt += Number(r.gross_amount)
    totRetQty += qtyReturned
    totRetAmt += amountReturned
    return {
      item_id: r.item_id,
      item_code: r.item_code,
      name: r.name,
      size: r.size,
      unit: r.unit,
      bill_count: Number(r.bill_count),
      qty_purchased: Number(r.qty_purchased),
      qty_returned: qtyReturned,
      qty_net: Number(r.qty_purchased) - qtyReturned,
      gross_amount: +Number(r.gross_amount).toFixed(2),
      amount_returned: +amountReturned.toFixed(2),
      net_amount: +(Number(r.gross_amount) - amountReturned).toFixed(2),
      avg_rate: +Number(r.avg_rate || 0).toFixed(2),
      first_purchase: r.first_purchase,
      last_purchase: r.last_purchase
    }
  })

  return {
    rows: out,
    totals: {
      items: out.length,
      bills: out.reduce((s, r) => s + r.bill_count, 0),
      qty_purchased: totQty,
      qty_returned: totRetQty,
      qty_net: totQty - totRetQty,
      gross_amount: +totAmt.toFixed(2),
      amount_returned: +totRetAmt.toFixed(2),
      net_amount: +(totAmt - totRetAmt).toFixed(2)
    }
  }
}

// One product's purchase bills + returns-to-vendor for the period (drill-down).
async function purchasesByProductDetail(itemId, from, to) {
  const [[item]] = await pool.query(
    `SELECT id, item_code, name, size, unit,
            purchase_price, selling_price, average_cost, current_stock
       FROM items WHERE id = ?`,
    [itemId]
  )
  if (!item) throw new Error('Item not found.')

  const args = [itemId]
  let w = ''
  if (from) {
    w += ' AND po.order_date >= ?'
    args.push(from)
  }
  if (to) {
    w += ' AND po.order_date <= ?'
    args.push(to)
  }
  const [bills] = await pool.query(
    `SELECT po.id AS bill_id, po.serial_no, po.order_date, po.vendor_bill_no,
            v.name AS vendor,
            poi.quantity, poi.unit, poi.rate, poi.amount,
            poi.gst_rate, poi.gst_amount, poi.value_incl_tax
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
       LEFT JOIN vendors v ON v.id = po.vendor_id
      WHERE poi.item_id = ? AND po.status = 'received' ${w}
      ORDER BY po.order_date DESC, po.id DESC`,
    args
  )

  const rArgs = [itemId]
  let rw = ''
  if (from) {
    rw += ' AND pr.return_date >= ?'
    rArgs.push(from)
  }
  if (to) {
    rw += ' AND pr.return_date <= ?'
    rArgs.push(to)
  }
  const [returns] = await pool.query(
    `SELECT pr.id AS return_id, pr.return_no, pr.return_date, pr.settlement,
            po.serial_no AS original_bill_no, v.name AS vendor,
            pri.quantity, pri.rate, pri.amount
       FROM purchase_return_items pri
       JOIN purchase_returns pr ON pr.id = pri.return_id
       LEFT JOIN purchase_orders po ON po.id = pr.purchase_order_id
       LEFT JOIN vendors v ON v.id = pr.vendor_id
      WHERE pri.item_id = ? ${rw}
      ORDER BY pr.return_date DESC, pr.id DESC`,
    rArgs
  )

  return { item, bills, returns }
}

async function purchasePayments(from, to) {
  const args = []
  let df = ''
  if (from) {
    df += ' AND v.voucher_date >= ?'
    args.push(from)
  }
  if (to) {
    df += ' AND v.voucher_date <= ?'
    args.push(to)
  }
  const [rows] = await pool.query(
    `SELECT v.voucher_no, v.voucher_date, v.amount, v.payment_method, v.reference,
            a.name AS account_name, ve.name AS vendor, po.serial_no
       FROM vouchers v
       LEFT JOIN accounts a ON a.id = v.account_id
       LEFT JOIN purchase_orders po ON po.id = v.purchase_order_id
       LEFT JOIN vendors ve ON ve.id = v.party_id AND v.party_type = 'vendor'
      WHERE ${VENDOR_PAYMENT_SQL} ${df}
      ORDER BY v.voucher_date DESC, v.id DESC`,
    args
  )
  const totals = rows.reduce(
    (t, r) => ({
      total: t.total + Number(r.amount),
      cash: t.cash + (r.payment_method === 'cash' ? Number(r.amount) : 0),
      bank: t.bank + (r.payment_method === 'bank' ? Number(r.amount) : 0)
    }),
    { total: 0, cash: 0, bank: 0 }
  )
  return { rows, totals }
}

// ✅ Phase A3 — salesman performance (with optional name search)
async function salesmanPerformance(from, to, search) {
  const dateArgs = []
  let df = ''
  if (from) {
    df += ' AND s.invoice_date >= ?'
    dateArgs.push(from)
  }
  if (to) {
    df += ' AND s.invoice_date <= ?'
    dateArgs.push(to)
  }

  const args = [...dateArgs]
  let searchWhere = ''
  if (search && search.trim()) {
    searchWhere = ' WHERE sm.name LIKE ?'
    args.push(`%${search.trim()}%`)
  }

  const [rows] = await pool.query(
    `SELECT sm.id, sm.name, sm.phone,
            COUNT(s.id) AS bills,
            COALESCE(SUM(s.net_total),0)       AS sales,
            COALESCE(SUM(s.discount),0)        AS discount,
            COALESCE(SUM(s.amount_received),0) AS received,
            COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
            COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
            COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit
       FROM salesmen sm
       LEFT JOIN sales s
              ON s.salesman_id = sm.id
             AND s.is_cancelled = 0${df}
       ${searchWhere}
      GROUP BY sm.id, sm.name, sm.phone
      ORDER BY sales DESC, sm.name`,
    args
  )

  // Unassigned row — only when NOT searching (skip when filtering by name)
  if (!search || !search.trim()) {
    const [un] = await pool.query(
      `SELECT COUNT(*) AS bills,
              COALESCE(SUM(s.net_total),0)       AS sales,
              COALESCE(SUM(s.discount),0)        AS discount,
              COALESCE(SUM(s.amount_received),0) AS received,
              COALESCE(SUM(CASE WHEN s.payment_type='cash'   THEN s.net_total ELSE 0 END),0) AS cash,
              COALESCE(SUM(CASE WHEN s.payment_type='online' THEN s.net_total ELSE 0 END),0) AS online,
              COALESCE(SUM(CASE WHEN s.payment_type='credit' THEN s.net_total ELSE 0 END),0) AS credit
         FROM sales s
        WHERE s.is_cancelled = 0
          AND s.salesman_id IS NULL${df}`,
      dateArgs
    )
    if (un[0] && Number(un[0].bills) > 0) {
      rows.push({ id: null, name: '(Unassigned)', phone: null, ...un[0] })
    }
  }

  // Returns of each salesman's bills (by return date) → Net Sales. `sales` stays gross.
  const ret = await returnsBy('salesman_id', from, to)
  for (const r of rows) {
    r.returns = ret.get(r.id ?? null) || 0
    r.net_sales = +(Number(r.sales) - r.returns).toFixed(2)
  }

  const totals = rows.reduce(
    (t, r) => ({
      bills: t.bills + Number(r.bills),
      sales: t.sales + Number(r.sales),
      discount: t.discount + Number(r.discount),
      received: t.received + Number(r.received),
      cash: t.cash + Number(r.cash),
      online: t.online + Number(r.online),
      credit: t.credit + Number(r.credit),
      returns: t.returns + r.returns,
      net_sales: +(t.net_sales + r.net_sales).toFixed(2)
    }),
    {
      bills: 0,
      sales: 0,
      discount: 0,
      received: 0,
      cash: 0,
      online: 0,
      credit: 0,
      returns: 0,
      net_sales: 0
    }
  )
  return { rows, totals }
}

// ─── Stock Tracker ───
// One product's vendor-wise purchase breakdown + every bill that brought it in.
// Used by the "Stock Tracker" drill-down on the Stock Valuation report.
// async function stockTrackerDetails(itemId) {
//   const [[item]] = await pool.query(
//     `SELECT id, item_code, name, size, unit, current_stock, purchase_price, average_cost, selling_price
//        FROM items WHERE id = ?`,
//     [itemId]
//   )
//   if (!item) throw new Error('Item not found.')

//   // 1. Vendor Breakdown (aggregated)
//   const [vendors] = await pool.query(
//     `SELECT
//        COALESCE(v.id, 0) AS vendor_id,
//        COALESCE(v.name, '— No Vendor / Direct —') AS vendor,
//        COUNT(DISTINCT po.id) AS bill_count,
//        SUM(poi.quantity) AS qty_purchased,
//        SUM(poi.amount) AS total_amount,
//        AVG(poi.rate) AS avg_rate,
//        MIN(po.order_date) AS first_purchase,
//        MAX(po.order_date) AS last_purchase
//      FROM purchase_order_items poi
//      JOIN purchase_orders po ON po.id = poi.purchase_order_id
//      LEFT JOIN vendors v ON v.id = po.vendor_id
//      WHERE poi.item_id = ? AND po.status = 'received'
//      GROUP BY v.id, v.name
//      ORDER BY qty_purchased DESC`,
//     [itemId]
//   )

//   // 2. Detailed Bills
//   const [bills] = await pool.query(
//     `SELECT po.id AS bill_id, po.serial_no, po.order_date, po.vendor_bill_no,
//             COALESCE(v.name, '— No Vendor —') AS vendor,
//             poi.quantity, poi.unit, poi.rate, poi.amount
//        FROM purchase_order_items poi
//        JOIN purchase_orders po ON po.id = poi.purchase_order_id
//        LEFT JOIN vendors v ON v.id = po.vendor_id
//       WHERE poi.item_id = ? AND po.status = 'received'
//       ORDER BY po.order_date DESC, po.id DESC`,
//     [itemId]
//   )

//   return { item, vendors, bills }
// }

async function stockTrackerDetails(itemId) {
  const [[item]] = await pool.query(
    `SELECT id, item_code, name, size, unit, current_stock, purchase_price, average_cost, selling_price
       FROM items WHERE id = ?`,
    [itemId]
  )
  if (!item) throw new Error('Item not found.')

  // 1. Vendor Breakdown
  const [vendors] = await pool.query(
    `SELECT
       COALESCE(v.id, 0) AS vendor_id,
       COALESCE(v.name, '— No Vendor / Direct —') AS vendor,
       COUNT(DISTINCT po.id) AS bill_count,
       SUM(poi.quantity) AS qty_purchased,
       SUM(poi.amount) AS total_amount,
       AVG(poi.rate) AS avg_rate,
       MIN(po.order_date) AS first_purchase,
       MAX(po.order_date) AS last_purchase
     FROM purchase_order_items poi
     JOIN purchase_orders po ON po.id = poi.purchase_order_id
     LEFT JOIN vendors v ON v.id = po.vendor_id
     WHERE poi.item_id = ? AND po.status = 'received'
     GROUP BY v.id, v.name
     ORDER BY qty_purchased DESC`,
    [itemId]
  )

  // 2. Detailed Bills
  const [bills] = await pool.query(
    `SELECT po.id AS bill_id, po.serial_no, po.order_date, po.vendor_bill_no,
            COALESCE(v.name, '— No Vendor —') AS vendor,
            poi.quantity, poi.unit, poi.rate, poi.amount
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
       LEFT JOIN vendors v ON v.id = po.vendor_id
      WHERE poi.item_id = ? AND po.status = 'received'
      ORDER BY po.order_date DESC, po.id DESC`,
    [itemId]
  )

  return { item, vendors, bills }
}

// ✅ CHANGED: now accepts categoryId
async function stockValuation(search, categoryId) {
  const args = []
  let sw = ''
  if (search && search.trim()) {
    sw += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'
    const s = `%${search.trim()}%`
    args.push(s, s)
  }
  if (categoryId) {
    sw += ' AND COALESCE(sc.category_id, i.category_id) = ?'
    args.push(categoryId)
  }
  const [rows] = await pool.query(
    `SELECT i.item_code, i.name, i.unit, i.size, i.current_stock, i.purchase_price,
            i.selling_price, i.average_cost, i.reorder_quantity, i.low_stock_threshold,
            (i.current_stock * i.average_cost) AS value,
            c.name AS category,
            sc.name AS sub_category,
            CASE WHEN i.low_stock_threshold > 0 THEN i.low_stock_threshold ELSE i.reorder_quantity END AS threshold
       FROM items i
       LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
       LEFT JOIN categories c ON c.id = COALESCE(sc.category_id, i.category_id)
      WHERE i.is_active = 1 ${sw}
      ORDER BY value DESC`,
    args
  )
  const totals = rows.reduce(
    (t, r) => {
      const th = Number(r.threshold)
      const low = th > 0 && Number(r.current_stock) <= th
      return {
        items: t.items + 1,
        qty: t.qty + Number(r.current_stock),
        value: t.value + Number(r.value),
        low: t.low + (low ? 1 : 0)
      }
    },
    { items: 0, qty: 0, value: 0, low: 0 }
  )
  return { rows, totals }
}

// Product-wise Profit & Loss — revenue (net of line discounts) minus cost of goods sold,
// net of returns in the same period. Cost basis is the weighted-average cost captured
// on the sale movement in stock_ledger; items.average_cost is only a fallback for
// legacy rows that predate the ledger.
async function profitLossSummary(from, to, search) {
  const args = []
  let w = ''
  if (from) {
    w += ' AND s.invoice_date >= ?'
    args.push(from)
  }
  if (to) {
    w += ' AND s.invoice_date <= ?'
    args.push(to)
  }
  if (search && search.trim()) {
    w += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'
    const s = `%${search.trim()}%`
    args.push(s, s)
  }

  const [rows] = await pool.query(
    `SELECT
       i.id, i.item_code, i.name, i.unit, i.size,
       COALESCE(sc.name, '') AS sub_category,
       COALESCE(c.name, '')  AS category,
       SUM(si.quantity)                    AS qty_sold,
       SUM(si.net_amount)                  AS revenue,
       SUM(si.quantity * COALESCE(
         (SELECT sl.balance_avg_cost FROM stock_ledger sl
           WHERE sl.reference_type = 'sale'
             AND sl.reference_id   = si.sale_id
             AND sl.item_id        = si.item_id
           LIMIT 1),
         i.average_cost
       ))                                  AS cost
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id AND s.is_cancelled = 0
     JOIN items i ON i.id = si.item_id
     LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
     LEFT JOIN categories c       ON c.id = COALESCE(sc.category_id, i.category_id)
     WHERE 1=1 ${w}
     GROUP BY i.id, i.item_code, i.name, i.unit, i.size, sc.name, c.name
     HAVING qty_sold > 0`,
    args
  )

  // Returns in the period. Restocked goods recover their cost, so subtract both
  // revenue and cost for the returned quantity. Traced back to the ORIGINAL sale line
  // via sales_return_items.sale_item_id so we use the same historical cost.
  const rArgs = []
  let rw = ''
  if (from) {
    rw += ' AND sr.return_date >= ?'
    rArgs.push(from)
  }
  if (to) {
    rw += ' AND sr.return_date <= ?'
    rArgs.push(to)
  }
  const [retRows] = await pool.query(
    `SELECT
       sri.item_id,
       SUM(sri.quantity) AS ret_qty,
       SUM(sri.amount)   AS ret_amount,
       SUM(sri.quantity * COALESCE(
         (SELECT sl.balance_avg_cost FROM stock_ledger sl
           WHERE sl.reference_type = 'sale'
             AND sl.reference_id   = si.sale_id
             AND sl.item_id        = si.item_id
           LIMIT 1),
         i.average_cost
       )) AS ret_cost
     FROM sales_return_items sri
     JOIN sales_returns sr ON sr.id = sri.return_id
     JOIN sale_items si    ON si.id = sri.sale_item_id
     JOIN items i          ON i.id  = sri.item_id
     WHERE 1=1 ${rw}
     GROUP BY sri.item_id`,
    rArgs
  )
  const retMap = new Map(retRows.map((r) => [r.item_id, r]))

  let totQty = 0,
    totRev = 0,
    totCost = 0
  const out = rows.map((r) => {
    const ret = retMap.get(r.id)
    const retQty = Number(ret?.ret_qty || 0)
    const retAmt = Number(ret?.ret_amount || 0)
    const retCost = Number(ret?.ret_cost || 0)

    const qty = Number(r.qty_sold) - retQty
    const revenue = +(Number(r.revenue) - retAmt).toFixed(2)
    const cost = +(Number(r.cost) - retCost).toFixed(2)
    const profit = +(revenue - cost).toFixed(2)
    const margin = revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0

    totQty += qty
    totRev += revenue
    totCost += cost
    return {
      id: r.id,
      item_code: r.item_code,
      name: r.name,
      unit: r.unit,
      size: r.size,
      category: r.category,
      sub_category: r.sub_category,
      qty_sold: qty,
      qty_returned: retQty,
      revenue,
      cost,
      profit,
      margin
    }
  })
  out.sort((a, b) => b.profit - a.profit)

  return {
    rows: out,
    totals: {
      items: out.length,
      qty: +totQty.toFixed(2),
      revenue: +totRev.toFixed(2),
      cost: +totCost.toFixed(2),
      profit: +(totRev - totCost).toFixed(2),
      margin: totRev > 0 ? +(((totRev - totCost) / totRev) * 100).toFixed(1) : 0
    }
  }
}

// One product's individual sales and returns in the period (the drill-down).
async function profitLossDetail(itemId, from, to) {
  const [[item]] = await pool.query(
    `SELECT id, item_code, name, unit, size, purchase_price, selling_price,
            average_cost, current_stock
       FROM items WHERE id = ?`,
    [itemId]
  )
  if (!item) throw new Error('Item not found.')

  const sArgs = [itemId]
  let sw = ''
  if (from) {
    sw += ' AND s.invoice_date >= ?'
    sArgs.push(from)
  }
  if (to) {
    sw += ' AND s.invoice_date <= ?'
    sArgs.push(to)
  }
  const [sales] = await pool.query(
    `SELECT s.id AS sale_id, s.invoice_no, s.invoice_date, s.invoice_time,
            s.payment_type,
            c.name AS customer, c.code AS customer_code,
            si.quantity, si.rate, si.discount_percent, si.discount_amount,
            si.net_amount,
            COALESCE(
              (SELECT sl.balance_avg_cost FROM stock_ledger sl
                WHERE sl.reference_type = 'sale'
                  AND sl.reference_id   = si.sale_id
                  AND sl.item_id        = si.item_id
                LIMIT 1),
              i.average_cost
            ) AS unit_cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id AND s.is_cancelled = 0
       JOIN items i ON i.id = si.item_id
       LEFT JOIN customers c ON c.id = s.customer_id
      WHERE si.item_id = ? ${sw}
      ORDER BY s.invoice_date DESC, s.invoice_time DESC, s.id DESC`,
    sArgs
  )
  for (const r of sales) {
    r.cost = +(Number(r.quantity) * Number(r.unit_cost)).toFixed(2)
    r.profit = +(Number(r.net_amount) - r.cost).toFixed(2)
  }

  const rArgs = [itemId]
  let rw = ''
  if (from) {
    rw += ' AND sr.return_date >= ?'
    rArgs.push(from)
  }
  if (to) {
    rw += ' AND sr.return_date <= ?'
    rArgs.push(to)
  }
  const [returns] = await pool.query(
    `SELECT sr.id AS return_id, sr.return_no, sr.return_date, sr.refund_mode,
            s.invoice_no AS original_invoice,
            c.name AS customer, c.code AS customer_code,
            sri.quantity, sri.rate, sri.amount,
            COALESCE(
              (SELECT sl.balance_avg_cost FROM stock_ledger sl
                WHERE sl.reference_type = 'sale'
                  AND sl.reference_id   = si.sale_id
                  AND sl.item_id        = si.item_id
                LIMIT 1),
              i.average_cost
            ) AS unit_cost
       FROM sales_return_items sri
       JOIN sales_returns sr ON sr.id = sri.return_id
       JOIN sale_items si    ON si.id = sri.sale_item_id
       JOIN sales s          ON s.id  = sr.sale_id
       JOIN items i          ON i.id  = sri.item_id
       LEFT JOIN customers c ON c.id  = sr.customer_id
      WHERE sri.item_id = ? ${rw}
      ORDER BY sr.return_date DESC, sr.id DESC`,
    rArgs
  )
  for (const r of returns) {
    r.cost = +(Number(r.quantity) * Number(r.unit_cost)).toFixed(2)
    // Goods restocked: cost recovered. Net impact on the period's profit = amount - cost.
    r.profit_impact = +(Number(r.amount) - r.cost).toFixed(2)
  }

  return { item, sales, returns }
}

async function dayBook(date) {
  const d = date || localToday()
  // `kind` = SALE / RECOVERY / OTHER RECEIPT / EXPENSE / PURCHASE / REFUND / OTHER PAYMENT,
  // so sale money and credit recoveries are separate, clearly labelled rows.
  const [vouchers] = await pool.query(
    `SELECT v.voucher_no, v.voucher_type, v.payment_method, v.amount, v.reference,
            v.description, a.name AS account_name, ${VOUCHER_KIND_SQL} AS kind,
            COALESCE(cu.name, ve.name, v.payee) AS party
       FROM vouchers v
       LEFT JOIN accounts a ON a.id = v.account_id
       LEFT JOIN customers cu ON cu.id = v.party_id AND v.party_type = 'customer'
       LEFT JOIN vendors   ve ON ve.id = v.party_id AND v.party_type = 'vendor'
      WHERE v.voucher_date = ?
      ORDER BY v.voucher_type, v.id`,
    [d]
  )
  const receipts = vouchers
    .filter((v) => v.voucher_type === 'receipt')
    .reduce((s, v) => s + Number(v.amount), 0)
  const payments = vouchers
    .filter((v) => v.voucher_type !== 'receipt')
    .reduce((s, v) => s + Number(v.amount), 0)
  // Per-kind totals (e.g. byKind.SALE vs byKind.RECOVERY) — never merged.
  const byKind = {}
  for (const v of vouchers)
    byKind[v.kind] = +((byKind[v.kind] || 0) + Number(v.amount)).toFixed(2)
  // Sales figure comes from the sales table only (includes credit bills, which move no cash).
  const [[sales]] = await pool.query(
    `SELECT COUNT(*) AS bills, COALESCE(SUM(net_total),0) AS total,
            COALESCE(SUM(CASE WHEN payment_type='cash'   THEN net_total ELSE 0 END),0) AS cash,
            COALESCE(SUM(CASE WHEN payment_type='online' THEN net_total ELSE 0 END),0) AS online,
            COALESCE(SUM(CASE WHEN payment_type='credit' THEN net_total ELSE 0 END),0) AS credit
       FROM sales WHERE invoice_date = ? AND is_cancelled = 0`,
    [d]
  )
  const [[purch]] = await pool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total_incl_tax),0) AS total
       FROM purchase_orders WHERE order_date = ? AND status = 'received'`,
    [d]
  )
  // Returns made today reduce today's Sales (client's rule; the refund money itself is a REFUND row).
  const ret = await salesReturnsInRange(pool, d, d)
  return {
    date: d,
    vouchers,
    receipts: +receipts.toFixed(2),
    payments: +payments.toFixed(2),
    net: +(receipts - payments).toFixed(2),
    salesBills: Number(sales.bills),
    salesTotal: Number(sales.total),
    salesCash: Number(sales.cash),
    salesOnline: Number(sales.online),
    salesCredit: Number(sales.credit),
    salesReturns: ret.total,
    salesReturnCount: ret.count,
    netSales: +(Number(sales.total) - ret.total).toFixed(2),
    recoveryTotal: byKind.RECOVERY || 0,
    byKind,
    purchaseOrders: Number(purch.orders),
    purchaseTotal: Number(purch.total)
  }
}

// 🆕 Credit Recovery report — repayment vouchers only (money received for earlier udhaar).
// Kept completely apart from the Sales report so recoveries are never read as sales.
async function creditRecovery(from, to, search) {
  const args = []
  let where = `WHERE v.voucher_type = 'receipt' AND v.reference = 'repayment'`
  if (from) {
    where += ' AND v.voucher_date >= ?'
    args.push(from)
  }
  if (to) {
    where += ' AND v.voucher_date <= ?'
    args.push(to)
  }
  if (search && search.trim()) {
    where += ' AND (c.name LIKE ? OR c.code LIKE ? OR v.voucher_no LIKE ?)'
    const s = `%${search.trim()}%`
    args.push(s, s, s)
  }
  const [rows] = await pool.query(
    `SELECT v.id, v.voucher_no, v.voucher_date, TIME(v.created_at) AS voucher_time,
            v.amount, v.payment_method, v.description,
            a.name AS account_name, a.type AS account_type,
            c.id AS customer_id, c.code AS customer_code, c.name AS customer,
            c.current_balance AS balance_now, u.full_name AS received_by
       FROM vouchers v
       JOIN customers c ON c.id = v.party_id AND v.party_type = 'customer'
       LEFT JOIN accounts a ON a.id = v.account_id
       LEFT JOIN users u ON u.id = v.created_by
      ${where}
      ORDER BY v.voucher_date DESC, v.id DESC`,
    args
  )
  const totals = rows.reduce(
    (t, r) => ({
      count: t.count + 1,
      total: +(t.total + Number(r.amount)).toFixed(2),
      cash: +(
        t.cash + (r.account_type === 'bank' ? 0 : Number(r.amount))
      ).toFixed(2),
      bank: +(
        t.bank + (r.account_type === 'bank' ? Number(r.amount) : 0)
      ).toFixed(2)
    }),
    { count: 0, total: 0, cash: 0, bank: 0 }
  )
  totals.customers = new Set(rows.map((r) => r.customer_id)).size
  return { rows, totals }
}

export function registerReportsHandlers(ipcMain) {
  ipcMain.handle(
    'reports:customer-summary',
    async (_e, { actingUserId, from, to, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const rows = await customerSummary(from, to, search)
        const totals = rows.reduce(
          (t, r) => ({
            bills: t.bills + Number(r.bills),
            billed: t.billed + Number(r.billed),
            received: t.received + Number(r.received),
            change_given: t.change_given + Number(r.change_given),
            cash_total: t.cash_total + Number(r.cash_total),
            online_total: t.online_total + Number(r.online_total),
            credit_total: t.credit_total + Number(r.credit_total),
            outstanding: t.outstanding + Number(r.outstanding),
            returns: t.returns + r.returns,
            net_sales: +(t.net_sales + r.net_sales).toFixed(2)
          }),
          {
            returns: 0,
            net_sales: 0,
            bills: 0,
            billed: 0,
            received: 0,
            change_given: 0,
            cash_total: 0,
            online_total: 0,
            credit_total: 0,
            outstanding: 0
          }
        )
        return { ok: true, data: { rows, totals } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle(
    'reports:customer-detail',
    async (_e, { actingUserId, customerId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const [[customer]] = await pool.query(
          `SELECT id, code, name, telephone, current_balance FROM customers WHERE id = ?`,
          [customerId]
        )
        if (!customer) return { ok: false, error: 'Customer not found.' }

        const sArgs = [customerId]
        const df = dateFrag(from, to, sArgs)
        const [sales] = await pool.query(
          `SELECT s.id, s.invoice_no, s.invoice_date, s.payment_type,
                s.net_total, s.amount_received, s.cash_back AS change_given,
                (s.net_total - s.amount_received) AS outstanding,
                sm.name AS salesman, u.full_name AS operator
           FROM sales s
           LEFT JOIN users u ON u.id = s.created_by
           LEFT JOIN salesmen sm ON sm.id = s.salesman_id
          WHERE s.customer_id = ? AND s.is_cancelled = 0${df}
          ORDER BY s.invoice_date DESC, s.id DESC`,
          sArgs
        )

        const rArgs = [customerId]
        const rdf = dateFrag(from, to, rArgs).replace(
          /s\.invoice_date/g,
          'v.voucher_date'
        )
        const [repayments] = await pool.query(
          `SELECT v.id, v.voucher_no, v.amount, v.description, v.voucher_date, a.name AS account_name
           FROM vouchers v LEFT JOIN accounts a ON a.id = v.account_id
          WHERE v.party_type='customer' AND v.party_id = ?
            AND v.voucher_type='receipt' AND v.reference='repayment'${rdf}
          ORDER BY v.voucher_date DESC, v.id DESC`,
          rArgs
        )

        return { ok: true, data: { customer, sales, repayments } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle(
    'reports:export-customer-summary',
    async (_e, { actingUserId, from, to, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const rows = await customerSummary(from, to, search)
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showSaveDialog(win, {
          title: 'Export Customer Report',
          defaultPath: `customer-report-${from || 'all'}_${to || 'all'}.xlsx`,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        })
        if (result.canceled || !result.filePath)
          return { ok: true, data: { canceled: true } }
        const sheet = rows.map((r) => ({
          Code: r.code,
          Customer: r.name,
          Bills: Number(r.bills),
          Billed: Number(r.billed),
          Returns: Number(r.returns),
          'Net Sales': Number(r.net_sales),
          Received: Number(r.received),
          'Change Given': Number(r.change_given),
          Cash: Number(r.cash_total),
          Online: Number(r.online_total),
          Credit: Number(r.credit_total),
          Outstanding: Number(r.outstanding)
        }))
        const ws = XLSX.utils.json_to_sheet(sheet)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Customer Report')
        XLSX.writeFile(wb, result.filePath)
        return { ok: true, data: { path: result.filePath, count: rows.length } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle(
    'reports:sales-summary',
    async (_e, { actingUserId, from, to, groupBy } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await salesSummary(from, to, groupBy) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // Every sales invoice in the period (Sales report -> All Invoices)
  ipcMain.handle(
    'reports:sales-invoices',
    async (_e, { actingUserId, from, to, paymentType, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return {
          ok: true,
          data: await salesInvoices(from, to, paymentType, search)
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Credit Recovery report (repayments only — never part of Sales)
  ipcMain.handle(
    'reports:credit-recovery',
    async (_e, { actingUserId, from, to, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await creditRecovery(from, to, search) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle(
    'reports:purchase-list',
    async (_e, { actingUserId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await purchaseList(from, to) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Per-product purchases — gross vs net of returns-to-vendor
  ipcMain.handle(
    'reports:purchases-by-product',
    async (_e, { actingUserId, from, to, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await purchasesByProduct(from, to, search) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Per-product purchases drill-down
  ipcMain.handle(
    'reports:purchases-by-product-detail',
    async (_e, { actingUserId, itemId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return {
          ok: true,
          data: await purchasesByProductDetail(itemId, from, to)
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle(
    'reports:purchase-payments',
    async (_e, { actingUserId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await purchasePayments(from, to) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ✅ CHANGED: accept categoryId
  ipcMain.handle(
    'reports:stock-valuation',
    async (_e, { actingUserId, search, categoryId } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await stockValuation(search, categoryId) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Stock Tracker — per-item vendor breakdown + detailed purchase bills
  ipcMain.handle(
    'reports:stock-tracker',
    async (_e, { actingUserId, itemId } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await stockTrackerDetails(itemId) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Product-wise Profit & Loss summary
  ipcMain.handle(
    'reports:profit-loss',
    async (_e, { actingUserId, from, to, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await profitLossSummary(from, to, search) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Product-wise Profit & Loss drill-down
  ipcMain.handle(
    'reports:profit-loss-detail',
    async (_e, { actingUserId, itemId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await profitLossDetail(itemId, from, to) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle(
    'reports:day-book',
    async (_e, { actingUserId, date } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return { ok: true, data: await dayBook(date) }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Customer Ledger — printable single-customer statement
  ipcMain.handle(
    'reports:customer-ledger',
    async (_e, { actingUserId, customerId, from, to } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        if (!customerId) return { ok: false, error: 'Pick a customer.' }

        const [[customer]] = await pool.query(
          `SELECT id, code, name, telephone, opening_balance, current_balance
             FROM customers WHERE id = ?`,
          [customerId]
        )
        if (!customer) return { ok: false, error: 'Customer not found.' }

        let openingAtFrom = Number(customer.opening_balance) || 0
        if (from) {
          const [[pre]] = await pool.query(
            `SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS c
               FROM customer_ledger
              WHERE customer_id = ? AND entry_date < ?`,
            [customerId, from]
          )
          openingAtFrom = +(
            Number(customer.opening_balance) +
            Number(pre.d) -
            Number(pre.c)
          ).toFixed(2)
        }

        const args = [customerId]
        let where = ''
        if (from) {
          where += ' AND entry_date >= ?'
          args.push(from)
        }
        if (to) {
          where += ' AND entry_date <= ?'
          args.push(to)
        }

        const [entries] = await pool.query(
          `SELECT cl.id, cl.entry_type, cl.entry_date, cl.debit, cl.credit, cl.description,
                  cl.reference_type, cl.reference_id, cl.created_at,
                  vv.voucher_no, ss.invoice_no, sr.return_no, srs.invoice_no AS return_invoice_no
             FROM customer_ledger cl
             LEFT JOIN vouchers vv
                    ON cl.reference_type = 'voucher' AND vv.id = cl.reference_id
             LEFT JOIN sales ss
                    ON cl.reference_type = 'sale' AND ss.id = cl.reference_id
             LEFT JOIN sales_returns sr
                    ON cl.reference_type = 'return' AND sr.id = cl.reference_id
             LEFT JOIN sales srs ON srs.id = sr.sale_id
            WHERE cl.customer_id = ?${where.replace(/entry_date/g, 'cl.entry_date')}
            ORDER BY cl.entry_date ASC, cl.id ASC`,
          args
        )

        const labelMap = {
          credit_sale: 'Credit Sale',
          repayment: 'Cash Received',
          return_credit_offset: 'Goods Returned',
          return_cash_refund: 'Cash Refund Paid',
          adjustment: 'Adjustment'
        }

        const rows = []
        rows.push({
          date: null,
          tran_no: '',
          ref_no: '',
          description: 'Opening Balance',
          // Debit = what the customer owes us (bills); Credit = what came off it (payments,
          // returns). Before, the two columns were swapped.
          debit: openingAtFrom > 0 ? openingAtFrom : 0,
          credit: openingAtFrom < 0 ? Math.abs(openingAtFrom) : 0,
          sortKey: '0000-00-00T00:00:00.000Z'
        })

        for (const l of entries) {
          const d = Number(l.debit) || 0
          const c = Number(l.credit) || 0
          let tranNo = ''
          if (l.entry_type === 'credit_sale' && l.reference_id)
            tranNo = l.invoice_no ? 'INV #' + l.invoice_no : ''
          else if (l.entry_type === 'repayment')
            // Real voucher number via the reference_id link. (It used to be built from
            // reference_id itself, which is the voucher's row id — not its RV number.)
            tranNo =
              l.voucher_no ||
              ((l.description || '').match(/RV-\d+/) || [])[0] ||
              ''
          else if (l.reference_type === 'return' && l.reference_id)
            tranNo = l.return_no || '' // real return number (was built from the row id)

          let refNo = ''
          if (l.reference_type === 'sale' && l.invoice_no)
            refNo = '#' + l.invoice_no
          else if (l.reference_type === 'return' && l.return_invoice_no)
            refNo = '#' + l.return_invoice_no

          rows.push({
            date: l.entry_date,
            tran_no: tranNo,
            ref_no: refNo,
            description:
              l.description || labelMap[l.entry_type] || l.entry_type,
            debit: d,
            credit: c,
            sortKey: l.created_at
              ? new Date(l.created_at).toISOString()
              : l.entry_date + 'T00:00:00.000Z'
          })
        }

        rows.sort((a, b) =>
          a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0
        )

        let running = 0
        for (const r of rows) {
          running = +(running + r.debit - r.credit).toFixed(2) // + = customer owes (Dr)
          r.balance = running
          r.status = running > 0.009 ? 'Dr' : running < -0.009 ? 'Cr' : ''
        }

        const totals = rows.reduce(
          (t, r) => ({
            debit: +(t.debit + r.debit).toFixed(2),
            credit: +(t.credit + r.credit).toFixed(2)
          }),
          { debit: 0, credit: 0 }
        )
        totals.closing = running

        // "Total Sales" counts ONLY this customer's invoices in the period (sales table,
        // all payment types). Recoveries are a separate line — the ledger rows above show
        // both (sale = +, payment = −) but the two totals are never added together.
        const sArgs = [customerId]
        let sw = ''
        if (from) {
          sw += ' AND invoice_date >= ?'
          sArgs.push(from)
        }
        if (to) {
          sw += ' AND invoice_date <= ?'
          sArgs.push(to)
        }
        const [[saleTot]] = await pool.query(
          `SELECT COUNT(*) AS bills, COALESCE(SUM(net_total),0) AS total
             FROM sales WHERE customer_id = ? AND is_cancelled = 0${sw}`,
          sArgs
        )
        const [[recTot]] = await pool.query(
          `SELECT COALESCE(SUM(amount),0) AS total FROM vouchers
            WHERE voucher_type = 'receipt' AND reference = 'repayment'
              AND party_type = 'customer' AND party_id = ?${sw.replace(/invoice_date/g, 'voucher_date')}`,
          sArgs
        )
        const [[retTot]] = await pool.query(
          `SELECT COALESCE(SUM(total_amount),0) AS total FROM sales_returns
            WHERE customer_id = ?${sw.replace(/invoice_date/g, 'return_date')}`,
          sArgs
        )
        // Total Sales is NET of goods this customer returned in the period.
        totals.grossSales = Number(saleTot.total)
        totals.salesReturns = Number(retTot.total)
        totals.totalSales = +(totals.grossSales - totals.salesReturns).toFixed(
          2
        )
        totals.salesBills = Number(saleTot.bills)
        totals.totalRecovery = Number(recTot.total)

        return {
          ok: true,
          data: {
            customer,
            rows,
            totals,
            from: from || null,
            to: to || null
          }
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // 🆕 Customers' Balances — list of all customers
  ipcMain.handle(
    'reports:customer-balances',
    async (_e, { actingUserId, from, to, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        let where = 'WHERE c.is_active = 1'
        const args = []
        if (search && search.trim()) {
          where += ' AND (c.name LIKE ? OR c.code LIKE ?)'
          const s = `%${search.trim()}%`
          args.push(s, s)
        }

        const [custs] = await pool.query(
          `SELECT c.id, c.code, c.name, c.telephone,
                  c.opening_balance, c.current_balance
             FROM customers c ${where}
            ORDER BY CAST(c.code AS UNSIGNED), c.name`,
          args
        )

        const rows = []
        for (const c of custs) {
          let openingAtFrom = Number(c.opening_balance) || 0
          if (from) {
            const [[pre]] = await pool.query(
              `SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS cr
                 FROM customer_ledger
                WHERE customer_id = ? AND entry_date < ?`,
              [c.id, from]
            )
            openingAtFrom = +(
              Number(c.opening_balance) +
              Number(pre.d) -
              Number(pre.cr)
            ).toFixed(2)
          }

          const pArgs = [c.id]
          let pw = ''
          if (from) {
            pw += ' AND entry_date >= ?'
            pArgs.push(from)
          }
          if (to) {
            pw += ' AND entry_date <= ?'
            pArgs.push(to)
          }
          const [[per]] = await pool.query(
            `SELECT COALESCE(SUM(debit),0) AS d,
                    COALESCE(SUM(credit),0) AS cr
               FROM customer_ledger WHERE customer_id = ?${pw}`,
            pArgs
          )
          // Debit = bills (customer owes more), Credit = payments/returns (was swapped).
          const periodDebit = +Number(per.d).toFixed(2)
          const periodCredit = +Number(per.cr).toFixed(2)
          const closing = +(openingAtFrom + periodDebit - periodCredit).toFixed(
            2
          )

          if (
            !search &&
            Math.abs(openingAtFrom) < 0.01 &&
            Math.abs(periodCredit) < 0.01 &&
            Math.abs(periodDebit) < 0.01
          )
            continue

          rows.push({
            id: c.id,
            code: c.code,
            name: c.name,
            telephone: c.telephone,
            opening: openingAtFrom,
            debit: periodDebit,
            credit: periodCredit,
            closing,
            status: closing > 0.009 ? 'Dr' : closing < -0.009 ? 'Cr' : ''
          })
        }

        const totals = rows.reduce(
          (t, r) => ({
            opening: +(t.opening + r.opening).toFixed(2),
            debit: +(t.debit + r.debit).toFixed(2),
            credit: +(t.credit + r.credit).toFixed(2),
            closing: +(t.closing + r.closing).toFixed(2)
          }),
          { opening: 0, debit: 0, credit: 0, closing: 0 }
        )

        return {
          ok: true,
          data: { rows, totals, from: from || null, to: to || null }
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ✅ Phase A3 — 📌 PINNED HERE (dayBook ke baad, export se pehle)
  // ✅ CHANGED: now accepts and passes `search`
  ipcMain.handle(
    'reports:salesman-performance',
    async (_e, { actingUserId, from, to, search } = {}) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        return {
          ok: true,
          data: await salesmanPerformance(from, to, search)
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ✅ CHANGED: accept categoryId and pass it through to stockValuation
  ipcMain.handle(
    'reports:export',
    async (
      _e,
      {
        actingUserId,
        reportType,
        from,
        to,
        search,
        date,
        categoryId,
        groupBy,
        paymentType
      } = {}
    ) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        let sheet = [],
          name = 'Report',
          file = 'report'
        if (reportType === 'sales') {
          const { rows } = await salesSummary(from, to, groupBy)
          sheet = rows.map((r) => ({
            [groupBy === 'month'
              ? 'Month'
              : groupBy === 'year'
                ? 'Year'
                : 'Date']: r.invoice_date,
            Bills: Number(r.bills),
            Sales: Number(r.sales),
            Discount: Number(r.discount),
            Received: Number(r.received),
            Cash: Number(r.cash),
            Online: Number(r.online),
            Credit: Number(r.credit),
            Returns: Number(r.returns),
            'Net Sales': Number(r.net_sales),
            'Cash Bills': Number(r.cash_bills || 0),
            'Online Bills': Number(r.online_bills || 0),
            'Credit Bills': Number(r.credit_bills || 0)
          }))
          name = 'Sales'
          file = `sales-report-${groupBy || 'day'}-${from || 'all'}_${to || 'all'}`
        } else if (reportType === 'salesInvoices') {
          const { rows } = await salesInvoices(from, to, paymentType, search)
          sheet = rows.map((r) => ({
            Invoice: r.invoice_no,
            Date: r.invoice_date,
            Time: r.invoice_time || '',
            Customer: r.customer,
            Code: r.customer_code,
            Salesman: r.salesman || '',
            Type: r.payment_type,
            Amount: Number(r.net_total),
            Received: Number(r.amount_received),
            'Due at sale': Number(r.outstanding),
            Returned: Number(r.returned)
          }))
          name = 'Sales Invoices'
          file = `sales-invoices-${paymentType || 'all'}-${from || 'all'}_${to || 'all'}`
        } else if (reportType === 'creditRecovery') {
          const { rows } = await creditRecovery(from, to, search)
          sheet = rows.map((r) => ({
            Voucher: r.voucher_no,
            Date: r.voucher_date,
            Time: r.voucher_time || '',
            Code: r.customer_code,
            Customer: r.customer,
            Account: r.account_name || '',
            Method: r.payment_method,
            Note: r.description || '',
            Amount: Number(r.amount),
            'Balance Now': Number(r.balance_now)
          }))
          name = 'Credit Recovery'
          file = `credit-recovery-${from || 'all'}_${to || 'all'}`
        } else if (reportType === 'purchases') {
          const { rows } = await purchaseList(from, to)
          sheet = rows.map((r) => ({
            Serial: r.serial_no,
            Date: r.order_date,
            Vendor: r.vendor || '',
            Status: r.status,
            SubTotal: Number(r.sub_total),
            GST: Number(r.gst_amount),
            Total: Number(r.total_incl_tax),
            Returned: Number(r.returned),
            Net: Number(r.net)
          }))
          name = 'Purchases'
          file = `purchase-report-${from || 'all'}_${to || 'all'}`
        } else if (reportType === 'purchasePayments') {
          const { rows } = await purchasePayments(from, to)
          sheet = rows.map((r) => ({
            Voucher: r.voucher_no,
            Date: r.voucher_date,
            PO: r.serial_no || '',
            Vendor: r.vendor || '',
            Method: r.payment_method,
            Account: r.account_name || '',
            Amount: Number(r.amount)
          }))
          name = 'Purchase Payments'
          file = `purchase-payments-${from || 'all'}_${to || 'all'}`
        } else if (reportType === 'stock') {
          // ✅ pass categoryId; ✅ Size column added
          const { rows } = await stockValuation(search, categoryId)
          sheet = rows.map((r) => ({
            Code: r.item_code,
            Item: r.name,
            Size: r.size || '',
            Category: r.category || '',
            SubCategory: r.sub_category || '',
            Stock: Number(r.current_stock),
            PurchasePrice: Number(r.purchase_price),
            SellingPrice: Number(r.selling_price),
            AvgCost: Number(r.average_cost),
            Value: Number(r.value)
          }))
          name = 'Stock'
          file = 'stock-valuation'
        } else if (reportType === 'profitLoss') {
          const { rows } = await profitLossSummary(from, to, search)
          sheet = rows.map((r) => ({
            Code: r.item_code,
            Item: r.name,
            Size: r.size || '',
            Category: r.category || '',
            'Qty Sold': Number(r.qty_sold),
            'Qty Returned': Number(r.qty_returned),
            Revenue: Number(r.revenue),
            Cost: Number(r.cost),
            'Profit / Loss': Number(r.profit),
            'Margin %': Number(r.margin)
          }))
          name = 'Profit & Loss'
          file = `profit-loss-${from || 'all'}_${to || 'all'}`
        } else if (reportType === 'salesman') {
          // ✅ pass search through
          const { rows } = await salesmanPerformance(from, to, search)
          sheet = rows.map((r) => ({
            Salesman: r.name,
            Phone: r.phone || '',
            Bills: Number(r.bills),
            Sales: Number(r.sales),
            Returns: Number(r.returns),
            'Net Sales': Number(r.net_sales),
            Discount: Number(r.discount),
            Received: Number(r.received),
            Cash: Number(r.cash),
            Online: Number(r.online),
            Credit: Number(r.credit)
          }))
          name = 'Salesman Performance'
          file = `salesman-perf-${from || 'all'}_${to || 'all'}`
        } else if (reportType === 'daybook') {
          const d = await dayBook(date)
          sheet = d.vouchers.map((v) => ({
            Voucher: v.voucher_no,
            Kind: v.kind, // SALE / RECOVERY / EXPENSE … — never mixed
            Type: v.voucher_type,
            Party: v.party || '',
            Method: v.payment_method,
            Account: v.account_name || '',
            Reference: v.reference || '',
            Description: v.description || '',
            Amount: Number(v.amount)
          }))
          name = 'Day Book'
          file = `day-book-${d.date}`
        } else if (reportType === 'purchasesByProduct') {
          const { rows } = await purchasesByProduct(from, to, search)
          sheet = rows.map((r) => ({
            Code: r.item_code,
            Item: r.name,
            Size: r.size || '',
            Unit: r.unit || '',
            Bills: r.bill_count,
            'Qty Purchased': r.qty_purchased,
            'Qty Returned': r.qty_returned,
            'Qty Net': r.qty_net,
            'Gross Amount': r.gross_amount,
            'Returned Value': r.amount_returned,
            'Net Amount': r.net_amount,
            'Avg Rate': r.avg_rate,
            'First Purchase': r.first_purchase,
            'Last Purchase': r.last_purchase
          }))
          name = 'Purchases by Product'
          file = `purchases-by-product-${from || 'all'}_${to || 'all'}`
        } else return { ok: false, error: 'Unknown report type.' }

        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showSaveDialog(win, {
          title: `Export ${name} Report`,
          defaultPath: `${file}.xlsx`,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        })
        if (result.canceled || !result.filePath)
          return { ok: true, data: { canceled: true } }
        const ws = XLSX.utils.json_to_sheet(
          sheet.length ? sheet : [{ Note: 'No data in range' }]
        )
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, name)
        XLSX.writeFile(wb, result.filePath)
        return {
          ok: true,
          data: { path: result.filePath, count: sheet.length }
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )
}
