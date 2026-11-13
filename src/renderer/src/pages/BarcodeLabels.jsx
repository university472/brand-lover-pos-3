// import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
// import { useLocation } from 'react-router-dom'
// import { inventoryApi, companyApi, printerApi } from '../api/ipc.js'
// import Icon from '../components/Icons.jsx'
// import Barcode from '../components/Barcode.jsx'
// import { useHotkeys } from '../hooks/useHotkeys.js'
// import { printLabelsSheet } from '../utils/printLabels.js'

// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

// export default function BarcodeLabels() {
//   const location = useLocation()
//   const preItemId = location.state?.itemId

//   const [items, setItems] = useState([])
//   const [search, setSearch] = useState('')
//   const [selected, setSelected] = useState({})
//   const [columns, setColumns] = useState(3)
//   const [showName, setShowName] = useState(true)
//   const [showPrice, setShowPrice] = useState(true)
//   const [showShop, setShowShop] = useState(true) // ✅ Phase A6
//   const [offerText, setOfferText] = useState('') // ✅ Phase A6
//   const [showOffer, setShowOffer] = useState(false) // ✅ Phase A6
//   const [profile, setProfile] = useState(null) // ✅ Phase A6
//   const [bulkCopies, setBulkCopies] = useState(1)
//   const [error, setError] = useState('')
//   const [notice, setNotice] = useState('')
//   const [busy, setBusy] = useState(false)

//   // ✅ Step 6 — Zebra label printer selection
//   const [printers, setPrinters] = useState([])
//   const [labelPrinter, setLabelPrinter] = useState(
//     localStorage.getItem('labelPrinter') || ''
//   )

//   const searchRef = useRef(null)
//   const offerRef = useRef(null) // ✅ Phase A6

//   const load = useCallback(async () => {
//     try {
//       setItems(await inventoryApi.items.list({}))
//     } catch (e) {
//       setError(e.message)
//     }
//   }, [])

//   useEffect(() => {
//     load()
//     // ✅ Phase A6 — shop name ke liye company profile
//     companyApi
//       .getProfile()
//       .then(setProfile)
//       .catch(() => {})

//     printerApi
//       .list()
//       .then((list) => {
//         setPrinters(list)
//         const saved = localStorage.getItem('labelPrinter')
//         const stillAvailable = saved && list.some((p) => p.name === saved)
//         if (!stillAvailable) {
//           // saved printer gone or nothing saved — auto-pick GX420d / ZDesigner
//           const gx = list.find((p) => /zebra|gx420|zdesigner/i.test(p.name))
//           if (gx) {
//             setLabelPrinter(gx.name)
//             localStorage.setItem('labelPrinter', gx.name)
//           }
//         }
//       })
//       .catch(() => {})
//   }, [load])

//   useEffect(() => {
//     if (preItemId)
//       setSelected((s) => ({ ...s, [preItemId]: s[preItemId] || 1 }))
//   }, [preItemId])

//   const filtered = useMemo(() => {
//     const s = search.trim().toLowerCase()
//     if (!s) return items
//     return items.filter(
//       (i) =>
//         i.name.toLowerCase().includes(s) ||
//         i.item_code.toLowerCase().includes(s) ||
//         (i.barcode || '').toLowerCase().includes(s)
//     )
//   }, [items, search])

//   const toggle = (id) =>
//     setSelected((s) => {
//       const n = { ...s }
//       if (n[id]) delete n[id]
//       else n[id] = bulkCopies || 1
//       return n
//     })
//   const setCopies = (id, v) =>
//     setSelected((s) => ({ ...s, [id]: Math.max(1, Number(v) || 1) }))
//   const selectAllFiltered = () =>
//     setSelected((s) => {
//       const n = { ...s }
//       filtered.forEach((i) => {
//         n[i.id] = n[i.id] || bulkCopies || 1
//       })
//       return n
//     })
//   const clearAll = () => setSelected({})
//   const applyBulkCopies = () =>
//     setSelected((s) => {
//       const n = { ...s }
//       Object.keys(n).forEach((k) => {
//         n[k] = bulkCopies || 1
//       })
//       return n
//     })

//   // ✅ Phase A6 — size bhi label mein
//   const labels = useMemo(() => {
//     const out = []
//     for (const it of items) {
//       const copies = selected[it.id]
//       if (!copies) continue
//       const code = it.barcode || it.item_code
//       for (let i = 0; i < copies; i++)
//         out.push({
//           key: `${it.id}-${i}`,
//           code,
//           name: it.name,
//           size: it.size || '', // ✅
//           price: it.selling_price
//         })
//     }
//     return out
//   }, [items, selected])

//   const shopName = profile?.receipt_header || ''

//   const generateMissing = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const r = await inventoryApi.items.ensureBarcodes()
//       await load()
//       setNotice(`Generated barcodes for ${r.updated} item(s).`)
//       setTimeout(() => setNotice(''), 4000)
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const doPrint = async () => {
//     if (labels.length === 0) return
//     setBusy(true)
//     setError('')
//     try {
//       const res = await printLabelsSheet(labelPrinter || undefined, labels, {
//         shopName,
//         showShop,
//         showName,
//         showPrice,
//         offer: showOffer && offerText.trim() ? offerText.trim() : ''
//       })
//       if (res && !res.ok) setError(res.error || 'Print failed')
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const selectedCount = Object.keys(selected).length

//   useHotkeys(
//     {
//       f2: () => searchRef.current?.focus(),
//       f3: () => offerRef.current?.focus(), // ✅ Phase A6 — offer field
//       f5: () => {
//         if (!busy) load()
//       },
//       f8: () => selectAllFiltered(),
//       f9: () => doPrint(),
//       p: () => doPrint()
//     },
//     [busy, labels, filtered]
//   )

//   return (
//     <div className="bc-page">
//       <div className="bc-toolbar no-print">
//         <div className="search-box">
//           <Icon name="search" size={15} />
//           <input
//             ref={searchRef}
//             placeholder="Search name / code  (F2)"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//         </div>
//         <div className="bc-tools">
//           <button
//             className="btn-sm ghost"
//             onClick={selectAllFiltered}
//             title="Select all (F8)"
//           >
//             Select all
//           </button>
//           <button className="btn-sm ghost" onClick={clearAll}>
//             Clear
//           </button>
//           <label className="bc-inline">
//             Copies
//             <input
//               type="number"
//               min="1"
//               value={bulkCopies}
//               onChange={(e) => setBulkCopies(Number(e.target.value))}
//               onBlur={applyBulkCopies}
//             />
//           </label>
//           <label className="bc-inline">
//             Cols
//             <select
//               value={columns}
//               onChange={(e) => setColumns(Number(e.target.value))}
//             >
//               <option value={2}>2</option>
//               <option value={3}>3</option>
//               <option value={4}>4</option>
//             </select>
//           </label>
//           {/* ✅ Step 6 — label printer chunne ka dropdown */}
//           <label className="bc-inline" style={{ width: 'auto' }}>
//             Printer
//             <select
//               style={{ width: 'auto', minWidth: 150 }}
//               value={labelPrinter}
//               onChange={(e) => {
//                 setLabelPrinter(e.target.value)
//                 localStorage.setItem('labelPrinter', e.target.value)
//               }}
//             >
//               <option value="">Default printer</option>
//               {printers.map((p) => (
//                 <option key={p.name} value={p.name}>
//                   {p.name}
//                   {p.isDefault ? ' (default)' : ''}
//                 </option>
//               ))}
//             </select>
//           </label>
//           {/* ✅ Phase A6 — shop name toggle */}
//           <label className="bc-check">
//             <input
//               type="checkbox"
//               checked={showShop}
//               onChange={(e) => setShowShop(e.target.checked)}
//             />{' '}
//             Shop
//           </label>
//           <label className="bc-check">
//             <input
//               type="checkbox"
//               checked={showName}
//               onChange={(e) => setShowName(e.target.checked)}
//             />{' '}
//             Name
//           </label>
//           <label className="bc-check">
//             <input
//               type="checkbox"
//               checked={showPrice}
//               onChange={(e) => setShowPrice(e.target.checked)}
//             />{' '}
//             Price
//           </label>
//           <button
//             className="btn-sm ghost"
//             onClick={generateMissing}
//             disabled={busy}
//           >
//             <Icon name="barcode" size={15} /> Fix missing
//           </button>
//           <button
//             className="btn-sm primary"
//             onClick={doPrint}
//             disabled={labels.length === 0}
//             title="Print (F9 / Ctrl+P)"
//           >
//             <Icon name="printer" size={15} /> Print ({labels.length})
//           </button>
//         </div>
//       </div>

//       {/* ✅ Phase A6 — Offer line (editable) */}
//       <div className="bc-toolbar no-print" style={{ marginTop: -4 }}>
//         <label className="bc-inline" style={{ flex: 1, minWidth: 240 }}>
//           <span style={{ whiteSpace: 'nowrap' }}>Offer line</span>
//           <input
//             ref={offerRef}
//             type="text"
//             value={offerText}
//             onChange={(e) => {
//               setOfferText(e.target.value)
//               if (e.target.value.trim()) setShowOffer(true)
//             }}
//             placeholder="e.g. SALE 20% OFF — Ramzan Special  (F3)"
//             style={{ flex: 1, minWidth: 220, padding: '6px 8px' }}
//           />
//         </label>
//         <label className="bc-check">
//           <input
//             type="checkbox"
//             checked={showOffer}
//             onChange={(e) => setShowOffer(e.target.checked)}
//           />{' '}
//           Show offer on labels
//         </label>
//       </div>

//       {notice && <div className="inv-notice no-print">{notice}</div>}
//       {error && <div className="login-error no-print">{error}</div>}

//       <div className="bc-body">
//         <div className="inv-pane no-print">
//           <div className="inv-pane-head">
//             <span>Products ({selectedCount} selected)</span>
//           </div>
//           <div className="inv-list">
//             {filtered.length === 0 && (
//               <div className="inv-empty">No products</div>
//             )}
//             {filtered.map((i) => {
//               const on = !!selected[i.id]
//               return (
//                 <div key={i.id} className={'bc-item' + (on ? ' on' : '')}>
//                   <label className="bc-item-main">
//                     <input
//                       type="checkbox"
//                       checked={on}
//                       onChange={() => toggle(i.id)}
//                     />
//                     <div className="ili-text">
//                       <strong>
//                         {i.name}
//                         {i.size ? ` (${i.size})` : ''}
//                       </strong>
//                       <span>{i.barcode || i.item_code}</span>
//                     </div>
//                   </label>
//                   {on && (
//                     <input
//                       className="cell-input sm"
//                       type="number"
//                       min="1"
//                       value={selected[i.id]}
//                       onChange={(e) => setCopies(i.id, e.target.value)}
//                     />
//                   )}
//                 </div>
//               )
//             })}
//           </div>
//         </div>

//         <div className="bc-preview-pane">
//           {labels.length === 0 ? (
//             <div className="inv-empty" style={{ margin: 'auto' }}>
//               Select products on the left to build a label sheet
//             </div>
//           ) : (
//             <div
//               id="barcode-sheet"
//               className="bc-sheet"
//               style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
//             >
//               {labels.map((l) => (
//                 <div key={l.key} className="bc-label">
//                   <div className="bc-main">
//                     {showShop && shopName && (
//                       <div className="bc-label-shop">{shopName}</div>
//                     )}
//                     <div className="bc-label-head">
//                       {showName && (
//                         <span className="bc-label-name">
//                           {l.name}
//                           {l.size ? ` (${l.size})` : ''}
//                         </span>
//                       )}
//                       {showPrice && (
//                         <span className="bc-label-price">{fmt(l.price)}</span>
//                       )}
//                     </div>
//                     <Barcode
//                       value={l.code}
//                       height={34}
//                       width={1.5}
//                       fontSize={11}
//                     />
//                   </div>
//                   {showOffer && offerText.trim() && (
//                     <div className="bc-label-offer-v">{offerText.trim()}</div>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>

//       <div className="hotkey-hint no-print">
//         <span>
//           <kbd>F2</kbd> Search
//         </span>
//         <span>
//           <kbd>F3</kbd> Offer line
//         </span>
//         <span>
//           <kbd>F5</kbd> Refresh
//         </span>
//         <span>
//           <kbd>F8</kbd> Select all
//         </span>
//         <span>
//           <kbd>F9</kbd> Print
//         </span>
//         <span>
//           <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
//         </span>
//       </div>
//     </div>
//   )
// }

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { inventoryApi, companyApi, printerApi } from '../api/ipc.js'
import Icon from '../components/Icons.jsx'
import Barcode from '../components/Barcode.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printLabelsSheet } from '../utils/printLabels.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

export default function BarcodeLabels() {
  const location = useLocation()
  const preItemId = location.state?.itemId

  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState({})
  const [showName, setShowName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [showShop, setShowShop] = useState(true) // ✅ Phase A6
  const [offerText, setOfferText] = useState('') // ✅ Phase A6
  const [showOffer, setShowOffer] = useState(false) // ✅ Phase A6
  const [profile, setProfile] = useState(null) // ✅ Phase A6
  const [bulkCopies, setBulkCopies] = useState(1)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // ✅ Step 6 — Zebra label printer selection
  const [printers, setPrinters] = useState([])
  const [labelPrinter, setLabelPrinter] = useState(
    localStorage.getItem('labelPrinter') || ''
  )

  const searchRef = useRef(null)
  const offerRef = useRef(null) // ✅ Phase A6

  const load = useCallback(async () => {
    try {
      setItems(await inventoryApi.items.list({}))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
    // ✅ Phase A6 — shop name ke liye company profile
    companyApi
      .getProfile()
      .then(setProfile)
      .catch(() => {})

    printerApi
      .list()
      .then((list) => {
        setPrinters(list)
        const saved = localStorage.getItem('labelPrinter')
        const stillAvailable = saved && list.some((p) => p.name === saved)
        if (!stillAvailable) {
          // saved printer gone or nothing saved — auto-pick GX420d / ZDesigner
          const gx = list.find((p) => /zebra|gx420|zdesigner/i.test(p.name))
          if (gx) {
            setLabelPrinter(gx.name)
            localStorage.setItem('labelPrinter', gx.name)
          }
        }
      })
      .catch(() => {})
  }, [load])

  useEffect(() => {
    if (preItemId)
      setSelected((s) => ({ ...s, [preItemId]: s[preItemId] || 1 }))
  }, [preItemId])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return items
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.item_code.toLowerCase().includes(s) ||
        (i.barcode || '').toLowerCase().includes(s)
    )
  }, [items, search])

  const toggle = (id) =>
    setSelected((s) => {
      const n = { ...s }
      if (n[id]) delete n[id]
      else n[id] = bulkCopies || 1
      return n
    })
  const setCopies = (id, v) =>
    setSelected((s) => ({ ...s, [id]: Math.max(1, Number(v) || 1) }))
  const selectAllFiltered = () =>
    setSelected((s) => {
      const n = { ...s }
      filtered.forEach((i) => {
        n[i.id] = n[i.id] || bulkCopies || 1
      })
      return n
    })
  const clearAll = () => setSelected({})
  const applyBulkCopies = () =>
    setSelected((s) => {
      const n = { ...s }
      Object.keys(n).forEach((k) => {
        n[k] = bulkCopies || 1
      })
      return n
    })

  // ✅ Phase A6 — size bhi label mein
  const labels = useMemo(() => {
    const out = []
    for (const it of items) {
      const copies = selected[it.id]
      if (!copies) continue
      const code = it.barcode || it.item_code
      for (let i = 0; i < copies; i++)
        out.push({
          key: `${it.id}-${i}`,
          code,
          name: it.name,
          size: it.size || '', // ✅
          price: it.selling_price
        })
    }
    return out
  }, [items, selected])

  const shopName = profile?.receipt_header || ''

  const generateMissing = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await inventoryApi.items.ensureBarcodes()
      await load()
      setNotice(`Generated barcodes for ${r.updated} item(s).`)
      setTimeout(() => setNotice(''), 4000)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const doPrint = async () => {
    if (labels.length === 0) return
    setBusy(true)
    setError('')
    try {
      const res = await printLabelsSheet(labelPrinter || undefined, labels, {
        shopName,
        showShop,
        showName,
        showPrice,
        offer: showOffer && offerText.trim() ? offerText.trim() : ''
      })
      if (res && !res.ok) setError(res.error || 'Print failed')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const selectedCount = Object.keys(selected).length

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f3: () => offerRef.current?.focus(), // ✅ Phase A6 — offer field
      f5: () => {
        if (!busy) load()
      },
      f8: () => selectAllFiltered(),
      f9: () => doPrint(),
      p: () => doPrint()
    },
    [busy, labels, filtered]
  )

  return (
    <div className="bc-page">
      <div className="bc-toolbar no-print">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            placeholder="Search name / code  (F2)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="bc-tools">
          <button
            className="btn-sm ghost"
            onClick={selectAllFiltered}
            title="Select all (F8)"
          >
            Select all
          </button>
          <button className="btn-sm ghost" onClick={clearAll}>
            Clear
          </button>
          {/* one "row" = one 2-up strip = 2 identical stickers (was labelled "Copies") */}
          <label className="bc-inline" title="Each row prints 2 identical stickers side by side">
            Rows (2 tags each)
            <input
              type="number"
              min="1"
              value={bulkCopies}
              onChange={(e) => setBulkCopies(Number(e.target.value))}
              onBlur={applyBulkCopies}
            />
          </label>
          {/* ✅ Step 6 — label printer chunne ka dropdown */}
          <label className="bc-inline" style={{ width: 'auto' }}>
            Printer
            <select
              style={{ width: 'auto', minWidth: 150 }}
              value={labelPrinter}
              onChange={(e) => {
                setLabelPrinter(e.target.value)
                localStorage.setItem('labelPrinter', e.target.value)
              }}
            >
              <option value="">Default printer</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                  {p.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
          {/* ✅ Phase A6 — shop name toggle */}
          <label className="bc-check">
            <input
              type="checkbox"
              checked={showShop}
              onChange={(e) => setShowShop(e.target.checked)}
            />{' '}
            Shop
          </label>
          <label className="bc-check">
            <input
              type="checkbox"
              checked={showName}
              onChange={(e) => setShowName(e.target.checked)}
            />{' '}
            Name
          </label>
          <label className="bc-check">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
            />{' '}
            Price
          </label>
          <button
            className="btn-sm ghost"
            onClick={generateMissing}
            disabled={busy}
          >
            <Icon name="barcode" size={15} /> Fix missing
          </button>
          <button
            className="btn-sm primary"
            onClick={doPrint}
            disabled={labels.length === 0}
            title="Print (F9 / Ctrl+P)"
          >
            <Icon name="printer" size={15} /> Print ({labels.length} row
            {labels.length === 1 ? '' : 's'} = {labels.length * 2} tags)
          </button>
        </div>
      </div>

      {/* ✅ Phase A6 — Offer line (editable) */}
      <div className="bc-toolbar no-print" style={{ marginTop: -4 }}>
        <label className="bc-inline" style={{ flex: 1, minWidth: 240 }}>
          <span style={{ whiteSpace: 'nowrap' }}>Offer line</span>
          <input
            ref={offerRef}
            type="text"
            value={offerText}
            onChange={(e) => {
              setOfferText(e.target.value)
              if (e.target.value.trim()) setShowOffer(true)
            }}
            placeholder="e.g. SALE 20% OFF — Ramzan Special  (F3)"
            style={{ flex: 1, minWidth: 220, padding: '6px 8px' }}
          />
        </label>
        <label className="bc-check">
          <input
            type="checkbox"
            checked={showOffer}
            onChange={(e) => setShowOffer(e.target.checked)}
          />{' '}
          Show offer on labels
        </label>
      </div>

      {notice && <div className="inv-notice no-print">{notice}</div>}
      {error && <div className="login-error no-print">{error}</div>}

      <div className="bc-body">
        <div className="inv-pane no-print">
          <div className="inv-pane-head">
            <span>Products ({selectedCount} selected)</span>
          </div>
          <div className="inv-list">
            {filtered.length === 0 && (
              <div className="inv-empty">No products</div>
            )}
            {filtered.map((i) => {
              const on = !!selected[i.id]
              return (
                <div key={i.id} className={'bc-item' + (on ? ' on' : '')}>
                  <label className="bc-item-main">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(i.id)}
                    />
                    <div className="ili-text">
                      <strong>
                        {i.name}
                        {i.size ? ` (${i.size})` : ''}
                      </strong>
                      <span>{i.barcode || i.item_code}</span>
                    </div>
                  </label>
                  {on && (
                    <input
                      className="cell-input sm"
                      type="number"
                      min="1"
                      value={selected[i.id]}
                      onChange={(e) => setCopies(i.id, e.target.value)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bc-preview-pane">
          {labels.length === 0 ? (
            <div className="inv-empty" style={{ margin: 'auto' }}>
              Select products on the left to build a label sheet
            </div>
          ) : (
            <div id="barcode-sheet" className="bc-sheet">
              {labels.map((l) => (
                <div key={l.key} className="bc-row">
                  {[0, 1].map((col) => (
                    <div key={col} className="bc-label">
                      {showShop && shopName && (
                        <div className="bc-label-shop">{shopName}</div>
                      )}
                      <div className="bc-label-head">
                        {showName && (
                          <span className="bc-label-name">
                            {l.name}
                            {l.size ? ` (${l.size})` : ''}
                          </span>
                        )}
                        {showPrice && (
                          <span className="bc-label-price">{fmt(l.price)}</span>
                        )}
                      </div>
                      <div className="bc-label-barcode">
                        <Barcode
                          value={l.code}
                          height={28}
                          width={1.3}
                          fontSize={9}
                        />
                      </div>
                      {showOffer && offerText.trim() && (
                        <div className="bc-label-foot">
                          <span className="bc-label-code">{l.code}</span>
                          <span className="bc-label-offer">
                            {offerText.trim()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hotkey-hint no-print">
        <span>
          <kbd>F2</kbd> Search
        </span>
        <span>
          <kbd>F3</kbd> Offer line
        </span>
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>F8</kbd> Select all
        </span>
        <span>
          <kbd>F9</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
      </div>
    </div>
  )
}
