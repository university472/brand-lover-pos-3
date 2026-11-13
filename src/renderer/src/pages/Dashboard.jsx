// import { useCallback, useEffect, useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { dashboardApi, inventoryApi } from '../api/ipc.js'
// import {
//   STOCK_EVENT,
//   getDismissedLowStock,
//   dismissLowStockItem,
//   cleanupDismissedLowStock,
//   LOW_STOCK_DISMISS_EVENT
// } from '../utils/lowStock.js'
// import { useAuth } from '../context/AuthContext.jsx'
// import StatCard from '../components/StatCard.jsx'
// import Icon from '../components/Icons.jsx'
// import DashboardDetailModal from '../components/DashboardDetailModal.jsx'
// import ReconciliationWidget from '../components/ReconciliationWidget.jsx'
// import { useHotkeys } from '../hooks/useHotkeys.js'

// import { localToday, toLocalDateStr } from '../utils/date.js'
// import DatePresets from '../components/DatePresets.jsx'
// import { rangeLabel } from '../utils/dateRanges.js'

// const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK')

// const todayStr = () => localToday()

// // Reusable component for amount + eye toggle
// function AmountWithVisibility({
//   value,
//   visible,
//   onToggle,
//   mask = 'Rs. •••••'
// }) {
//   return (
//     <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
//       <span>{visible ? value : mask}</span>
//       <button
//         type="button"
//         onClick={onToggle}
//         style={{
//           background: 'none',
//           border: 'none',
//           cursor: 'pointer',
//           padding: '2px',
//           opacity: 0.7,
//           transition: 'opacity 0.2s',
//           display: 'inline-flex',
//           alignItems: 'center'
//         }}
//         onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
//         onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
//         aria-label={visible ? 'Hide amount' : 'Show amount'}
//         title={visible ? 'Hide amount' : 'Show amount'}
//       >
//         <Icon name={visible ? 'eye' : 'eye-off'} size={16} />
//       </button>
//     </span>
//   )
// }

// const quickActions = [
//   { label: 'Add New Item', icon: 'plus', to: '/inventory', accent: 'indigo' },
//   { label: 'Purchases', icon: 'truck', to: '/purchases', accent: 'amber' },
//   { label: 'Counter Sale', icon: 'cart', to: '/sales', accent: 'green' },
//   {
//     label: 'Payment / Expense',
//     icon: 'wallet',
//     to: '/payments',
//     accent: 'rose'
//   },
//   { label: 'Day Book', icon: 'book', to: '/reports/daybook', accent: 'sky' }
// ]

// const defaultVisibility = {
//   sales: true,
//   cashBalance: true,
//   bankBalance: true,
//   creditGiven: true,
//   creditCollected: true,
//   openingBalance: true,
//   receipts: true,
//   payments: true,
//   closingBalance: true,
//   receivables: true,
//   payables: true,
//   reconciliation: true
// }

// function loadVisibility() {
//   try {
//     const saved = localStorage.getItem('dashboardAmountVisibility')
//     if (saved) {
//       const parsed = JSON.parse(saved)
//       return { ...defaultVisibility, ...parsed }
//     }
//   } catch {
//     /* ignore */
//   }
//   return { ...defaultVisibility }
// }

// // Quick date presets
// function todayRange() {
//   return { from: todayStr(), to: todayStr() }
// }
// // function thisWeekRange() {
// //   const now = new Date()
// //   const day = now.getDay() // 0=Sun
// //   const diff = day === 0 ? 6 : day - 1 // Monday start
// //   const mon = new Date(now)
// //   mon.setDate(now.getDate() - diff)
// //   return { from: toLocalDateStr(mon), to: todayStr() }
// // }
// function thisWeekRange() {
//   // Get the local date string (YYYY-MM-DD) to bypass timezone offset issues
//   const today = todayStr()
//   const parts = today.split('-')
//   // Create a date object using purely local Y, M, D (Month is 0-indexed)
//   const now = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))

//   const day = now.getDay() // 0=Sun
//   const diff = day === 0 ? 6 : day - 1 // Monday start
//   const mon = new Date(now)
//   mon.setDate(now.getDate() - diff)

//   return { from: toLocalDateStr(mon), to: today }
// }
// function thisMonthRange() {
//   const now = new Date()
//   const first = new Date(now.getFullYear(), now.getMonth(), 1)
//   return { from: toLocalDateStr(first), to: todayStr() }
// }

// export default function Dashboard() {
//   const navigate = useNavigate()
//   const { session } = useAuth()
//   const [data, setData] = useState(null)
//   const [error, setError] = useState('')
//   const [from, setFrom] = useState(todayStr())
//   const [to, setTo] = useState(todayStr())
//   const [visible, setVisible] = useState(loadVisibility)
//   const [detailType, setDetailType] = useState(null)
//   // Bumped on F5 so the reconciliation widget reloads together with the stat cards.
//   const [refreshKey, setRefreshKey] = useState(0)
//   // Low-stock alert (same rule as the Low Stock page / sidebar badge)
//   const [lowItems, setLowItems] = useState([])
//    const loadLow = useCallback(() => {
//     inventoryApi.items
//       .lowStock()
//       .then((items) => {
//         cleanupDismissedLowStock(items) // Clear dismissed IDs if stock was replenished
//         const dismissed = getDismissedLowStock()
//         setLowItems(items.filter((i) => !dismissed.includes(i.id)))
//       })
//       .catch(() => {})
//   }, [])

//   useEffect(() => {
//     loadLow()
//     window.addEventListener(STOCK_EVENT, loadLow)
//     window.addEventListener(LOW_STOCK_DISMISS_EVENT, loadLow) // Listen for dismissals
//     return () => {
//       window.removeEventListener(STOCK_EVENT, loadLow)
//       window.removeEventListener(LOW_STOCK_DISMISS_EVENT, loadLow)
//     }
//   }, [loadLow, refreshKey])
//   useEffect(() => {
//     loadLow()
//     window.addEventListener(STOCK_EVENT, loadLow)
//     return () => window.removeEventListener(STOCK_EVENT, loadLow)
//   }, [loadLow, refreshKey])
//   // Overdue alert: credit bills whose promise-to-pay date has passed and are still unpaid
//   const [overdue, setOverdue] = useState(null)
//   useEffect(() => {
//     dashboardApi
//       .overdueSummary()
//       .then(setOverdue)
//       .catch(() => {})
//   }, [refreshKey])

//   useEffect(() => {
//     try {
//       localStorage.setItem('dashboardAmountVisibility', JSON.stringify(visible))
//     } catch {
//       /* ignore */
//     }
//   }, [visible])

//   const loadSummary = useCallback(async () => {
//     try {
//       setError('')
//       const d = await dashboardApi.getSummary({ from, to })
//       setData(d)
//     } catch (e) {
//       setError(e.message)
//     }
//   }, [from, to])

//   useEffect(() => {
//     loadSummary()
//   }, [loadSummary])

//   const setRange = (r) => {
//     setFrom(r.from)
//     setTo(r.to)
//   }

//   useHotkeys(
//     {
//       f5: () => {
//         loadSummary()
//         setRefreshKey((k) => k + 1)
//       },
//       t: () => setRange(todayRange()),
//       w: () => setRange(thisWeekRange()),
//       m: () => setRange(thisMonthRange()),
//       l: () => setRange({ from: '', to: '' }),
//       'alt+1': () => setDetailType('sales'),
//       'alt+2': () => setDetailType('cash'),
//       'alt+3': () => setDetailType('online'),
//       'alt+4': () => setDetailType('credit'), // matches the Credit Given card (was receivables)
//       'alt+5': () => setDetailType('credit-collections'), // 5th card (Awaiting Payments removed)
//       escape: () => setDetailType(null)
//     },
//     [from, to]
//   )

//   if (error) return <div className="panel error-panel">Error: {error}</div>
//   if (!data) return <div className="panel">Loading dashboard…</div>

//   // Each card says WHAT period it shows. Sales / Credit Given / Credit-Payments follow the
//   // selected range; Cash & Bank are balances at the END of the range. Before, they looked the
//   // same whatever you picked,
//   // and one card always said "Today's" — so the filters seemed not to work.
//   const rl = rangeLabel(from, to)
//   // Drawer / bank balance at the END of the range (Today/Week/Month/All Time all end today).
//   const balWhen = to && to !== todayStr() ? `on ${to}` : 'now'
//   const summaryCards = [
//     {
//       key: 'sales',
//       label: `Sales · ${rl}`,
//       // Client's rule: Sales card = sales (net of returns) − money paid to vendors in the range.
//       value: data.salesCard ?? data.sales,
//       accent: 'indigo',
//       detail: 'sales',
//       hint:
//         data.salesReturns > 0 || data.vendorPaid > 0
//           ? `Gross ${fmt(data.grossSales)}` +
//             (data.salesReturns > 0
//               ? ` − Returns ${fmt(data.salesReturns)}`
//               : '') +
//             (data.vendorPaid > 0 ? ` − Vendors ${fmt(data.vendorPaid)}` : '')
//           : undefined
//     },
//     {
//       // Client's rule: Cash in Hand = CASH SALES of the selected dates (Today → today's cash
//       // sales, 29→29 → only the 29th, This Month → the month's total); clicking lists those
//       // receipts. The drawer balance (needed for the night-time counter check) is the small line.
//       key: 'cashBalance', // (saved show/hide setting keeps its old key)
//       label: `Cash in Hand · ${rl}`,
//       // cash sales − paid to vendors from Cash in Hand (client's rule)
//       value: data.cashCard ?? data.cashSales,
//       accent: 'green',
//       detail: 'cash',
//       hint:
//         (data.vendorPaidCash > 0 || data.refundCash > 0 || data.expenseCash > 0
//           ? `sales ${fmt(data.cashSales)}` +
//             (data.refundCash > 0 ? ` − refunds ${fmt(data.refundCash)}` : '') +
//             (data.vendorPaidCash > 0
//               ? ` − vendors ${fmt(data.vendorPaidCash)}`
//               : '') +
//             (data.expenseCash > 0 ? ` − expenses ${fmt(data.expenseCash)}` : '')
//           : 'cash sales') + ` · drawer ${balWhen}: ${fmt(data.cashBalance)}`
//     },
//     {
//       key: 'bankBalance',
//       label: `Bank / Online · ${rl}`,
//       value: data.bankCard ?? data.onlineSales, // online sales − paid to vendors online
//       accent: 'indigo',
//       detail: 'online',
//       hint:
//         (data.vendorPaidBank > 0 || data.refundBank > 0 || data.expenseBank > 0
//           ? `sales ${fmt(data.onlineSales)}` +
//             (data.refundBank > 0 ? ` − refunds ${fmt(data.refundBank)}` : '') +
//             (data.vendorPaidBank > 0
//               ? ` − vendors ${fmt(data.vendorPaidBank)}`
//               : '') +
//             (data.expenseBank > 0 ? ` − expenses ${fmt(data.expenseBank)}` : '')
//           : 'online sales') + ` · bank ${balWhen}: ${fmt(data.bankBalance)}`
//     },
//     {
//       key: 'creditGiven',
//       label: `Credit Given · ${rl}`,
//       value: data.creditGiven,
//       accent: 'amber',
//       // The credit bills of this range — not the lifetime "who owes money" list.
//       detail: 'credit'
//     },
//     // (Awaiting Payments card removed on the owner's request — Credit Given covers it. The
//     //  all-time receivables figure is still shown in the Receivables box further down.)
//     {
//       key: 'creditCollected',
//       label: `Credit / Payments · ${rl}`,
//       value: data.creditCollected,
//       accent: 'green',
//       detail: 'credit-collections'
//     }
//   ]

//   const toggleVisibility = (key) =>
//     setVisible((prev) => ({ ...prev, [key]: !prev[key] }))

//   return (
//     <div className="dashboard">
//       {/* Date range bar */}
//       <div className="report-bar" style={{ marginBottom: 4 }}>
//         <div className="rb-dates">
//           <label>
//             From{' '}
//             <input
//               type="date"
//               value={from}
//               onChange={(e) => setFrom(e.target.value)}
//             />
//           </label>
//           <label>
//             To{' '}
//             <input
//               type="date"
//               value={to}
//               onChange={(e) => setTo(e.target.value)}
//             />
//           </label>
//           {/* Shared presets — the active one is highlighted */}
//           <DatePresets
//             from={from}
//             to={to}
//             onChange={(r) => {
//               setFrom(r.from)
//               setTo(r.to)
//             }}
//           />
//         </div>
//       </div>

//       {overdue?.count > 0 && (
//         <div
//           className="lowstock-banner dash-lowstock dash-overdue"
//           role="alert"
//         >
//           <Icon name="alert" size={16} />
//           <span>
//             <strong>
//               {overdue.count} credit bill{overdue.count > 1 ? 's' : ''} overdue
//             </strong>{' '}
//             — {overdue.customers}{' '}
//             {overdue.customers > 1 ? 'customers have' : 'customer has'} passed
//             the promise-to-pay date · <strong>{fmt(overdue.total)}</strong>{' '}
//             still unpaid
//           </span>
//           <button
//             type="button"
//             className="btn-sm ghost"
//             style={{ marginLeft: 'auto' }}
//             onClick={() => setDetailType('overdues')}
//           >
//             View overdue →
//           </button>
//         </div>
//       )}

//       {lowItems.length > 0 && (
//         <div className="lowstock-banner dash-lowstock" role="alert">
//           <Icon name="alert" size={16} />
//           <span>
//             <strong>
//               {lowItems.length} item{lowItems.length > 1 ? 's' : ''} low on
//               stock:
//             </strong>{' '}
//             {lowItems
//               .slice(0, 3)
//               .map((i) => `${i.name} (${Number(i.current_stock)} left)`)
//               .join(', ')}
//             {lowItems.length > 3 ? ` +${lowItems.length - 3} more` : ''}
//           </span>
//           <button
//             type="button"
//             className="btn-sm ghost"
//             style={{ marginLeft: 'auto' }}
//             onClick={() => navigate('/low-stock')}
//           >
//             View Low Stock →
//           </button>
//         </div>
//       )}

//       <div className="stat-grid stat-grid-5">
//         {summaryCards.map((card) => {
//           const isHidden = !visible[card.key]
//           const displayValue = isHidden
//             ? 'Rs. •••••'
//             : card.key === 'creditCollected' && card.value === 0
//               ? 'NIL'
//               : fmt(card.value)

//           return (
//             <StatCard
//               key={card.key}
//               label={
//                 <div
//                   style={{
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'space-between',
//                     width: '100%'
//                   }}
//                 >
//                   <span>{card.label}</span>
//                   <button
//                     type="button"
//                     onClick={(e) => {
//                       e.stopPropagation()
//                       toggleVisibility(card.key)
//                     }}
//                     style={{
//                       background: 'none',
//                       border: 'none',
//                       cursor: 'pointer',
//                       padding: '2px',
//                       opacity: 0.7,
//                       transition: 'opacity 0.2s',
//                       display: 'flex',
//                       alignItems: 'center'
//                     }}
//                     onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
//                     onMouseLeave={(e) =>
//                       (e.currentTarget.style.opacity = '0.7')
//                     }
//                     aria-label={isHidden ? 'Show amount' : 'Hide amount'}
//                     title={isHidden ? 'Show amount' : 'Hide amount'}
//                   >
//                     <Icon name={isHidden ? 'eye-off' : 'eye'} size={16} />
//                   </button>
//                 </div>
//               }
//               value={displayValue}
//               hint={isHidden ? undefined : card.hint}
//               accent={card.accent}
//               onClick={() => setDetailType(card.detail)}
//             />
//           )
//         })}
//       </div>

//       <div className="quick-actions">
//         {quickActions.map((a) => (
//           <button
//             key={a.label}
//             className={`quick-btn accent-${a.accent}`}
//             onClick={() => navigate(a.to)}
//           >
//             <span className="quick-icon">
//               <Icon name={a.icon} size={22} />
//             </span>
//             {a.label}
//           </button>
//         ))}
//       </div>

//       {/* Night-time check: sales vs recoveries vs cash/bank/udhaar, fully broken down.
//           ✓/✗ compares its Closing Cash with the "Cash in Hand" card (data.cashBalance). */}
//       <ReconciliationWidget
//         from={from}
//         to={to}
//         cashBalance={data.cashBalance}
//         refreshKey={refreshKey}
//         hidden={!visible.reconciliation}
//         onToggleHidden={() => toggleVisibility('reconciliation')}
//       />

//       {/* ================================================================
//           The following 4 sections are hidden as requested by the owner:
//             • Cash Flow
//             • Receivables & Payables
//             • Top Items
//             • Top Customers
//           To bring them back, just un-comment the JSX below.
//       ================================================================= */}

//       {/*
//       <div className="dash-columns">
//         <section className="panel">
//           <div className="panel-head">
//             <h3>Cash Flow</h3>
//             <span className="muted-text" style={{ fontSize: 11 }}>
//               {from || '…'} → {to || '…'}
//             </span>
//           </div>
//           <div className="cashflow-grid">
//             <div className="cf-item">
//               <span>Opening Balance</span>
//               <strong>
//                 <AmountWithVisibility
//                   value={fmt(cashflow.opening)}
//                   visible={visible.openingBalance}
//                   onToggle={() => toggleVisibility('openingBalance')}
//                 />
//               </strong>
//             </div>
//             <div className="cf-item">
//               <span className="pos">Receipts</span>
//               <strong className="pos">
//                 <AmountWithVisibility
//                   value={fmt(cashflow.receipts)}
//                   visible={visible.receipts}
//                   onToggle={() => toggleVisibility('receipts')}
//                 />
//               </strong>
//             </div>
//             <div className="cf-item">
//               <span className="neg">Payments</span>
//               <strong className="neg">
//                 <AmountWithVisibility
//                   value={`(${fmt(cashflow.payments)})`}
//                   visible={visible.payments}
//                   onToggle={() => toggleVisibility('payments')}
//                   mask="(Rs. •••••)"
//                 />
//               </strong>
//             </div>
//             <div className="cf-item total">
//               <span>Closing Balance</span>
//               <strong>
//                 <AmountWithVisibility
//                   value={fmt(cashflow.closing)}
//                   visible={visible.closingBalance}
//                   onToggle={() => toggleVisibility('closingBalance')}
//                 />
//               </strong>
//             </div>
//           </div>
//         </section>

//         <section className="panel">
//           <div className="panel-head">
//             <h3>Receivables &amp; Payables</h3>
//           </div>
//           <div className="rp-grid">
//             <div className="rp-block">
//               <h4>Customers (Receivable)</h4>
//               <div className="rp-value amber">
//                 <AmountWithVisibility
//                   value={fmt(data.receivables)}
//                   visible={visible.receivables}
//                   onToggle={() => toggleVisibility('receivables')}
//                 />
//               </div>
//             </div>
//             <div className="rp-block">
//               <h4>Vendors (Payable)</h4>
//               <div className="rp-value rose">
//                 <AmountWithVisibility
//                   value={data.payables > 0 ? fmt(data.payables) : 'NIL'}
//                   visible={visible.payables}
//                   onToggle={() => toggleVisibility('payables')}
//                   mask="•••••"
//                 />
//               </div>
//             </div>
//           </div>
//         </section>
//       </div>

//       <div className="dash-columns">
//         <section className="panel">
//           <div className="panel-head">
//             <h3>Top Items</h3>
//           </div>
//           <table className="data-table">
//             <thead>
//               <tr>
//                 <th>Item</th>
//                 <th className="num">Qty</th>
//                 <th className="num">Amount</th>
//               </tr>
//             </thead>
//             <tbody>
//               {data.topItems.length === 0 ? (
//                 <tr>
//                   <td colSpan="3" className="empty">
//                     No sales in this range
//                   </td>
//                 </tr>
//               ) : (
//                 data.topItems.map((it, i) => (
//                   <tr key={i}>
//                     <td>{it.name}</td>
//                     <td className="num">
//                       {Number(it.qty).toLocaleString('en-PK')}
//                     </td>
//                     <td className="num">{fmt(it.amount)}</td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </section>

//         <section className="panel">
//           <div className="panel-head">
//             <h3>Top Customers</h3>
//           </div>
//           <table className="data-table">
//             <thead>
//               <tr>
//                 <th>Customer</th>
//                 <th className="num">Amount</th>
//               </tr>
//             </thead>
//             <tbody>
//               {data.topCustomers.length === 0 ? (
//                 <tr>
//                   <td colSpan="2" className="empty">
//                     No sales in this range
//                   </td>
//                 </tr>
//               ) : (
//                 data.topCustomers.map((c, i) => (
//                   <tr key={i}>
//                     <td>{c.name}</td>
//                     <td className="num">{fmt(c.amount)}</td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </section>
//       </div>
//       */}

//       {detailType && (
//         <DashboardDetailModal
//           type={detailType}
//           from={from}
//           to={to}
//           uid={session?.id}
//           onClose={() => setDetailType(null)}
//           onChanged={() => {
//             // an invoice was edited from a card → cards + reconciliation show the new totals
//             loadSummary()
//             setRefreshKey((k) => k + 1)
//           }}
//         />
//       )}

//       <div className="hotkey-hint">
//         <div className="hk-group">
//           <span className="hk-title">Range</span>
//           <span>
//             <kbd>Ctrl</kbd>+<kbd>T</kbd> Today
//           </span>
//           <span>
//             <kbd>Ctrl</kbd>+<kbd>W</kbd> Week
//           </span>
//           <span>
//             <kbd>Ctrl</kbd>+<kbd>M</kbd> Month
//           </span>
//           <span>
//             <kbd>Ctrl</kbd>+<kbd>L</kbd> All time
//           </span>
//         </div>
//         <div className="hk-group">
//           <span className="hk-title">Cards</span>
//           <span>
//             <kbd>Alt</kbd>+<kbd>1..5</kbd> Open detail
//           </span>
//           <span>
//             <kbd>Tab</kbd> / <kbd>Enter</kbd> Focused card
//           </span>
//         </div>
//         <div className="hk-group">
//           <span className="hk-title">General</span>
//           <span>
//             <kbd>F5</kbd> Refresh
//           </span>
//           <span>
//             <kbd>Esc</kbd> Close
//           </span>
//         </div>
//       </div>
//     </div>
//   )
// }

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, inventoryApi } from '../api/ipc.js'
import {
  STOCK_EVENT,
  getDismissedLowStock,
  dismissLowStockItem,
  cleanupDismissedLowStock,
  LOW_STOCK_DISMISS_EVENT
} from '../utils/lowStock.js'
import { useAuth } from '../context/AuthContext.jsx'
import StatCard from '../components/StatCard.jsx'
import Icon from '../components/Icons.jsx'
import DashboardDetailModal from '../components/DashboardDetailModal.jsx'
import ReconciliationWidget from '../components/ReconciliationWidget.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { rangeLabel } from '../utils/dateRanges.js'

const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK')

const todayStr = () => localToday()

// Reusable component for amount + eye toggle
function AmountWithVisibility({
  value,
  visible,
  onToggle,
  mask = 'Rs. •••••'
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span>{visible ? value : mask}</span>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          opacity: 0.7,
          transition: 'opacity 0.2s',
          display: 'inline-flex',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        aria-label={visible ? 'Hide amount' : 'Show amount'}
        title={visible ? 'Hide amount' : 'Show amount'}
      >
        <Icon name={visible ? 'eye' : 'eye-off'} size={16} />
      </button>
    </span>
  )
}

const quickActions = [
  { label: 'Add New Item', icon: 'plus', to: '/inventory', accent: 'indigo' },
  { label: 'Purchases', icon: 'truck', to: '/purchases', accent: 'amber' },
  { label: 'Counter Sale', icon: 'cart', to: '/sales', accent: 'green' },
  {
    label: 'Payment / Expense',
    icon: 'wallet',
    to: '/payments',
    accent: 'rose'
  },
  { label: 'Day Book', icon: 'book', to: '/reports/daybook', accent: 'sky' }
]

const defaultVisibility = {
  sales: true,
  cashBalance: true,
  bankBalance: true,
  creditGiven: true,
  creditCollected: true,
  openingBalance: true,
  receipts: true,
  payments: true,
  closingBalance: true,
  receivables: true,
  payables: true,
  reconciliation: true
}

function loadVisibility() {
  try {
    const saved = localStorage.getItem('dashboardAmountVisibility')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...defaultVisibility, ...parsed }
    }
  } catch {
    /* ignore */
  }
  return { ...defaultVisibility }
}

// Quick date presets
function todayRange() {
  return { from: todayStr(), to: todayStr() }
}
// function thisWeekRange() {
//   const now = new Date()
//   const day = now.getDay() // 0=Sun
//   const diff = day === 0 ? 6 : day - 1 // Monday start
//   const mon = new Date(now)
//   mon.setDate(now.getDate() - diff)
//   return { from: toLocalDateStr(mon), to: todayStr() }
// }
function thisWeekRange() {
  // Get the local date string (YYYY-MM-DD) to bypass timezone offset issues
  const today = todayStr()
  const parts = today.split('-')
  // Create a date object using purely local Y, M, D (Month is 0-indexed)
  const now = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))

  const day = now.getDay() // 0=Sun
  const diff = day === 0 ? 6 : day - 1 // Monday start
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)

  return { from: toLocalDateStr(mon), to: today }
}
function thisMonthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: toLocalDateStr(first), to: todayStr() }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [visible, setVisible] = useState(loadVisibility)
  const [detailType, setDetailType] = useState(null)
  // Bumped on F5 so the reconciliation widget reloads together with the stat cards.
  const [refreshKey, setRefreshKey] = useState(0)
  // Low-stock alert (same rule as the Low Stock page / sidebar badge)
  const [lowItems, setLowItems] = useState([])

  const loadLow = useCallback(() => {
    inventoryApi.items
      .lowStock()
      .then((items) => {
        cleanupDismissedLowStock(items) // Clear dismissed IDs if stock was replenished
        const dismissed = getDismissedLowStock()
        setLowItems(items.filter((i) => !dismissed.includes(i.id)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadLow()
    window.addEventListener(STOCK_EVENT, loadLow)
    window.addEventListener(LOW_STOCK_DISMISS_EVENT, loadLow) // Listen for dismissals
    return () => {
      window.removeEventListener(STOCK_EVENT, loadLow)
      window.removeEventListener(LOW_STOCK_DISMISS_EVENT, loadLow)
    }
  }, [loadLow, refreshKey])

  // Overdue alert: credit bills whose promise-to-pay date has passed and are still unpaid
  const [overdue, setOverdue] = useState(null)
  useEffect(() => {
    dashboardApi
      .overdueSummary()
      .then(setOverdue)
      .catch(() => {})
  }, [refreshKey])

  useEffect(() => {
    try {
      localStorage.setItem('dashboardAmountVisibility', JSON.stringify(visible))
    } catch {
      /* ignore */
    }
  }, [visible])

  const loadSummary = useCallback(async () => {
    try {
      setError('')
      const d = await dashboardApi.getSummary({ from, to })
      setData(d)
    } catch (e) {
      setError(e.message)
    }
  }, [from, to])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const setRange = (r) => {
    setFrom(r.from)
    setTo(r.to)
  }

  useHotkeys(
    {
      f5: () => {
        loadSummary()
        setRefreshKey((k) => k + 1)
      },
      t: () => setRange(todayRange()),
      w: () => setRange(thisWeekRange()),
      m: () => setRange(thisMonthRange()),
      l: () => setRange({ from: '', to: '' }),
      'alt+1': () => setDetailType('sales'),
      'alt+2': () => setDetailType('cash'),
      'alt+3': () => setDetailType('online'),
      'alt+4': () => setDetailType('credit'), // matches the Credit Given card (was receivables)
      'alt+5': () => setDetailType('credit-collections'), // 5th card (Awaiting Payments removed)
      escape: () => setDetailType(null)
    },
    [from, to]
  )

  if (error) return <div className="panel error-panel">Error: {error}</div>
  if (!data) return <div className="panel">Loading dashboard…</div>

  // Each card says WHAT period it shows. Sales / Credit Given / Credit-Payments follow the
  // selected range; Cash & Bank are balances at the END of the range. Before, they looked the
  // same whatever you picked,
  // and one card always said "Today's" — so the filters seemed not to work.
  const rl = rangeLabel(from, to)
  // Drawer / bank balance at the END of the range (Today/Week/Month/All Time all end today).
  const balWhen = to && to !== todayStr() ? `on ${to}` : 'now'
  const summaryCards = [
    {
      key: 'sales',
      label: `Sales · ${rl}`,
      // Client's rule: Sales card = sales (net of returns) − money paid to vendors in the range.
      value: data.salesCard ?? data.sales,
      accent: 'indigo',
      detail: 'sales',
      hint:
        data.salesReturns > 0 || data.vendorPaid > 0
          ? `Gross ${fmt(data.grossSales)}` +
            (data.salesReturns > 0
              ? ` − Returns ${fmt(data.salesReturns)}`
              : '') +
            (data.vendorPaid > 0 ? ` − Vendors ${fmt(data.vendorPaid)}` : '')
          : undefined
    },

    // Client's rule: Cash in Hand = CASH SALES of the selected dates (Today → today's cash
    // sales, 29→29 → only the 29th, This Month → the month's total); clicking lists those
    // receipts. The drawer balance (needed for the night-time counter check) is the small line.
    {
      key: 'cashBalance',
      label: `Cash in Hand · ${rl}`,
      value: data.cashCard ?? data.cashSales,
      accent: 'green',
      detail: 'cash',
      hint: (
        <>
          {data.vendorPaidCash > 0 ||
          data.refundCash > 0 ||
          data.expenseCash > 0
            ? `sales ${fmt(data.cashSales)}` +
              (data.refundCash > 0
                ? ` − refunds ${fmt(data.refundCash)}`
                : '') +
              (data.vendorPaidCash > 0
                ? ` − vendors ${fmt(data.vendorPaidCash)}`
                : '') +
              (data.expenseCash > 0
                ? ` − expenses ${fmt(data.expenseCash)}`
                : '')
            : `sales ${fmt(data.cashSales)}`}
          <br />
          <span style={{ opacity: 0.8 }}>
            Drawer {balWhen}: {fmt(data.cashBalance)} (includes carry-forward)
          </span>
        </>
      )
    },
    {
      key: 'bankBalance',
      label: `Bank / Online · ${rl}`,
      value: data.bankCard ?? data.onlineSales, // online sales − paid to vendors online
      accent: 'indigo',
      detail: 'online',
      hint:
        (data.vendorPaidBank > 0 || data.refundBank > 0 || data.expenseBank > 0
          ? `sales ${fmt(data.onlineSales)}` +
            (data.refundBank > 0 ? ` − refunds ${fmt(data.refundBank)}` : '') +
            (data.vendorPaidBank > 0
              ? ` − vendors ${fmt(data.vendorPaidBank)}`
              : '') +
            (data.expenseBank > 0 ? ` − expenses ${fmt(data.expenseBank)}` : '')
          : 'online sales') + ` · bank ${balWhen}: ${fmt(data.bankBalance)}`
    },
    {
      key: 'creditGiven',
      label: `Credit Given · ${rl}`,
      value: data.creditGiven,
      accent: 'amber',
      // The credit bills of this range — not the lifetime "who owes money" list.
      detail: 'credit'
    },
    // (Awaiting Payments card removed on the owner's request — Credit Given covers it. The
    //  all-time receivables figure is still shown in the Receivables box further down.)
    {
      key: 'creditCollected',
      label: `Credit / Payments · ${rl}`,
      value: data.creditCollected,
      accent: 'green',
      detail: 'credit-collections'
    }
  ]

  const toggleVisibility = (key) =>
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="dashboard">
      {/* Date range bar */}
      <div className="report-bar" style={{ marginBottom: 4 }}>
        <div className="rb-dates">
          <label>
            From{' '}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To{' '}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {/* Shared presets — the active one is highlighted */}
          <DatePresets
            from={from}
            to={to}
            onChange={(r) => {
              setFrom(r.from)
              setTo(r.to)
            }}
          />
        </div>
      </div>

      {overdue?.count > 0 && (
        <div
          className="lowstock-banner dash-lowstock dash-overdue"
          role="alert"
        >
          <Icon name="alert" size={16} />
          <span>
            <strong>
              {overdue.count} credit bill{overdue.count > 1 ? 's' : ''} overdue
            </strong>{' '}
            — {overdue.customers}{' '}
            {overdue.customers > 1 ? 'customers have' : 'customer has'} passed
            the promise-to-pay date · <strong>{fmt(overdue.total)}</strong>{' '}
            still unpaid
          </span>
          <button
            type="button"
            className="btn-sm ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => setDetailType('overdues')}
          >
            View overdue →
          </button>
        </div>
      )}

      {lowItems.length > 0 && (
        <div className="lowstock-banner dash-lowstock" role="alert">
          <Icon name="alert" size={16} />
          <span
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <strong>
              {lowItems.length} item{lowItems.length > 1 ? 's' : ''} low on
              stock:
            </strong>
            {lowItems.slice(0, 3).map((i) => (
              <span
                key={i.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                {i.name} ({Number(i.current_stock)} left)
                <button
                  type="button"
                  className="btn-icon"
                  style={{ marginLeft: '4px', padding: '2px', opacity: 0.7 }}
                  title="Dismiss this alert"
                  onClick={() => {
                    dismissLowStockItem(i.id)
                    setLowItems((prev) => prev.filter((x) => x.id !== i.id))
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
            {lowItems.length > 3 && <span>+{lowItems.length - 3} more</span>}
          </span>
          <button
            type="button"
            className="btn-sm ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => navigate('/low-stock')}
          >
            View Low Stock →
          </button>
        </div>
      )}

      <div className="stat-grid stat-grid-5">
        {summaryCards.map((card) => {
          const isHidden = !visible[card.key]
          const displayValue = isHidden
            ? 'Rs. •••••'
            : card.key === 'creditCollected' && card.value === 0
              ? 'NIL'
              : fmt(card.value)

          return (
            <StatCard
              key={card.key}
              label={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                  }}
                >
                  <span>{card.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleVisibility(card.key)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      opacity: 0.7,
                      transition: 'opacity 0.2s',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = '0.7')
                    }
                    aria-label={isHidden ? 'Show amount' : 'Hide amount'}
                    title={isHidden ? 'Show amount' : 'Hide amount'}
                  >
                    <Icon name={isHidden ? 'eye-off' : 'eye'} size={16} />
                  </button>
                </div>
              }
              value={displayValue}
              hint={isHidden ? undefined : card.hint}
              accent={card.accent}
              onClick={() => setDetailType(card.detail)}
            />
          )
        })}
      </div>

      <div className="quick-actions">
        {quickActions.map((a) => (
          <button
            key={a.label}
            className={`quick-btn accent-${a.accent}`}
            onClick={() => navigate(a.to)}
          >
            <span className="quick-icon">
              <Icon name={a.icon} size={22} />
            </span>
            {a.label}
          </button>
        ))}
      </div>

      {/* Night-time check: sales vs recoveries vs cash/bank/udhaar, fully broken down.
          ✓/✗ compares its Closing Cash with the "Cash in Hand" card (data.cashBalance). */}
      <ReconciliationWidget
        from={from}
        to={to}
        cashBalance={data.cashBalance}
        refreshKey={refreshKey}
        hidden={!visible.reconciliation}
        onToggleHidden={() => toggleVisibility('reconciliation')}
      />

      {/* ================================================================
          The following 4 sections are hidden as requested by the owner:
            • Cash Flow
            • Receivables & Payables
            • Top Items
            • Top Customers
          To bring them back, just un-comment the JSX below.
      ================================================================= */}

      {/*
      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head">
            <h3>Cash Flow</h3>
            <span className="muted-text" style={{ fontSize: 11 }}>
              {from || '…'} → {to || '…'}
            </span>
          </div>
          <div className="cashflow-grid">
            <div className="cf-item">
              <span>Opening Balance</span>
              <strong>
                <AmountWithVisibility
                  value={fmt(cashflow.opening)}
                  visible={visible.openingBalance}
                  onToggle={() => toggleVisibility('openingBalance')}
                />
              </strong>
            </div>
            <div className="cf-item">
              <span className="pos">Receipts</span>
              <strong className="pos">
                <AmountWithVisibility
                  value={fmt(cashflow.receipts)}
                  visible={visible.receipts}
                  onToggle={() => toggleVisibility('receipts')}
                />
              </strong>
            </div>
            <div className="cf-item">
              <span className="neg">Payments</span>
              <strong className="neg">
                <AmountWithVisibility
                  value={`(${fmt(cashflow.payments)})`}
                  visible={visible.payments}
                  onToggle={() => toggleVisibility('payments')}
                  mask="(Rs. •••••)"
                />
              </strong>
            </div>
            <div className="cf-item total">
              <span>Closing Balance</span>
              <strong>
                <AmountWithVisibility
                  value={fmt(cashflow.closing)}
                  visible={visible.closingBalance}
                  onToggle={() => toggleVisibility('closingBalance')}
                />
              </strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Receivables &amp; Payables</h3>
          </div>
          <div className="rp-grid">
            <div className="rp-block">
              <h4>Customers (Receivable)</h4>
              <div className="rp-value amber">
                <AmountWithVisibility
                  value={fmt(data.receivables)}
                  visible={visible.receivables}
                  onToggle={() => toggleVisibility('receivables')}
                />
              </div>
            </div>
            <div className="rp-block">
              <h4>Vendors (Payable)</h4>
              <div className="rp-value rose">
                <AmountWithVisibility
                  value={data.payables > 0 ? fmt(data.payables) : 'NIL'}
                  visible={visible.payables}
                  onToggle={() => toggleVisibility('payables')}
                  mask="•••••"
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head">
            <h3>Top Items</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.topItems.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty">
                    No sales in this range
                  </td>
                </tr>
              ) : (
                data.topItems.map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td>
                    <td className="num">
                      {Number(it.qty).toLocaleString('en-PK')}
                    </td>
                    <td className="num">{fmt(it.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Top Customers</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.topCustomers.length === 0 ? (
                <tr>
                  <td colSpan="2" className="empty">
                    No sales in this range
                  </td>
                </tr>
              ) : (
                data.topCustomers.map((c, i) => (
                  <tr key={i}>
                    <td>{c.name}</td>
                    <td className="num">{fmt(c.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
      */}

      {detailType && (
        <DashboardDetailModal
          type={detailType}
          from={from}
          to={to}
          uid={session?.id}
          onClose={() => setDetailType(null)}
          onChanged={() => {
            // an invoice was edited from a card → cards + reconciliation show the new totals
            loadSummary()
            setRefreshKey((k) => k + 1)
          }}
        />
      )}

      <div className="hotkey-hint">
        <div className="hk-group">
          <span className="hk-title">Range</span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>T</kbd> Today
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>W</kbd> Week
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>M</kbd> Month
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>L</kbd> All time
          </span>
        </div>
        <div className="hk-group">
          <span className="hk-title">Cards</span>
          <span>
            <kbd>Alt</kbd>+<kbd>1..5</kbd> Open detail
          </span>
          <span>
            <kbd>Tab</kbd> / <kbd>Enter</kbd> Focused card
          </span>
        </div>
        <div className="hk-group">
          <span className="hk-title">General</span>
          <span>
            <kbd>F5</kbd> Refresh
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}
