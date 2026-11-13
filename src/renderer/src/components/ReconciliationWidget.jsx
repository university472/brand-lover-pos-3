// import { useEffect, useState } from 'react'
// import { dashboardApi } from '../api/ipc.js'
// import Icon from './Icons.jsx'
// import { printNow } from '../utils/print.js'

// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })

// const MASK = 'Rs. •••••'

// // One label/amount line. `minus` renders the amount in brackets (money going out / udhaar
// // going down) so the owner can add the column top-to-bottom without doing any sign maths.
// function Line({ label, value, minus, total, hidden, optional }) {
//   // Extra lines beyond the agreed layout (e.g. Other Payments) only appear when non-zero.
//   if (optional && Math.abs(Number(value) || 0) < 0.005) return null
//   const shown = hidden
//     ? minus
//       ? `(${MASK})`
//       : MASK
//     : minus
//       ? `(${fmt(value)})`
//       : fmt(value)
//   return (
//     <div className={'recon-line' + (total ? ' total' : '')}>
//       <span>
//         {total ? '= ' : minus ? '− ' : ''}
//         {label}
//       </span>
//       <strong className={minus ? 'neg' : ''}>{shown}</strong>
//     </div>
//   )
// }

// // Signed line (can be + or −) — used for the udhaar "adjustments" balancing figure.
// function SignedLine({ label, value, hidden }) {
//   if (Math.abs(Number(value) || 0) < 0.005) return null
//   const neg = Number(value) < 0
//   return (
//     <div className="recon-line">
//       <span>
//         {neg ? '− ' : '+ '}
//         {label}
//       </span>
//       <strong className={neg ? 'neg' : ''}>
//         {hidden ? MASK : neg ? `(${fmt(Math.abs(value))})` : fmt(value)}
//       </strong>
//     </div>
//   )
// }

// /**
//  * Daily Reconciliation — lets the owner verify the day at night without manual maths.
//  * Sales are sales only; recoveries are shown as their own line in Cash/Bank/Udhaar.
//  *
//  * Props:
//  *  from, to      — dashboard date range ('' = All Time)
//  *  cashBalance   — the Dashboard's "Cash in Hand" figure; ✓/✗ compares Closing Cash to it
//  *  refreshKey    — bump to force a reload (F5 on the Dashboard)
//  *  hidden        — mask amounts (same eye-toggle idea as the stat cards)
//  *  onToggleHidden
//  */
// export default function ReconciliationWidget({
//   from,
//   to,
//   cashBalance,
//   refreshKey,
//   hidden,
//   onToggleHidden
// }) {
//   const [data, setData] = useState(null)
//   const [error, setError] = useState('')

//   useEffect(() => {
//     let alive = true
//     setError('')
//     dashboardApi
//       .reconciliation({ from, to })
//       .then((d) => alive && setData(d))
//       .catch((e) => alive && setError(e.message))
//     return () => {
//       alive = false
//     }
//   }, [from, to, refreshKey])

//   const rangeLabel =
//     !from && !to ? 'All Time' : from === to ? from : `${from || '…'} → ${to || '…'}`

//   if (error)
//     return (
//       <section className="panel recon-panel error-panel">
//         Reconciliation error: {error}
//       </section>
//     )
//   if (!data)
//     return (
//       <section className="panel recon-panel">
//         <p className="muted-text">Loading reconciliation…</p>
//       </section>
//     )

//   const { sales, cashMovement: cm, bankMovement: bm, creditMovement: crm } = data

//   // Owner's rule: ✓ when computed Closing Cash equals the Dashboard's cashBalance field.
//   const counterBalance =
//     cashBalance ?? data.cashCounterCheck?.cashBalance ?? 0
//   const diff = +(cm.closing - Number(counterBalance)).toFixed(2)
//   const matched = Math.abs(diff) < 0.01

//   return (
//     <section className="panel recon-panel" id="recon-print">
//       <div className="recon-print-head">
//         <h2>Brand Lover Family Store</h2>
//         <p>Daily Reconciliation — {rangeLabel}</p>
//       </div>

//       <div className="panel-head">
//         <h3>
//           Daily Reconciliation{' '}
//           <span className="muted-text" style={{ fontSize: 11, fontWeight: 400 }}>
//             {rangeLabel}
//           </span>
//         </h3>
//         <div className="recon-actions">
//           <button
//             type="button"
//             className="btn-sm ghost"
//             onClick={onToggleHidden}
//             title={hidden ? 'Show amounts' : 'Hide amounts'}
//           >
//             <Icon name={hidden ? 'eye-off' : 'eye'} size={15} />
//           </button>
//           <button
//             type="button"
//             className="btn-sm primary"
//             onClick={() => printNow('print-recon')}
//             title="Print reconciliation"
//           >
//             <Icon name="printer" size={15} /> Print
//           </button>
//         </div>
//       </div>

//       <div className="recon-grid">
//         <div className="recon-block">
//           <h4>Bikri (Sales)</h4>
//           <Line label="Cash Sale" value={sales.cash} hidden={hidden} />
//           <Line label="Online Sale" value={sales.online} hidden={hidden} />
//           <Line label="Credit Sale" value={sales.credit} hidden={hidden} />
//           <Line label="Total Sales" value={sales.total} total hidden={hidden} />
//           {/* Returns reduce Sales on the day they happen; only shown when there are any. */}
//           <Line label="Returns" value={sales.returns} minus optional hidden={hidden} />
//           {Number(sales.returns) > 0.005 && (
//             <Line label="Net Sales" value={sales.net} total hidden={hidden} />
//           )}
//         </div>

//         <div className="recon-block">
//           <h4>Cash ka Movement</h4>
//           <Line label="Opening Cash" value={cm.opening} hidden={hidden} />
//           <Line label="+ Cash Sales" value={cm.cashSales} hidden={hidden} />
//           <Line label="+ Credit Recovery" value={cm.recovery} hidden={hidden} />
//           <Line label="+ Other Receipts" value={cm.otherReceipts} hidden={hidden} />
//           <Line label="Purchases (Cash)" value={cm.purchases} minus hidden={hidden} />
//           <Line label="Expenses" value={cm.expenses} minus hidden={hidden} />
//           <Line label="Refunds" value={cm.refunds} minus hidden={hidden} />
//           <Line label="Other Payments" value={cm.otherPayments} minus optional hidden={hidden} />
//           <Line label="Closing Cash" value={cm.closing} total hidden={hidden} />
//         </div>

//         <div className="recon-block">
//           <h4>Bank / Online</h4>
//           <Line label="Opening Bank" value={bm.opening} hidden={hidden} />
//           <Line label="+ Online Sales" value={bm.onlineSales} hidden={hidden} />
//           <Line label="+ Bank Recoveries" value={bm.bankRecovery} hidden={hidden} />
//           <Line label="+ Other Receipts" value={bm.otherReceipts} optional hidden={hidden} />
//           <Line label="Bank Expenses" value={bm.bankExpenses} minus hidden={hidden} />
//           <Line label="Purchases (Bank)" value={bm.purchases} minus optional hidden={hidden} />
//           <Line label="Refunds (Bank)" value={bm.refunds} minus optional hidden={hidden} />
//           <Line label="Other Payments" value={bm.otherPayments} minus optional hidden={hidden} />
//           <Line label="Closing Bank" value={bm.closing} total hidden={hidden} />
//         </div>

//         <div className="recon-block">
//           <h4>Udhaar (Credit) Movement</h4>
//           <Line label="Opening Udhaar" value={crm.opening} hidden={hidden} />
//           <Line label="+ Naya Credit Sale" value={crm.newCredit} hidden={hidden} />
//           <Line label="Recovery" value={crm.recovery} minus hidden={hidden} />
//           <SignedLine label="Returns / Adjustments" value={crm.adjustments} hidden={hidden} />
//           <Line label="Closing Udhaar" value={crm.closing} total hidden={hidden} />
//         </div>
//       </div>

//       <div className="recon-summary">
//         <div className="recon-sum-item">
//           <span>Total Counter Collection</span>
//           <strong>{hidden ? MASK : fmt(data.totalCounterCollection)}</strong>
//           <em>Cash sales + cash recovery</em>
//         </div>
//         <div className="recon-sum-item">
//           <span>Actual Sales</span>
//           <strong>{hidden ? MASK : fmt(data.actualSales)}</strong>
//           <em>
//             {sales.bills} bills
//             {Number(sales.returns) > 0.005 ? ` · net of ${sales.returnCount} returns` : ''} ·
//             recoveries not included
//           </em>
//         </div>
//         <div className={'recon-sum-item ' + (matched ? 'ok' : 'bad')}>
//           <span>Cash Counter Match</span>
//           <strong className={matched ? 'pos' : 'neg'}>
//             {matched ? '✓ Match' : '✗ Mismatch'}
//           </strong>
//           <em>
//             {matched
//               ? 'Closing Cash = Cash in Hand'
//               : `Difference ${hidden ? MASK : fmt(diff)} vs Cash in Hand`}
//           </em>
//         </div>
//       </div>
//     </section>
//   )
// }

import { useEffect, useState } from 'react'
import { dashboardApi } from '../api/ipc.js'
import Icon from './Icons.jsx'
import { printNow } from '../utils/print.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })

const MASK = 'Rs. •••••'

// One label/amount line. `minus` renders the amount in brackets (money going out / udhaar
// going down) so the owner can add the column top-to-bottom without doing any sign maths.
function Line({ label, value, minus, total, hidden, optional }) {
  // Extra lines beyond the agreed layout (e.g. Other Payments) only appear when non-zero.
  if (optional && Math.abs(Number(value) || 0) < 0.005) return null
  const shown = hidden
    ? minus
      ? `(${MASK})`
      : MASK
    : minus
      ? `(${fmt(value)})`
      : fmt(value)
  return (
    <div className={'recon-line' + (total ? ' total' : '')}>
      <span>
        {total ? '= ' : minus ? '− ' : ''}
        {label}
      </span>
      <strong className={minus ? 'neg' : ''}>{shown}</strong>
    </div>
  )
}

// Signed line (can be + or −) — used for the udhaar "adjustments" balancing figure.
function SignedLine({ label, value, hidden }) {
  if (Math.abs(Number(value) || 0) < 0.005) return null
  const neg = Number(value) < 0
  return (
    <div className="recon-line">
      <span>
        {neg ? '− ' : '+ '}
        {label}
      </span>
      <strong className={neg ? 'neg' : ''}>
        {hidden ? MASK : neg ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </strong>
    </div>
  )
}

/**
 * Daily Reconciliation — lets the owner verify the day at night without manual maths.
 * Sales are sales only; recoveries are shown as their own line in Cash/Bank/Udhaar.
 *
 * Props:
 *  from, to      — dashboard date range ('' = All Time)
 *  cashBalance   — the Dashboard's "Cash in Hand" figure; ✓/✗ compares Closing Cash to it
 *  refreshKey    — bump to force a reload (F5 on the Dashboard)
 *  hidden        — mask amounts (same eye-toggle idea as the stat cards)
 *  onToggleHidden
 */
export default function ReconciliationWidget({
  from,
  to,
  cashBalance,
  refreshKey,
  hidden,
  onToggleHidden
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    dashboardApi
      .reconciliation({ from, to })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [from, to, refreshKey])

  const rangeLabel =
    !from && !to
      ? 'All Time'
      : from === to
        ? from
        : `${from || '…'} → ${to || '…'}`

  if (error)
    return (
      <section className="panel recon-panel error-panel">
        Reconciliation error: {error}
      </section>
    )
  if (!data)
    return (
      <section className="panel recon-panel">
        <p className="muted-text">Loading reconciliation…</p>
      </section>
    )

  const {
    sales,
    cashMovement: cm,
    bankMovement: bm,
    creditMovement: crm
  } = data

  // Owner's rule: ✓ when computed Closing Cash equals the Dashboard's cashBalance field.
  const counterBalance = cashBalance ?? data.cashCounterCheck?.cashBalance ?? 0
  const diff = +(cm.closing - Number(counterBalance)).toFixed(2)
  const matched = Math.abs(diff) < 0.01

  return (
    <section className="panel recon-panel" id="recon-print">
      <div className="recon-print-head">
        <h2>Brand Lover Family Store</h2>
        <p>Daily Reconciliation — {rangeLabel}</p>
      </div>

      <div className="panel-head">
        <h3>
          Daily Reconciliation{' '}
          <span
            className="muted-text"
            style={{ fontSize: 11, fontWeight: 400 }}
          >
            {rangeLabel}
          </span>
        </h3>
        <div className="recon-actions">
          <button
            type="button"
            className="btn-sm ghost"
            onClick={onToggleHidden}
            title={hidden ? 'Show amounts' : 'Hide amounts'}
          >
            <Icon name={hidden ? 'eye-off' : 'eye'} size={15} />
          </button>
          <button
            type="button"
            className="btn-sm primary"
            onClick={() => printNow('print-recon')}
            title="Print reconciliation"
          >
            <Icon name="printer" size={15} /> Print
          </button>
        </div>
      </div>

      <div className="recon-grid">
        <div className="recon-block">
          <h4>Bikri (Sales)</h4>
          <Line label="Cash Sale" value={sales.cash} hidden={hidden} />
          <Line label="Online Sale" value={sales.online} hidden={hidden} />
          <Line label="Credit Sale" value={sales.credit} hidden={hidden} />
          <Line label="Total Sales" value={sales.total} total hidden={hidden} />
          {/* Returns reduce Sales on the day they happen; only shown when there are any. */}
          <Line
            label="Returns"
            value={sales.returns}
            minus
            optional
            hidden={hidden}
          />
          {Number(sales.returns) > 0.005 && (
            <Line label="Net Sales" value={sales.net} total hidden={hidden} />
          )}
        </div>

        <div className="recon-block">
          <h4>Cash ka Movement</h4>
          <Line
            label="Opening Cash (Prev Day)"
            value={cm.opening}
            hidden={hidden}
          />
          <Line label="+ Cash Sales" value={cm.cashSales} hidden={hidden} />
          <Line label="+ Credit Recovery" value={cm.recovery} hidden={hidden} />
          <Line
            label="+ Other Receipts"
            value={cm.otherReceipts}
            hidden={hidden}
          />

          {/* NEW: Total Available Line */}
          <Line
            label="Total Available Cash"
            value={cm.available}
            total
            hidden={hidden}
          />

          <Line
            label="Purchases (Cash)"
            value={cm.purchases}
            minus
            hidden={hidden}
          />
          <Line label="Expenses" value={cm.expenses} minus hidden={hidden} />
          <Line label="Refunds" value={cm.refunds} minus hidden={hidden} />
          <Line
            label="Other Payments"
            value={cm.otherPayments}
            minus
            optional
            hidden={hidden}
          />
          <Line label="Closing Cash" value={cm.closing} total hidden={hidden} />
        </div>

        <div className="recon-block">
          <h4>Bank / Online</h4>
          <Line
            label="Opening Bank (Prev Day)"
            value={bm.opening}
            hidden={hidden}
          />
          <Line label="+ Online Sales" value={bm.onlineSales} hidden={hidden} />
          <Line
            label="+ Bank Recoveries"
            value={bm.bankRecovery}
            hidden={hidden}
          />
          <Line
            label="+ Other Receipts"
            value={bm.otherReceipts}
            optional
            hidden={hidden}
          />

          {/* NEW: Total Available Line */}
          <Line
            label="Total Available Bank"
            value={bm.available}
            total
            hidden={hidden}
          />

          <Line
            label="Bank Expenses"
            value={bm.bankExpenses}
            minus
            hidden={hidden}
          />
          <Line
            label="Purchases (Bank)"
            value={bm.purchases}
            minus
            optional
            hidden={hidden}
          />
          <Line
            label="Refunds (Bank)"
            value={bm.refunds}
            minus
            optional
            hidden={hidden}
          />
          <Line
            label="Other Payments"
            value={bm.otherPayments}
            minus
            optional
            hidden={hidden}
          />
          <Line label="Closing Bank" value={bm.closing} total hidden={hidden} />
        </div>

        <div className="recon-block">
          <h4>Udhaar (Credit) Movement</h4>
          <Line label="Opening Udhaar" value={crm.opening} hidden={hidden} />
          <Line
            label="+ Naya Credit Sale"
            value={crm.newCredit}
            hidden={hidden}
          />
          <Line label="Recovery" value={crm.recovery} minus hidden={hidden} />
          <SignedLine
            label="Returns / Adjustments"
            value={crm.adjustments}
            hidden={hidden}
          />
          <Line
            label="Closing Udhaar"
            value={crm.closing}
            total
            hidden={hidden}
          />
        </div>
      </div>

      <div className="recon-summary">
        <div className="recon-sum-item">
          <span>Total Counter Collection</span>
          <strong>{hidden ? MASK : fmt(data.totalCounterCollection)}</strong>
          <em>Cash sales + cash recovery</em>
        </div>
        <div className="recon-sum-item">
          <span>Actual Sales</span>
          <strong>{hidden ? MASK : fmt(data.actualSales)}</strong>
          <em>
            {sales.bills} bills
            {Number(sales.returns) > 0.005
              ? ` · net of ${sales.returnCount} returns`
              : ''}{' '}
            · recoveries not included
          </em>
        </div>
        <div className={'recon-sum-item ' + (matched ? 'ok' : 'bad')}>
          <span>Cash Counter Match</span>
          <strong className={matched ? 'pos' : 'neg'}>
            {matched ? '✓ Match' : '✗ Mismatch'}
          </strong>
          <em>
            {matched
              ? 'Closing Cash = Cash in Hand'
              : `Difference ${hidden ? MASK : fmt(diff)} vs Cash in Hand`}
          </em>
        </div>
      </div>
    </section>
  )
}
