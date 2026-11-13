// import { useState, useEffect, useCallback, useRef } from 'react'
// import { reportsApi, inventoryApi } from '../api/ipc.js'
// import { useAuth } from '../context/AuthContext.jsx'
// import Icon from '../components/Icons.jsx'
// import ReportTabs from '../components/ReportTabs.jsx'
// import { useHotkeys } from '../hooks/useHotkeys.js'
// import { printNow } from '../utils/print.js'

// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
// const fmt2 = (n) =>
//   'Rs. ' +
//   Number(n || 0).toLocaleString('en-PK', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2
//   })
// const num = (n) => Number(n || 0).toLocaleString('en-PK')

// export default function StockTrackerReport() {
//   const { session } = useAuth()
//   const uid = session.id

//   const [search, setSearch] = useState('')
//   const [searchResults, setSearchResults] = useState([])
//   const [selectedId, setSelectedId] = useState(null)
//   const [data, setData] = useState(null)
//   const [error, setError] = useState('')
//   const [busy, setBusy] = useState(false)

//   const searchRef = useRef(null)
//   const searchTimer = useRef(null)

//   // Debounced search for items
//   useEffect(() => {
//     if (selectedId) return
//     const term = search.trim()
//     if (!term) {
//       setSearchResults([])
//       return
//     }
//     clearTimeout(searchTimer.current)
//     searchTimer.current = setTimeout(async () => {
//       try {
//         const list = await inventoryApi.items.list({ search: term })
//         setSearchResults(list.slice(0, 15))
//       } catch (e) {
//         setError(e.message)
//       }
//     }, 180)
//     return () => clearTimeout(searchTimer.current)
//   }, [search, selectedId])

//   // Load the tracker data when an item is selected
//   const loadTracker = useCallback(async () => {
//     if (!selectedId) return
//     setBusy(true)
//     setError('')
//     try {
//       const res = await reportsApi.stockTracker({
//         actingUserId: uid,
//         itemId: selectedId
//       })
//       setData(res)
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }, [uid, selectedId])

//   useEffect(() => {
//     loadTracker()
//   }, [loadTracker])

//   const clearSelection = () => {
//     setSelectedId(null)
//     setData(null)
//     setSearch('')
//     setSearchResults([])
//     searchRef.current?.focus()
//   }

//   useHotkeys(
//     {
//       f2: () => {
//         if (data) clearSelection()
//         else searchRef.current?.focus()
//       },
//       f5: () => {
//         if (!busy && data) loadTracker()
//       },
//       f9: () => printNow(),
//       p: () => printNow(),
//       escape: () => {
//         if (data) clearSelection()
//       }
//     },
//     [busy, data, loadTracker]
//   )

//   const totals = data
//     ? data.vendors.reduce(
//         (acc, v) => ({
//           qty: acc.qty + Number(v.qty_purchased),
//           amount: acc.amount + Number(v.total_amount)
//         }),
//         { qty: 0, amount: 0 }
//       )
//     : { qty: 0, amount: 0 }

//   return (
//     <div className="report-page">
//       <ReportTabs />

//       {/* Search Bar */}
//       <div className="report-bar" style={{ marginBottom: 16 }}>
//         <div
//           className="search-box grow"
//           style={{ position: 'relative', maxWidth: 500 }}
//         >
//           <Icon name="search" size={16} />
//           <input
//             ref={searchRef}
//             placeholder="Search by item code or name to track purchases... (F2)"
//             value={search}
//             onChange={(e) => {
//               setSearch(e.target.value)
//               if (selectedId) setSelectedId(null)
//             }}
//             disabled={!!selectedId}
//           />
//           {selectedId && (
//             <button
//               type="button"
//               className="btn-icon"
//               title="Clear"
//               onClick={clearSelection}
//               style={{ marginLeft: 'auto', padding: 4 }}
//             >
//               ✕
//             </button>
//           )}

//           {/* Dropdown */}
//           {!selectedId && searchResults.length > 0 && (
//             <div
//               className="search-results"
//               style={{
//                 position: 'absolute',
//                 top: '100%',
//                 left: 0,
//                 right: 0,
//                 zIndex: 100,
//                 background: 'var(--surface)',
//                 border: '1px solid var(--border)',
//                 boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
//               }}
//             >
//               {searchResults.map((it) => (
//                 <div
//                   key={it.id}
//                   className="sr-row"
//                   style={{
//                     padding: '10px 12px',
//                     cursor: 'pointer',
//                     borderBottom: '1px solid var(--border)'
//                   }}
//                   onClick={() => {
//                     setSelectedId(it.id)
//                     setSearch(it.name)
//                     setSearchResults([])
//                   }}
//                 >
//                   <div
//                     style={{ display: 'flex', justifyContent: 'space-between' }}
//                   >
//                     <strong>{it.name}</strong>
//                     <span className="muted-text">{it.item_code}</span>
//                   </div>
//                   <div
//                     style={{
//                       fontSize: 11,
//                       color: 'var(--muted)',
//                       marginTop: 4
//                     }}
//                   >
//                     Current Stock: {it.current_stock} {it.unit}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>

//       {error && <div className="login-error">{error}</div>}

//       {!selectedId && searchResults.length === 0 && !search.trim() && (
//         <div
//           className="panel"
//           style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}
//         >
//           <Icon
//             name="search"
//             size={40}
//             style={{ opacity: 0.2, marginBottom: 16 }}
//           />
//           <h3>Search for a product to view its purchase history</h3>
//           <p>
//             Type an item name or code above to see how many units were purchased
//             from each vendor, along with dates, quantities, and prices.
//           </p>
//         </div>
//       )}

//       {data && (
//         <>
//           {/* Item Header */}
//           <div
//             className="panel"
//             style={{
//               padding: '16px 20px',
//               marginBottom: 16,
//               background: 'var(--bg-soft, #f7f8fa)'
//             }}
//           >
//             <div
//               style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: 24,
//                 flexWrap: 'wrap'
//               }}
//             >
//               <div>
//                 <h2 style={{ margin: 0, fontSize: 20 }}>{data.item.name}</h2>
//                 <span className="muted-text">
//                   Code: {data.item.item_code}{' '}
//                   {data.item.size ? `· ${data.item.size}` : ''}
//                 </span>
//               </div>
//               <div style={{ display: 'flex', gap: 24, marginLeft: 'auto' }}>
//                 <div
//                   className="rc-card"
//                   style={{
//                     minWidth: 120,
//                     padding: 12,
//                     borderLeft: '4px solid var(--primary)'
//                   }}
//                 >
//                   <span>Current Stock</span>
//                   <strong>{num(data.item.current_stock)}</strong>
//                 </div>
//                 <div
//                   className="rc-card"
//                   style={{
//                     minWidth: 120,
//                     padding: 12,
//                     borderLeft: '4px solid var(--green)'
//                   }}
//                 >
//                   <span>Total Purchased</span>
//                   <strong>{num(totals.qty)}</strong>
//                 </div>
//                 <div
//                   className="rc-card"
//                   style={{
//                     minWidth: 120,
//                     padding: 12,
//                     borderLeft: '4px solid var(--amber)'
//                   }}
//                 >
//                   <span>Total Amount</span>
//                   <strong>{fmt(totals.amount)}</strong>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Vendor Breakdown Table */}
//           <h4 className="cd-sub">Vendor Breakdown</h4>
//           <div className="panel report-table-wrap" style={{ marginBottom: 24 }}>
//             <div className="table-scroll">
//               <table className="data-table">
//                 <thead>
//                   <tr>
//                     <th>Vendor</th>
//                     <th className="num">Bills</th>
//                     <th className="num">Qty Purchased</th>
//                     <th className="num">Total Amount</th>
//                     <th className="num">Avg Rate</th>
//                     <th>First Purchase</th>
//                     <th>Last Purchase</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {data.vendors.length === 0 ? (
//                     <tr>
//                       <td colSpan="7" className="empty">
//                         No purchases recorded for this item.
//                       </td>
//                     </tr>
//                   ) : (
//                     data.vendors.map((v, i) => (
//                       <tr key={i}>
//                         <td className="strong">{v.vendor}</td>
//                         <td className="num">{v.bill_count}</td>
//                         <td className="num strong">{num(v.qty_purchased)}</td>
//                         <td className="num">{fmt(v.total_amount)}</td>
//                         <td className="num">{fmt2(v.avg_rate)}</td>
//                         <td>{v.first_purchase}</td>
//                         <td>{v.last_purchase}</td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           {/* Detailed Bills Table */}
//           <h4 className="cd-sub">All Purchase Bills</h4>
//           <div className="panel report-table-wrap">
//             <div className="table-scroll">
//               <table className="data-table">
//                 <thead>
//                   <tr>
//                     <th>Bill #</th>
//                     <th>Date</th>
//                     <th>Vendor</th>
//                     <th>Vendor Bill #</th>
//                     <th className="num">Qty</th>
//                     <th className="num">Rate</th>
//                     <th className="num">Amount</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {data.bills.length === 0 ? (
//                     <tr>
//                       <td colSpan="7" className="empty">
//                         No bills found.
//                       </td>
//                     </tr>
//                   ) : (
//                     data.bills.map((b, i) => (
//                       <tr key={i}>
//                         <td className="strong">{b.serial_no}</td>
//                         <td>{b.order_date}</td>
//                         <td>{b.vendor}</td>
//                         <td>{b.vendor_bill_no || '—'}</td>
//                         <td className="num strong">{num(b.quantity)}</td>
//                         <td className="num">{fmt2(b.rate)}</td>
//                         <td className="num">{fmt2(b.amount)}</td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         </>
//       )}

//       {/* Hint Strip */}
//       <div className="hotkey-hint">
//         <span>
//           <kbd>F2</kbd> Search / Clear
//         </span>
//         <span>
//           <kbd>F5</kbd> Refresh
//         </span>
//         <span>
//           <kbd>F9</kbd> Print
//         </span>
//         <span>
//           <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
//         </span>
//         <span>
//           <kbd>Esc</kbd> Close
//         </span>
//       </div>
//     </div>
//   )
// }

import { useState, useEffect, useCallback, useRef } from 'react'
import { reportsApi, inventoryApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
const fmt2 = (n) =>
  'Rs. ' +
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
const num = (n) => Number(n || 0).toLocaleString('en-PK')

export default function StockTrackerReport() {
  const { session } = useAuth()
  const uid = session.id

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const searchRef = useRef(null)
  const searchTimer = useRef(null)

  // Debounced search for items
  useEffect(() => {
    if (selectedId) return
    const term = search.trim()
    if (!term) {
      setSearchResults([])
      return
    }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const list = await inventoryApi.items.list({ search: term })
        setSearchResults(list.slice(0, 15))
      } catch (e) {
        setError(e.message)
      }
    }, 180)
    return () => clearTimeout(searchTimer.current)
  }, [search, selectedId])

  // Load the tracker data when an item is selected
  const loadTracker = useCallback(async () => {
    if (!selectedId) return
    setBusy(true)
    setError('')
    try {
      const res = await reportsApi.stockTracker({
        actingUserId: uid,
        itemId: selectedId
      })
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [uid, selectedId])

  useEffect(() => {
    loadTracker()
  }, [loadTracker])

  const clearSelection = () => {
    setSelectedId(null)
    setData(null)
    setSearch('')
    setSearchResults([])
    searchRef.current?.focus()
  }

  useHotkeys(
    {
      f2: () => {
        if (data) clearSelection()
        else searchRef.current?.focus()
      },
      f5: () => {
        if (!busy && data) loadTracker()
      },
      f9: () => printNow(),
      p: () => printNow(),
      escape: () => {
        if (data) clearSelection()
      }
    },
    [busy, data, loadTracker]
  )

  const totals = data
    ? data.vendors.reduce(
        (acc, v) => ({
          qty: acc.qty + Number(v.qty_purchased),
          amount: acc.amount + Number(v.total_amount)
        }),
        { qty: 0, amount: 0 }
      )
    : { qty: 0, amount: 0 }

  return (
    <div className="report-page">
      <ReportTabs />

      {/* Search Bar */}
      <div className="report-bar" style={{ marginBottom: 16 }}>
        <div
          className="search-box grow"
          style={{ position: 'relative', maxWidth: 500 }}
        >
          <Icon name="search" size={16} />
          <input
            ref={searchRef}
            placeholder="Search by item code or name to track purchases... (F2)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (selectedId) setSelectedId(null)
            }}
            disabled={!!selectedId}
          />
          {selectedId && (
            <button
              type="button"
              className="btn-icon"
              title="Clear"
              onClick={clearSelection}
              style={{ marginLeft: 'auto', padding: 4 }}
            >
              ✕
            </button>
          )}

          {/* Dropdown */}
          {!selectedId && searchResults.length > 0 && (
            <div
              className="search-results"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 100,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {searchResults.map((it) => (
                <div
                  key={it.id}
                  className="sr-row"
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)'
                  }}
                  onClick={() => {
                    setSelectedId(it.id)
                    setSearch(it.name)
                    setSearchResults([])
                  }}
                >
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <strong>{it.name}</strong>
                    <span className="muted-text">{it.item_code}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      marginTop: 4
                    }}
                  >
                    Current Stock: {it.current_stock} {it.unit}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      {!selectedId && searchResults.length === 0 && !search.trim() && (
        <div
          className="panel"
          style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}
        >
          <Icon
            name="search"
            size={40}
            style={{ opacity: 0.2, marginBottom: 16 }}
          />
          <h3>Search for a product to view its purchase history</h3>
          <p>
            Type an item name or code above to see how many units were purchased
            from each vendor, along with dates, quantities, and prices.
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Item Header */}
          <div
            className="panel"
            style={{
              padding: '16px 20px',
              marginBottom: 16,
              background: 'var(--bg-soft, #f7f8fa)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{data.item.name}</h2>
                <span className="muted-text">
                  Code: {data.item.item_code}{' '}
                  {data.item.size ? `· ${data.item.size}` : ''}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  marginLeft: 'auto',
                  flexWrap: 'wrap'
                }}
              >
                <div
                  className="rc-card"
                  style={{
                    minWidth: 120,
                    padding: 12,
                    borderLeft: '4px solid var(--primary)'
                  }}
                >
                  <span>Current Stock</span>
                  <strong>{num(data.item.current_stock)}</strong>
                </div>

                <div
                  className="rc-card"
                  style={{
                    minWidth: 120,
                    padding: 12,
                    borderLeft: '4px solid var(--green)'
                  }}
                >
                  <span>Total Purchased</span>
                  <strong>{num(totals.qty)}</strong>
                </div>

                {/* NEW: Cost Breakdown */}
                <div
                  className="rc-card"
                  style={{
                    minWidth: 120,
                    padding: 12,
                    borderLeft: '4px solid var(--amber)'
                  }}
                >
                  <span>Avg Cost (Weighted)</span>
                  <strong>{fmt2(data.item.average_cost)}</strong>
                </div>

                <div
                  className="rc-card"
                  style={{
                    minWidth: 120,
                    padding: 12,
                    borderLeft: '4px solid var(--indigo)'
                  }}
                >
                  <span>Latest Purchase Price</span>
                  <strong>{fmt2(data.item.purchase_price)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Vendor Breakdown Table */}
          {/* Vendor Breakdown Table */}
          <h4 className="cd-sub">Vendor Breakdown</h4>
          <div className="panel report-table-wrap" style={{ marginBottom: 24 }}>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th className="num">Bills</th>
                    <th className="num">Qty Purchased</th>
                    <th className="num">Total Amount</th>
                    <th className="num">Avg Rate</th>
                    <th>First Purchase</th>
                    <th>Last Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.vendors || data.vendors.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty">
                        No vendor purchases recorded for this item.
                      </td>
                    </tr>
                  ) : (
                    data.vendors.map((v, i) => (
                      <tr key={i}>
                        <td className="strong">{v.vendor}</td>
                        <td className="num">{v.bill_count}</td>
                        <td className="num strong">{num(v.qty_purchased)}</td>
                        <td className="num">{fmt(v.total_amount)}</td>
                        <td className="num">{fmt2(v.avg_rate)}</td>
                        <td>{v.first_purchase}</td>
                        <td>{v.last_purchase}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Bills Table */}
          <h4 className="cd-sub">All Purchase Bills</h4>
          <div className="panel report-table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Vendor Bill #</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.bills || data.bills.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty">
                        No purchase bills found.
                      </td>
                    </tr>
                  ) : (
                    data.bills.map((b, i) => (
                      <tr key={i}>
                        <td className="strong">{b.serial_no}</td>
                        <td>{b.order_date}</td>
                        <td>{b.vendor}</td>
                        <td>{b.vendor_bill_no || '—'}</td>
                        <td className="num strong">{num(b.quantity)}</td>
                        <td className="num">{fmt2(b.rate)}</td>
                        <td className="num">{fmt2(b.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Hint Strip */}
      <div className="hotkey-hint">
        <span>
          <kbd>F2</kbd> Search / Clear
        </span>
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>F9</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>
    </div>
  )
}
