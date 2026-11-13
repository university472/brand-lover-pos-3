// import { useEffect, useState, useCallback, useRef } from 'react'
// import { reportsApi } from '../api/ipc.js'
// import { useAuth } from '../context/AuthContext.jsx'
// import Icon from '../components/Icons.jsx'
// import Modal from '../components/Modal.jsx'
// import ReportTabs from '../components/ReportTabs.jsx'
// import DatePresets from '../components/DatePresets.jsx'
// import { useHotkeys } from '../hooks/useHotkeys.js'
// import { printNow } from '../utils/print.js'
// import { localToday, toLocalDateStr } from '../utils/date.js'

// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
// const fmt2 = (n) =>
//   'Rs. ' +
//   Number(n || 0).toLocaleString('en-PK', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2
//   })

// export default function ProfitLossReport() {
//   const { session } = useAuth()
//   const uid = session.id
//   const ms = new Date()
//   ms.setDate(1)

//   const [from, setFrom] = useState(toLocalDateStr(ms))
//   const [to, setTo] = useState(localToday())
//   const [search, setSearch] = useState('')
//   const [data, setData] = useState({ rows: [], totals: null })
//   const [error, setError] = useState('')
//   const [notice, setNotice] = useState('')
//   const [busy, setBusy] = useState(false)
//   const [detail, setDetail] = useState(null)

//   const searchRef = useRef(null)
//   const fromRef = useRef(null)
//   const toRef = useRef(null)

//   const load = useCallback(async () => {
//     setError('')
//     try {
//       setData(
//         await reportsApi.profitLoss({ actingUserId: uid, from, to, search })
//       )
//     } catch (e) {
//       setError(e.message)
//     }
//   }, [uid, from, to, search])
//   useEffect(() => {
//     load()
//   }, [load])

//   const openDetail = async (row) => {
//     setError('')
//     try {
//       setDetail(
//         await reportsApi.profitLossDetail({
//           actingUserId: uid,
//           itemId: row.id,
//           from,
//           to
//         })
//       )
//     } catch (e) {
//       setError(e.message)
//     }
//   }

//   const exportXlsx = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const r = await reportsApi.exportReport({
//         actingUserId: uid,
//         reportType: 'profitLoss',
//         from,
//         to,
//         search
//       })
//       if (!r.canceled) {
//         setNotice(`Exported ${r.count} rows.`)
//         setTimeout(() => setNotice(''), 4000)
//       }
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   useHotkeys(
//     {
//       f2: () => searchRef.current?.focus(),
//       f5: () => {
//         if (!busy) load()
//       },
//       f9: () => printNow(),
//       e: () => {
//         if (!busy) exportXlsx()
//       },
//       p: () => printNow(),
//       'alt+1': () => fromRef.current?.focus(),
//       'alt+2': () => toRef.current?.focus(),
//       escape: () => {
//         if (detail) setDetail(null)
//       }
//     },
//     [busy, from, to, search, detail]
//   )

//   const t = data.totals

//   return (
//     <div className="report-page">
//       <ReportTabs />
//       <div className="report-bar">
//         <div className="rb-dates">
//           <label>
//             From{' '}
//             <input
//               ref={fromRef}
//               type="date"
//               value={from}
//               onChange={(e) => setFrom(e.target.value)}
//             />
//           </label>
//           <label>
//             To{' '}
//             <input
//               ref={toRef}
//               type="date"
//               value={to}
//               onChange={(e) => setTo(e.target.value)}
//             />
//           </label>
//           <DatePresets
//             from={from}
//             to={to}
//             onChange={(r) => {
//               setFrom(r.from)
//               setTo(r.to)
//             }}
//           />
//         </div>
//         <div className="rb-actions">
//           <div className="search-box">
//             <Icon name="search" size={15} />
//             <input
//               ref={searchRef}
//               placeholder="Search item name / code  (F2)"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>
//           <button
//             className="btn-sm primary"
//             onClick={exportXlsx}
//             disabled={busy}
//             title="Export Excel (Ctrl+E)"
//           >
//             <Icon name="download" size={15} /> Export
//           </button>
//         </div>
//       </div>

//       {notice && <div className="inv-notice">{notice}</div>}
//       {error && (
//         <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
//           {error}
//         </div>
//       )}

//       <div className="report-cards">
//         <div className="rc-card">
//           <span>Products</span>
//           <strong>{t?.items || 0}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Units Sold</span>
//           <strong>{Number(t?.qty || 0).toLocaleString('en-PK')}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Revenue</span>
//           <strong>{fmt(t?.revenue)}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Cost of Goods</span>
//           <strong>{fmt(t?.cost)}</strong>
//         </div>
//         <div className={'rc-card ' + (Number(t?.profit) >= 0 ? '' : 'amber')}>
//           <span>{Number(t?.profit) >= 0 ? 'Profit' : 'Loss'}</span>
//           <strong className={Number(t?.profit) >= 0 ? 'pos' : 'neg'}>
//             {fmt(t?.profit)}
//           </strong>
//           {t?.margin != null && (
//             <em style={{ fontSize: 11, color: 'var(--muted)' }}>
//               {t.margin}% margin
//             </em>
//           )}
//         </div>
//       </div>

//       <p className="muted-text" style={{ fontSize: 12, margin: '0 0 8px' }}>
//         Revenue is net of line discounts. Returns in this period reduce both
//         revenue and cost (goods are restocked). Cost uses the weighted-average
//         cost captured at the time of each sale.
//       </p>

//       <div className="panel report-table-wrap">
//         <div className="table-scroll">
//           <table className="data-table">
//             <thead>
//               <tr>
//                 <th>Code</th>
//                 <th>Item</th>
//                 <th>Size</th>
//                 <th>Category</th>
//                 <th className="num">Qty Sold</th>
//                 <th className="num">Returned</th>
//                 <th className="num">Revenue</th>
//                 <th className="num">Cost</th>
//                 <th className="num">Profit / Loss</th>
//                 <th className="num">Margin</th>
//                 <th></th>
//               </tr>
//             </thead>
//             <tbody>
//               {data.rows.length === 0 ? (
//                 <tr>
//                   <td colSpan="11" className="empty">
//                     No sales in this period
//                   </td>
//                 </tr>
//               ) : (
//                 data.rows.map((r) => (
//                   <tr
//                     key={r.id}
//                     className="clickable"
//                     onClick={() => openDetail(r)}
//                   >
//                     <td>{r.item_code}</td>
//                     <td>{r.name}</td>
//                     <td>{r.size || '—'}</td>
//                     <td>{r.category || '—'}</td>
//                     <td className="num">
//                       {Number(r.qty_sold).toLocaleString('en-PK')}
//                     </td>
//                     <td className={'num' + (r.qty_returned > 0 ? ' neg' : '')}>
//                       {r.qty_returned > 0
//                         ? `(${Number(r.qty_returned).toLocaleString('en-PK')})`
//                         : '—'}
//                     </td>
//                     <td className="num">{fmt(r.revenue)}</td>
//                     <td className="num">{fmt(r.cost)}</td>
//                     <td
//                       className={
//                         'num strong ' + (r.profit >= 0 ? 'pos' : 'neg')
//                       }
//                     >
//                       {fmt(r.profit)}
//                     </td>
//                     <td className={'num ' + (r.profit >= 0 ? 'pos' : 'neg')}>
//                       {r.margin}%
//                     </td>
//                     <td className="num">
//                       <Icon name="chart" size={14} />
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       <div className="hotkey-hint">
//         <span>
//           <kbd>F2</kbd> Search
//         </span>
//         <span>
//           <kbd>F5</kbd> Refresh
//         </span>
//         <span>
//           <kbd>F9</kbd> Print
//         </span>
//         <span>
//           <kbd>Ctrl</kbd>+<kbd>E</kbd> Export
//         </span>
//         <span>
//           <kbd>Alt</kbd>+<kbd>1/2</kbd> Date focus
//         </span>
//         <span>
//           <kbd>Esc</kbd> Close
//         </span>
//       </div>

//       {detail && (
//         <Modal
//           title={`Profit Detail — ${detail.item.name}`}
//           width={900}
//           onClose={() => setDetail(null)}
//           footer={
//             <button className="btn-primary" onClick={() => setDetail(null)}>
//               Close
//             </button>
//           }
//         >
//           <div
//             className="rd-balance"
//             style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}
//           >
//             <span>
//               Code: <strong>{detail.item.item_code}</strong>
//             </span>
//             <span>
//               Selling price: <strong>{fmt2(detail.item.selling_price)}</strong>
//             </span>
//             <span>
//               Avg cost now: <strong>{fmt2(detail.item.average_cost)}</strong>
//             </span>
//             <span>
//               Stock now:{' '}
//               <strong>
//                 {Number(detail.item.current_stock).toLocaleString('en-PK')}
//               </strong>
//             </span>
//           </div>

//           <h4 className="cd-sub">Sales ({detail.sales.length})</h4>
//           <div className="rd-scroll">
//             <table className="data-table">
//               <thead>
//                 <tr>
//                   <th>Date</th>
//                   <th>Invoice</th>
//                   <th>Customer</th>
//                   <th>Type</th>
//                   <th className="num">Qty</th>
//                   <th className="num">Rate</th>
//                   <th className="num">Disc</th>
//                   <th className="num">Net</th>
//                   <th className="num">Cost</th>
//                   <th className="num">Profit</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {detail.sales.length === 0 ? (
//                   <tr>
//                     <td colSpan="10" className="empty">
//                       No sales in range
//                     </td>
//                   </tr>
//                 ) : (
//                   detail.sales.map((s, i) => (
//                     <tr key={`s-${s.sale_id}-${i}`}>
//                       <td>
//                         {s.invoice_date}
//                         {s.invoice_time
//                           ? ' ' + String(s.invoice_time).slice(0, 5)
//                           : ''}
//                       </td>
//                       <td>#{s.invoice_no}</td>
//                       <td>
//                         {s.customer}
//                         {s.customer_code ? ` (${s.customer_code})` : ''}
//                       </td>
//                       <td>
//                         <span
//                           className="po-badge received"
//                           style={{ textTransform: 'capitalize' }}
//                         >
//                           {s.payment_type}
//                         </span>
//                       </td>
//                       <td className="num">{s.quantity}</td>
//                       <td className="num">{fmt2(s.rate)}</td>
//                       <td className="num">
//                         {Number(s.discount_amount) > 0
//                           ? '-' + fmt2(s.discount_amount)
//                           : '—'}
//                       </td>
//                       <td className="num">{fmt2(s.net_amount)}</td>
//                       <td className="num">{fmt2(s.cost)}</td>
//                       <td
//                         className={
//                           'num strong ' + (s.profit >= 0 ? 'pos' : 'neg')
//                         }
//                       >
//                         {fmt2(s.profit)}
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>

//           <h4 className="cd-sub">Returns ({detail.returns.length})</h4>
//           <div className="rd-scroll short">
//             <table className="data-table">
//               <thead>
//                 <tr>
//                   <th>Date</th>
//                   <th>Return #</th>
//                   <th>Original inv.</th>
//                   <th>Customer</th>
//                   <th>Refund</th>
//                   <th className="num">Qty</th>
//                   <th className="num">Rate</th>
//                   <th className="num">Amount</th>
//                   <th className="num">Cost</th>
//                   <th className="num">Profit impact</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {detail.returns.length === 0 ? (
//                   <tr>
//                     <td colSpan="10" className="empty">
//                       No returns in range
//                     </td>
//                   </tr>
//                 ) : (
//                   detail.returns.map((r) => (
//                     <tr key={r.return_id}>
//                       <td>{r.return_date}</td>
//                       <td>{r.return_no}</td>
//                       <td>#{r.original_invoice}</td>
//                       <td>
//                         {r.customer}
//                         {r.customer_code ? ` (${r.customer_code})` : ''}
//                       </td>
//                       <td>{r.refund_mode}</td>
//                       <td className="num">{r.quantity}</td>
//                       <td className="num">{fmt2(r.rate)}</td>
//                       <td className="num neg">-{fmt2(r.amount)}</td>
//                       <td className="num neg">-{fmt2(r.cost)}</td>
//                       <td
//                         className={
//                           'num strong ' + (r.profit_impact >= 0 ? 'pos' : 'neg')
//                         }
//                       >
//                         {fmt2(r.profit_impact)}
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </Modal>
//       )}
//     </div>
//   )
// }

import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import DatePresets from '../components/DatePresets.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'
import { localToday, toLocalDateStr } from '../utils/date.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
const fmt2 = (n) =>
  'Rs. ' +
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export default function ProfitLossReport() {
  const { session } = useAuth()
  const uid = session.id
  const ms = new Date()
  ms.setDate(1)

  const [from, setFrom] = useState(toLocalDateStr(ms))
  const [to, setTo] = useState(localToday())
  const [search, setSearch] = useState('')
  const [data, setData] = useState({ rows: [], totals: null })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState(null)

  const searchRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setData(
        await reportsApi.profitLoss({ actingUserId: uid, from, to, search })
      )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to, search])
  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (row) => {
    setError('')
    try {
      setDetail(
        await reportsApi.profitLossDetail({
          actingUserId: uid,
          itemId: row.id,
          from,
          to
        })
      )
    } catch (e) {
      setError(e.message)
    }
  }

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await reportsApi.exportReport({
        actingUserId: uid,
        reportType: 'profitLoss',
        from,
        to,
        search
      })
      if (!r.canceled) {
        setNotice(`Exported ${r.count} rows.`)
        setTimeout(() => setNotice(''), 4000)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f5: () => {
        if (!busy) load()
      },
      f9: () => printNow(),
      e: () => {
        if (!busy) exportXlsx()
      },
      p: () => printNow(),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus(),
      escape: () => {
        if (detail) setDetail(null)
      }
    },
    [busy, from, to, search, detail]
  )

  const t = data.totals

  return (
    <div className="report-page pl-report-page">
      <ReportTabs />
      <div className="report-bar">
        <div className="rb-dates">
          <label>
            From{' '}
            <input
              ref={fromRef}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To{' '}
            <input
              ref={toRef}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <DatePresets
            from={from}
            to={to}
            onChange={(r) => {
              setFrom(r.from)
              setTo(r.to)
            }}
          />
        </div>
        <div className="rb-actions">
          <div className="search-box">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder="Search item name / code  (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn-sm primary"
            onClick={exportXlsx}
            disabled={busy}
            title="Export Excel (Ctrl+E)"
          >
            <Icon name="download" size={15} /> Export
          </button>
        </div>
      </div>

      {notice && <div className="inv-notice">{notice}</div>}
      {error && (
        <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      <div className="report-cards">
        <div className="rc-card">
          <span>Products</span>
          <strong>{t?.items || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Units Sold</span>
          <strong>{Number(t?.qty || 0).toLocaleString('en-PK')}</strong>
        </div>
        <div className="rc-card">
          <span>Revenue</span>
          <strong>{fmt(t?.revenue)}</strong>
        </div>
        <div className="rc-card">
          <span>Cost of Goods</span>
          <strong>{fmt(t?.cost)}</strong>
        </div>
        <div className={'rc-card ' + (Number(t?.profit) >= 0 ? '' : 'amber')}>
          <span>{Number(t?.profit) >= 0 ? 'Gross Profit' : 'Gross Loss'}</span>
          <strong className={Number(t?.profit) >= 0 ? 'pos' : 'neg'}>
            {fmt(t?.profit)}
          </strong>
          {t?.margin != null && (
            <em style={{ fontSize: 11, color: 'var(--muted)' }}>
              {t.margin}% margin
            </em>
          )}
        </div>
      </div>

      <div className="panel report-table-wrap pl-table-wrap">
        <div
          className="pl-count"
          title="Revenue is net of line discounts. Returns reduce both revenue and cost. Cost uses weighted-average cost captured at time of sale."
        >
          <span>
            <strong>{data.rows.length}</strong> product
            {data.rows.length === 1 ? '' : 's'} ·{' '}
            <strong className={Number(t?.profit) >= 0 ? 'pos' : 'neg'}>
              {fmt(t?.profit)}
            </strong>{' '}
            {Number(t?.profit) >= 0 ? 'profit' : 'loss'}
          </span>
          {busy && <span className="muted-text">Working…</span>}
        </div>
        <div className="table-scroll">
          <table className="data-table pl-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Size</th>
                <th>Category</th>
                <th className="num">Qty Sold</th>
                <th className="num">Returned</th>
                <th className="num">Revenue</th>
                <th className="num">Cost</th>
                <th className="num">Profit / Loss</th>
                <th className="num">Margin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="11" className="empty">
                    No sales in this period
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => openDetail(r)}
                  >
                    <td>{r.item_code}</td>
                    <td>{r.name}</td>
                    <td>{r.size || '—'}</td>
                    <td>{r.category || '—'}</td>
                    <td className="num">
                      {Number(r.qty_sold).toLocaleString('en-PK')}
                    </td>
                    <td className={'num' + (r.qty_returned > 0 ? ' neg' : '')}>
                      {r.qty_returned > 0
                        ? `(${Number(r.qty_returned).toLocaleString('en-PK')})`
                        : '—'}
                    </td>
                    <td className="num">{fmt(r.revenue)}</td>
                    <td className="num">{fmt(r.cost)}</td>
                    <td
                      className={
                        'num strong ' + (r.profit >= 0 ? 'pos' : 'neg')
                      }
                    >
                      {fmt(r.profit)}
                      {r.cost === 0 && (
                        <span
                          className="muted-text"
                          style={{ display: 'block', fontSize: 10 }}
                          title="No cost recorded for this item at time of sale"
                        >
                          (Cost 0 - Check)
                        </span>
                      )}
                    </td>
                    <td className={'num ' + (r.profit >= 0 ? 'pos' : 'neg')}>
                      {r.margin}%
                    </td>
                    <td className="num">
                      <Icon name="chart" size={14} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hotkey-hint">
        <span>
          <kbd>F2</kbd> Search
        </span>
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>F9</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>E</kbd> Export
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1/2</kbd> Date focus
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>

      {detail && (
        <Modal
          title={`Profit Detail — ${detail.item.name}`}
          width={900}
          onClose={() => setDetail(null)}
          footer={
            <button className="btn-primary" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          <div
            className="rd-balance"
            style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}
          >
            <span>
              Code: <strong>{detail.item.item_code}</strong>
            </span>
            <span>
              Selling price: <strong>{fmt2(detail.item.selling_price)}</strong>
            </span>
            <span>
              Avg cost now: <strong>{fmt2(detail.item.average_cost)}</strong>
            </span>
            <span>
              Stock now:{' '}
              <strong>
                {Number(detail.item.current_stock).toLocaleString('en-PK')}
              </strong>
            </span>
          </div>

          <h4 className="cd-sub">Sales ({detail.sales.length})</h4>
          <div className="rd-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Disc</th>
                  <th className="num">Net</th>
                  <th className="num">Cost</th>
                  <th className="num">Profit</th>
                </tr>
              </thead>
              <tbody>
                {detail.sales.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="empty">
                      No sales in range
                    </td>
                  </tr>
                ) : (
                  detail.sales.map((s, i) => (
                    <tr key={`s-${s.sale_id}-${i}`}>
                      <td>
                        {s.invoice_date}
                        {s.invoice_time
                          ? ' ' + String(s.invoice_time).slice(0, 5)
                          : ''}
                      </td>
                      <td>#{s.invoice_no}</td>
                      <td>
                        {s.customer}
                        {s.customer_code ? ` (${s.customer_code})` : ''}
                      </td>
                      <td>
                        <span
                          className="po-badge received"
                          style={{ textTransform: 'capitalize' }}
                        >
                          {s.payment_type}
                        </span>
                      </td>
                      <td className="num">{s.quantity}</td>
                      <td className="num">{fmt2(s.rate)}</td>
                      <td className="num">
                        {Number(s.discount_amount) > 0
                          ? '-' + fmt2(s.discount_amount)
                          : '—'}
                      </td>
                      <td className="num">{fmt2(s.net_amount)}</td>
                      <td className="num">{fmt2(s.cost)}</td>
                      <td
                        className={
                          'num strong ' + (s.profit >= 0 ? 'pos' : 'neg')
                        }
                      >
                        {fmt2(s.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h4 className="cd-sub">Returns ({detail.returns.length})</h4>
          <div className="rd-scroll short">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Return #</th>
                  <th>Original inv.</th>
                  <th>Customer</th>
                  <th>Refund</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  <th className="num">Cost</th>
                  <th className="num">Profit impact</th>
                </tr>
              </thead>
              <tbody>
                {detail.returns.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="empty">
                      No returns in range
                    </td>
                  </tr>
                ) : (
                  detail.returns.map((r) => (
                    <tr key={r.return_id}>
                      <td>{r.return_date}</td>
                      <td>{r.return_no}</td>
                      <td>#{r.original_invoice}</td>
                      <td>
                        {r.customer}
                        {r.customer_code ? ` (${r.customer_code})` : ''}
                      </td>
                      <td>{r.refund_mode}</td>
                      <td className="num">{r.quantity}</td>
                      <td className="num">{fmt2(r.rate)}</td>
                      <td className="num neg">-{fmt2(r.amount)}</td>
                      <td className="num neg">-{fmt2(r.cost)}</td>
                      <td
                        className={
                          'num strong ' + (r.profit_impact >= 0 ? 'pos' : 'neg')
                        }
                      >
                        {fmt2(r.profit_impact)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  )
}
