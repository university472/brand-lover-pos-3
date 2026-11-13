// import { useEffect, useState, useCallback, useRef } from 'react'
// import { reportsApi } from '../api/ipc.js'
// import { useAuth } from '../context/AuthContext.jsx'
// import Icon from '../components/Icons.jsx'
// import ReportTabs from '../components/ReportTabs.jsx'
// import { useHotkeys } from '../hooks/useHotkeys.js' // 📍 PIN
// import { printNow } from '../utils/print.js'

// import { localToday, toLocalDateStr } from '../utils/date.js'
// import DatePresets from '../components/DatePresets.jsx'
// import { presetRange } from '../utils/dateRanges.js'
// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
// const STATUS = {
//   ordered: 'Ordered',
//   received: 'Received',
//   draft: 'Draft',
//   cancelled: 'Cancelled'
// }

// export default function PurchaseReport() {
//   const { session } = useAuth()
//   const uid = session.id
//   const ms = new Date()
//   ms.setDate(1)
//   const [from, setFrom] = useState(toLocalDateStr(ms))
//   const [to, setTo] = useState(localToday())
//   const [data, setData] = useState({ rows: [], totals: null })
//   const [error, setError] = useState('')
//   const [notice, setNotice] = useState('')
//   const [busy, setBusy] = useState(false)

//   const fromRef = useRef(null) // 📍
//   const toRef = useRef(null) // 📍

//   const load = useCallback(async () => {
//     setError('')
//     try {
//       setData(await reportsApi.purchaseList({ actingUserId: uid, from, to }))
//     } catch (e) {
//       setError(e.message)
//     }
//   }, [uid, from, to])
//   useEffect(() => {
//     load()
//   }, [load])

//   const exportXlsx = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const r = await reportsApi.exportReport({
//         actingUserId: uid,
//         reportType: 'purchases',
//         from,
//         to
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

//   const thisMonth = () => {
//     const m = new Date()
//     m.setDate(1)
//     setFrom(toLocalDateStr(m))
//     setTo(localToday())
//   }
//   const allTime = () => {
//     setFrom('')
//     setTo('')
//   }

//   const t = data.totals

//   // 📍 PIN — hotkeys
//   useHotkeys(
//     {
//       f5: () => {
//         if (!busy) load()
//       },
//       f9: () => printNow(),
//       e: () => {
//         if (!busy) exportXlsx()
//       },
//       p: () => printNow(),
//       w: () => {
//         const r = presetRange('week') // Ctrl+W — This Week (same as the button)
//         setFrom(r.from)
//         setTo(r.to)
//       },
//       m: () => thisMonth(),
//       l: () => allTime(),
//       'alt+1': () => fromRef.current?.focus(),
//       'alt+2': () => toRef.current?.focus()
//     },
//     [busy, from, to]
//   )

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
//               title="Alt+1"
//             />
//           </label>
//           <label>
//             To{' '}
//             <input
//               ref={toRef}
//               type="date"
//               value={to}
//               onChange={(e) => setTo(e.target.value)}
//               title="Alt+2"
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
//         <button
//           className="btn-sm primary"
//           onClick={exportXlsx}
//           disabled={busy}
//           title="Export (Ctrl+E)"
//         >
//           <Icon name="download" size={15} /> Export
//         </button>
//       </div>
//       {notice && <div className="inv-notice">{notice}</div>}
//       {error && <div className="login-error">{error}</div>}
//       <div className="report-cards">
//         <div className="rc-card">
//           <span>Orders</span>
//           <strong>{t?.orders || 0}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Received</span>
//           <strong>{t?.received || 0}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Sub Total</span>
//           <strong>{fmt(t?.sub)}</strong>
//         </div>
//         <div className="rc-card">
//           <span>GST</span>
//           <strong>{fmt(t?.gst)}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Total (recv)</span>
//           <strong>{fmt(t?.total)}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Returned to vendors</span>
//           <strong>{fmt(t?.returned)}</strong>
//         </div>
//         <div className="rc-card">
//           <span>Net purchases</span>
//           <strong>{fmt(t?.net ?? t?.total)}</strong>
//         </div>
//       </div>
//       <div className="panel report-table-wrap">
//         <div className="table-scroll">
//           <table className="data-table">
//             <thead>
//               <tr>
//                 <th>Serial</th>
//                 <th>Date</th>
//                 <th>Vendor</th>
//                 <th>Status</th>
//                 <th className="num">Sub Total</th>
//                 <th className="num">GST</th>
//                 <th className="num">Total</th>
//                 <th className="num">Returned</th>
//                 <th className="num">Net</th>
//               </tr>
//             </thead>
//             <tbody>
//               {data.rows.length === 0 ? (
//                 <tr>
//                   <td colSpan="9" className="empty">
//                     No purchases in this period
//                   </td>
//                 </tr>
//               ) : (
//                 data.rows.map((r) => (
//                   <tr key={r.id}>
//                     <td>{r.serial_no}</td>
//                     <td>{r.order_date}</td>
//                     <td>{r.vendor || '—'}</td>
//                     <td>
//                       <span className={'po-badge ' + r.status}>
//                         {STATUS[r.status] || r.status}
//                       </span>
//                     </td>
//                     <td className="num">{fmt(r.sub_total)}</td>
//                     <td className="num">{fmt(r.gst_amount)}</td>
//                     <td className="num strong">{fmt(r.total_incl_tax)}</td>
//                     <td className="num">
//                       {Number(r.returned) > 0 ? `(${fmt(r.returned)})` : '—'}
//                     </td>
//                     <td className="num strong">{fmt(r.net ?? r.total_incl_tax)}</td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* 📍 PIN — hint strip */}
//       <div className="hotkey-hint">
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
//           <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
//         </span>
//         <span>
//           <kbd>Ctrl</kbd>+<kbd>M</kbd> This month
//         </span>
//         <span>
//           <kbd>Ctrl</kbd>+<kbd>L</kbd> All time
//         </span>
//         <span>
//           <kbd>Alt</kbd>+<kbd>1/2</kbd> Date focus
//         </span>
//       </div>
//     </div>
//   )
// }

import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi, purchasesApi } from '../api/ipc.js'
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

export default function PurchaseReport() {
  const { session } = useAuth()
  const uid = session.id
  const ms = new Date()
  ms.setDate(1)

  const [from, setFrom] = useState(toLocalDateStr(ms))
  const [to, setTo] = useState(localToday())
  const [data, setData] = useState({ rows: [], totals: null })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // State for the Bill Detail Modal
  const [detail, setDetail] = useState(null)

  const fromRef = useRef(null)
  const toRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setData(await reportsApi.purchaseList({ actingUserId: uid, from, to }))
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to])

  useEffect(() => {
    load()
  }, [load])

  // Fetch the detailed items when a bill is clicked
  const openDetail = async (id) => {
    setBusy(true)
    setError('')
    try {
      const d = await purchasesApi.billDetail({ actingUserId: uid, id })
      setDetail(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await reportsApi.exportReport({
        actingUserId: uid,
        reportType: 'purchases',
        from,
        to
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
    [busy, from, to, detail]
  )

  const t = data.totals

  return (
    <div className="report-page">
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
        <button
          className="btn-sm primary"
          onClick={exportXlsx}
          disabled={busy}
          title="Export (Ctrl+E)"
        >
          <Icon name="download" size={15} /> Export
        </button>
      </div>

      {notice && <div className="inv-notice">{notice}</div>}
      {error && !detail && <div className="login-error">{error}</div>}

      <div className="report-cards">
        <div className="rc-card">
          <span>Orders</span>
          <strong>{t?.orders || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Received</span>
          <strong>{t?.received || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Sub Total</span>
          <strong>{fmt(t?.sub)}</strong>
        </div>
        <div className="rc-card">
          <span>GST</span>
          <strong>{fmt(t?.gst)}</strong>
        </div>
        <div className="rc-card">
          <span>Total (recv)</span>
          <strong>{fmt(t?.total)}</strong>
        </div>
        <div className="rc-card">
          <span>Returned to vendors</span>
          <strong>{fmt(t?.returned)}</strong>
        </div>
        <div className="rc-card amber">
          <span>Net purchases</span>
          <strong>{fmt(t?.net)}</strong>
        </div>
      </div>

      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Status</th>
                <th className="num">Sub Total</th>
                <th className="num">GST</th>
                <th className="num">Total</th>
                <th className="num">Returned</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty">
                    No purchases in this period
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => openDetail(r.id)}
                    title="Click to view purchased products"
                  >
                    <td className="strong">{r.serial_no}</td>
                    <td>{r.order_date}</td>
                    <td>{r.vendor || '—'}</td>
                    <td>
                      <span
                        className="po-badge received"
                        style={{ textTransform: 'capitalize' }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="num">{fmt2(r.sub_total)}</td>
                    <td className="num">{fmt2(r.gst_amount)}</td>
                    <td className="num strong">{fmt2(r.total_incl_tax)}</td>
                    <td className={'num' + (r.returned > 0 ? ' neg' : '')}>
                      {r.returned > 0 ? `(${fmt2(r.returned)})` : '—'}
                    </td>
                    <td className="num strong">{fmt2(r.net)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hotkey-hint">
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

      {/* ================= BILL DETAIL MODAL ================= */}
      {detail && (
        <Modal
          title={`Bill Details — ${detail.serial_no}`}
          width={850}
          onClose={() => setDetail(null)}
          footer={
            <button className="btn-primary" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          {error && <div className="login-error">{error}</div>}

          <div
            className="rd-balance"
            style={{
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              marginBottom: 16
            }}
          >
            <span>
              Vendor: <strong>{detail.vendor || '—'}</strong>
            </span>
            <span>
              Date: <strong>{detail.order_date}</strong>
            </span>
            <span>
              Vendor Bill #: <strong>{detail.vendor_bill_no || '—'}</strong>
            </span>
            <span>
              Status:{' '}
              <strong style={{ textTransform: 'capitalize' }}>
                {detail.status}
              </strong>
            </span>
            <span>
              Stock Added: <strong>{detail.adds_stock ? 'Yes' : 'No'}</strong>
            </span>
          </div>

          <h4 className="cd-sub">Purchased Products</h4>
          <div className="table-scroll" style={{ maxHeight: 400 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item Name / Description</th>
                  <th className="num">Quantity</th>
                  <th className="num">Rate</th>
                  <th className="num">Total</th>
                  <th className="num">Returned</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty">
                      No item lines recorded for this bill (Amount-only bill).
                    </td>
                  </tr>
                ) : (
                  detail.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.item_code || '—'}</td>
                      <td>{l.description}</td>
                      <td className="num">{l.quantity}</td>
                      <td className="num">{fmt2(l.rate)}</td>
                      <td className="num strong">{fmt2(l.amount)}</td>
                      <td className={'num' + (l.returned > 0 ? ' neg' : '')}>
                        {l.returned > 0 ? l.returned : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {detail.returns?.length > 0 && (
            <>
              <h4 className="cd-sub" style={{ marginTop: 16 }}>
                Returns to Vendor
              </h4>
              <div className="table-scroll" style={{ maxHeight: 200 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Return #</th>
                      <th>Date</th>
                      <th>Settlement</th>
                      <th>Reason</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.returns.map((r) => (
                      <tr key={r.id}>
                        <td>{r.return_no}</td>
                        <td>{r.return_date}</td>
                        <td style={{ textTransform: 'capitalize' }}>
                          {r.settlement}
                        </td>
                        <td>{r.reason || '—'}</td>
                        <td className="num neg">-{fmt2(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div
            className="totals"
            style={{
              marginTop: 16,
              borderTop: '1px solid var(--border)',
              paddingTop: 12
            }}
          >
            <div className="tot-row">
              <span>Gross Total</span>
              <strong>{fmt2(detail.total)}</strong>
            </div>
            {detail.returnedValue > 0 && (
              <div className="tot-row">
                <span>Less: Returned to Vendor</span>
                <strong className="neg">-{fmt2(detail.returnedValue)}</strong>
              </div>
            )}
            <div className="tot-row net">
              <span>Net Purchase Amount</span>
              <strong>{fmt2(detail.netTotal)}</strong>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
