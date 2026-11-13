// // // import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
// // // import { purchasesApi, inventoryApi } from '../api/ipc.js'
// // // import { useAuth } from '../context/AuthContext.jsx'
// // // import Icon from '../components/Icons.jsx'
// // // import Modal from '../components/Modal.jsx'
// // // import PurchaseBillModal from '../components/PurchaseBillModal.jsx'
// // // import DatePresets from '../components/DatePresets.jsx'
// // // import { localToday } from '../utils/date.js'
// // // import { useHotkeys } from '../hooks/useHotkeys.js'
// // // import { printNow } from '../utils/print.js'
// // // import { notifyStockChanged } from '../utils/lowStock.js'

// // // // Purchases = the VENDOR ACCOUNT BOOK (client's requirement):
// // // //  • New Bill: pick a vendor, type the product types that came (qty + that type's total) —
// // // //    or just the bill amount — optionally add them to Inventory stock, optionally pay now.
// // // //  • Vendors & Ledger: like credit customers — each vendor's bills (+), payments (−) and
// // // //    balance; pay any amount any time from Cash in Hand or Online (bank).
// // // //  • Bill History: every bill, by date.
// // // // Payments reduce the Dashboard's Cash in Hand / Bank-Online card and the Sales card.

// // // const fmt = (n) =>
// // //   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
// // // const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
// // // let keySeq = 0
// // // const blankLine = () => ({ key: ++keySeq, description: '', quantity: '', lineTotal: '', itemId: '' })
// // // const blankVendor = { name: '', telephone: '', address: '', gstRegNo: '', ntn: '', openingBalance: '' }

// // // export default function Purchases() {
// // //   const { session } = useAuth()
// // //   const uid = session?.id
// // //   const [view, setView] = useState('bill') // 'bill' | 'ledger' | 'history'
// // //   const [vendors, setVendors] = useState([])
// // //   const [accounts, setAccounts] = useState([])
// // //   const [items, setItems] = useState([])
// // //   const [error, setError] = useState('')
// // //   const [notice, setNotice] = useState('')
// // //   const [busy, setBusy] = useState(false)

// // //   // ── new bill ──
// // //   const [vendorId, setVendorId] = useState('')
// // //   const [billDate, setBillDate] = useState(localToday())
// // //   const [vendorBillNo, setVendorBillNo] = useState('')
// // //   const [mode, setMode] = useState('lines') // 'lines' | 'amount'
// // //   const [lines, setLines] = useState([blankLine()])
// // //   const [billAmount, setBillAmount] = useState('')
// // //   const [addToStock, setAddToStock] = useState(false)
// // //   // Owner's rule: saving a bill only RECORDS it. Money moves only if "Pay now" is chosen
// // //   // on purpose (or later from Vendors & Ledger → Pay vendor). Default is always 'none'.
// // //   const [payMode, setPayMode] = useState('none') // 'none' | 'pay'
// // //   const [payNow, setPayNow] = useState('')
// // //   const [payVia, setPayVia] = useState('cash') // 'cash' | 'bank'
// // //   const [remarks, setRemarks] = useState('')

// // //   // ── vendors & ledger ──
// // //   const [selVendor, setSelVendor] = useState(null)
// // //   const [vSearch, setVSearch] = useState('')
// // //   const [owesOnly, setOwesOnly] = useState(false)
// // //   const [ledger, setLedger] = useState(null)
// // //   const [lFrom, setLFrom] = useState('')
// // //   const [lTo, setLTo] = useState('')
// // //   const [openBill, setOpenBill] = useState(null) // ledger row whose lines are expanded

// // //   // ── history ──
// // //   const [hFrom, setHFrom] = useState(localToday().slice(0, 8) + '01')
// // //   const [hTo, setHTo] = useState(localToday())
// // //   const [hSearch, setHSearch] = useState('')
// // //   const [bills, setBills] = useState({ rows: [], total: 0 })
// // //   const [openBillId, setOpenBillId] = useState(null) // bill window (view / edit / return)

// // //   // ── modals ──
// // //   const [vendorModal, setVendorModal] = useState(null) // { mode: 'create'|'edit', form }
// // //   const [payModal, setPayModal] = useState(null) // { amount, via, date, note }

// // //   const firstLineRef = useRef(null)
// // //   const vSearchRef = useRef(null)

// // //   const cashAcct = accounts.find((a) => a.type === 'cash')
// // //   const bankAcct = accounts.find((a) => a.type === 'bank')
// // //   const acctFor = (via) => (via === 'bank' ? bankAcct : cashAcct)

// // //   // Each new message restarts the timer — otherwise an earlier message's timer (e.g.
// // //   // "Vendor added") wiped a newer one ("Bill saved") after a second or two.
// // //   const noticeTimer = useRef(null)
// // //   // Warn before paying more than the account holds (it would go negative).
// // //   const confirmFunds = (via, amount) => {
// // //     const acct = acctFor(via)
// // //     const bal = Number(acct?.current_balance) || 0
// // //     if (amount <= bal + 0.009) return true
// // //     return window.confirm(
// // //       `${via === 'bank' ? 'Online (bank)' : 'Cash in Hand'} has only ${fmt(bal)}. ` +
// // //         `Paying ${fmt(amount)} will make it ${fmt(bal - amount)}. Pay anyway?`
// // //     )
// // //   }

// // //   const flash = (msg) => {
// // //     setNotice(msg)
// // //     clearTimeout(noticeTimer.current)
// // //     noticeTimer.current = setTimeout(() => setNotice(''), 8000)
// // //   }
// // //   useEffect(() => () => clearTimeout(noticeTimer.current), [])

// // //   const loadRefs = useCallback(async () => {
// // //     const [v, a] = await Promise.all([purchasesApi.vendors(), purchasesApi.accounts()])
// // //     setVendors(v)
// // //     setAccounts(a)
// // //   }, [])
// // //   useEffect(() => {
// // //     loadRefs().catch((e) => setError(e.message))
// // //   }, [loadRefs])

// // //   // Inventory items are only needed when the owner wants this bill to add stock
// // //   useEffect(() => {
// // //     if (addToStock && items.length === 0)
// // //       inventoryApi.items.list({}).then(setItems).catch((e) => setError(e.message))
// // //   }, [addToStock, items.length])

// // //   const loadLedger = useCallback(async () => {
// // //     if (!selVendor) return setLedger(null)
// // //     setLedger(
// // //       await purchasesApi.vendorLedger({ actingUserId: uid, vendorId: selVendor, from: lFrom, to: lTo })
// // //     )
// // //   }, [uid, selVendor, lFrom, lTo])
// // //   useEffect(() => {
// // //     loadLedger().catch((e) => setError(e.message))
// // //   }, [loadLedger])

// // //   const loadBills = useCallback(async () => {
// // //     setBills(await purchasesApi.bills({ actingUserId: uid, from: hFrom, to: hTo, search: hSearch }))
// // //   }, [uid, hFrom, hTo, hSearch])
// // //   useEffect(() => {
// // //     if (view === 'history') loadBills().catch((e) => setError(e.message))
// // //   }, [view, loadBills])

// // //   // ── bill maths ──
// // //   const lineRate = (l) => {
// // //     const q = Number(l.quantity) || 0
// // //     const t = Number(l.lineTotal) || 0
// // //     return q > 0 && t > 0 ? r2(t / q) : 0
// // //   }
// // //   const billTotal =
// // //     mode === 'lines'
// // //       ? r2(lines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0))
// // //       : r2(Number(billAmount) || 0)
// // //   const vendor = vendors.find((v) => String(v.id) === String(vendorId))
// // //   const owedBefore = Number(vendor?.current_balance) || 0
// // //   const payAmt = payMode === 'pay' ? r2(Number(payNow) || 0) : 0
// // //   const owedAfter = r2(owedBefore + billTotal - payAmt)

// // //   const setLine = (key, field, value) =>
// // //     setLines((p) => p.map((l) => (l.key === key ? { ...l, [field]: value } : l)))
// // //   const addLine = () => setLines((p) => [...p, blankLine()])
// // //   const removeLine = (key) =>
// // //     setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : [blankLine()]))

// // //   const resetBill = () => {
// // //     setLines([blankLine()])
// // //     setBillAmount('')
// // //     setVendorBillNo('')
// // //     setPayNow('')
// // //     setPayMode('none') // next bill starts as "save only" again
// // //     setRemarks('')
// // //     setAddToStock(false)
// // //     setBillDate(localToday())
// // //   }

// // //   const saveBill = async (allowDuplicateBillNo = false) => {
// // //     if (busy) return
// // //     setError('')
// // //     if (!vendorId) return setError('Select the vendor first (or add a new one with +).')
// // //     if (billTotal <= 0) return setError('Add product types with their total, or enter the bill amount.')
// // //     if (payMode === 'pay' && payAmt <= 0)
// // //       return setError('Enter the amount to pay now — or choose "Save only — pay later".')
// // //     if (payAmt > 0 && !acctFor(payVia)) return setError('No account found for this payment type.')
// // //     if (!allowDuplicateBillNo && payAmt > 0 && !confirmFunds(payVia, payAmt)) return
// // //     setBusy(true)
// // //     let askDuplicate = null
// // //     try {
// // //       const res = await purchasesApi.createBill({
// // //         actingUserId: uid,
// // //         vendorId: Number(vendorId),
// // //         billDate,
// // //         vendorBillNo,
// // //         allowDuplicateBillNo,
// // //         lines:
// // //           mode === 'lines'
// // //             ? lines.map((l) => ({
// // //                 description: l.description,
// // //                 quantity: Number(l.quantity) || 0,
// // //                 lineTotal: Number(l.lineTotal) || 0,
// // //                 itemId: addToStock && l.itemId ? Number(l.itemId) : null
// // //               }))
// // //             : [],
// // //         billAmount: mode === 'amount' ? billTotal : 0,
// // //         addToStock: mode === 'lines' && addToStock,
// // //         payNow: payAmt,
// // //         accountId: payAmt > 0 ? acctFor(payVia).id : null,
// // //         remarks
// // //       })
// // //       flash(
// // //         `Bill ${res.serial} saved — ${fmt(res.total)} added to ${vendor.name}.` +
// // //           (res.payment ? ` Paid ${fmt(res.payment.amount)} from ${res.payment.account}.` : '') +
// // //           (res.stockAdded ? ' Stock updated.' : '')
// // //       )
// // //       if (res.stockAdded) notifyStockChanged()
// // //       resetBill()
// // //       await loadRefs()
// // //       if (String(selVendor) === String(vendorId)) loadLedger()
// // //     } catch (e) {
// // //       const m = /^DUPLICATE_VENDOR_BILL:(.*)$/.exec(e.message || '')
// // //       if (m) askDuplicate = m[1]
// // //       else setError(e.message)
// // //     } finally {
// // //       setBusy(false)
// // //     }
// // //     // Same vendor bill number already recorded (e.g. PO-0003) — ask before saving it twice
// // //     if (
// // //       askDuplicate &&
// // //       window.confirm(
// // //         `Vendor bill # "${vendorBillNo}" is already recorded for this vendor (${askDuplicate}).\n` +
// // //           'Is this really a different bill? OK = save it anyway, Cancel = don\'t save.'
// // //       )
// // //     )
// // //       saveBill(true)
// // //   }

// // //   // ── vendors ──
// // //   const saveVendor = async () => {
// // //     const f = vendorModal.form
// // //     if (!f.name.trim()) return setError('Vendor name is required.')
// // //     setBusy(true)
// // //     setError('')
// // //     try {
// // //       if (vendorModal.mode === 'create') {
// // //         const r = await purchasesApi.createVendor({ ...f, openingBalance: Number(f.openingBalance) || 0 })
// // //         await loadRefs()
// // //         setVendorId(String(r.id))
// // //         if (view === 'ledger') setSelVendor(r.id)
// // //         flash(`Vendor "${f.name.trim()}" added.`)
// // //       } else {
// // //         await purchasesApi.updateVendor({ actingUserId: uid, id: vendorModal.id, ...f })
// // //         await loadRefs()
// // //         loadLedger()
// // //         flash('Vendor details saved.')
// // //       }
// // //       setVendorModal(null)
// // //     } catch (e) {
// // //       setError(e.message)
// // //     } finally {
// // //       setBusy(false)
// // //     }
// // //   }

// // //   const openPay = () => {
// // //     setError('')
// // //     setPayModal({ mode: 'pay', amount: '', via: 'cash', date: localToday(), note: '' })
// // //   }
// // //   // Vendor owes US (balance below 0, e.g. after a return) and pays it back
// // //   const openReceive = () => {
// // //     setError('')
// // //     setPayModal({ mode: 'receive', amount: '', via: 'cash', date: localToday(), note: '' })
// // //   }
// // //   const savePay = async () => {
// // //     const amt = r2(Number(payModal.amount) || 0)
// // //     if (amt <= 0) return setError('Enter the amount paid.')
// // //     const acct = acctFor(payModal.via)
// // //     if (!acct) return setError('No account found for this payment type.')
// // //     if (payModal.mode === 'receive') {
// // //       setBusy(true)
// // //       setError('')
// // //       try {
// // //         const r = await purchasesApi.receiveFromVendor({
// // //           actingUserId: uid,
// // //           vendorId: selVendor,
// // //           amount: amt,
// // //           accountId: acct.id,
// // //           date: payModal.date,
// // //           note: payModal.note
// // //         })
// // //         flash(`${r.voucherNo}: received ${fmt(r.amount)} from ${ledger.vendor.name} into ${r.account}.`)
// // //         setPayModal(null)
// // //         await loadRefs()
// // //         await loadLedger()
// // //       } catch (e) {
// // //         setError(e.message)
// // //       } finally {
// // //         setBusy(false)
// // //       }
// // //       return
// // //     }
// // //     // hard rule first (more than owed), the "cash will go minus — pay anyway?" question after
// // //     const owed = Number(ledger?.vendor?.current_balance) || 0
// // //     if (amt > owed + 0.009)
// // //       return setError(
// // //         `Payment is more than the balance owed to ${ledger.vendor.name} (${fmt(owed)}).`
// // //       )
// // //     if (!confirmFunds(payModal.via, amt)) return
// // //     setBusy(true)
// // //     setError('')
// // //     try {
// // //       const r = await purchasesApi.payVendor({
// // //         actingUserId: uid,
// // //         vendorId: selVendor,
// // //         amount: amt,
// // //         accountId: acct.id,
// // //         date: payModal.date,
// // //         note: payModal.note
// // //       })
// // //       flash(`${r.voucherNo}: paid ${fmt(r.amount)} to ${ledger.vendor.name} from ${r.account}.`)
// // //       setPayModal(null)
// // //       await loadRefs()
// // //       await loadLedger()
// // //     } catch (e) {
// // //       setError(e.message)
// // //     } finally {
// // //       setBusy(false)
// // //     }
// // //   }

// // //   const removePayment = async (row) => {
// // //     const msg =
// // //       row.type === 'refund'
// // //         ? `Delete ${row.voucherNo} — ${fmt(row.bill)} received from the vendor? The money leaves ${row.account} again and the vendor owes you again.`
// // //         : `Delete payment ${row.voucherNo} of ${fmt(row.paid)}? The money goes back to ${row.account} and the vendor balance goes up again.`
// // //     if (!window.confirm(msg)) return
// // //     setBusy(true)
// // //     try {
// // //       await purchasesApi.deleteVendorPayment({ actingUserId: uid, voucherId: row.voucherId })
// // //       await loadRefs()
// // //       await loadLedger()
// // //       flash('Payment deleted.')
// // //     } catch (e) {
// // //       setError(e.message)
// // //     } finally {
// // //       setBusy(false)
// // //     }
// // //   }
// // //   const removeBill = async (id, label, stockAdded) => {
// // //     if (!window.confirm(`Delete bill ${label}? The vendor balance goes down by its amount.${stockAdded ? ' The stock it added is taken back out.' : ''}`)) return
// // //     setBusy(true)
// // //     try {
// // //       await purchasesApi.deleteBill({ actingUserId: uid, id })
// // //       if (stockAdded) notifyStockChanged()
// // //       setOpenBillId(null)
// // //       await loadRefs()
// // //       await loadLedger()
// // //       if (view === 'history') await loadBills()
// // //       flash(`Bill ${label} deleted.`)
// // //     } catch (e) {
// // //       setError(e.message)
// // //     } finally {
// // //       setBusy(false)
// // //     }
// // //   }
// // //   const showBill = (id) => setOpenBillId(id)
// // //   // after an edit / return inside the bill window: refresh balances, ledger and history
// // //   const onBillChanged = async (msg) => {
// // //     if (msg) flash(msg)
// // //     await loadRefs()
// // //     await loadLedger()
// // //     if (view === 'history') await loadBills()
// // //   }
// // //   const removeReturn = async (row) => {
// // //     if (!window.confirm(`Delete return ${row.returnNo}? Everything it changed is reversed.`)) return
// // //     setBusy(true)
// // //     try {
// // //       await purchasesApi.deleteReturn({ actingUserId: uid, id: row.returnId })
// // //       await onBillChanged(`Return ${row.returnNo} deleted.`)
// // //     } catch (e) {
// // //       setError(e.message)
// // //     } finally {
// // //       setBusy(false)
// // //     }
// // //   }

// // //   const vendorList = useMemo(() => {
// // //     const q = vSearch.trim().toLowerCase()
// // //     return vendors
// // //       .filter((v) => !owesOnly || Number(v.current_balance) > 0.009)
// // //       .filter((v) => !q || v.name.toLowerCase().includes(q) || String(v.code).includes(q) || String(v.telephone || '').includes(q))
// // //       .sort((a, b) => Number(b.current_balance) - Number(a.current_balance) || a.name.localeCompare(b.name))
// // //   }, [vendors, vSearch, owesOnly])
// // //   const totalOwed = vendors.reduce((s, v) => s + Math.max(0, Number(v.current_balance) || 0), 0)

// // //   useHotkeys(
// // //     {
// // //       f9: () => {
// // //         if (payModal) savePay()
// // //         else if (vendorModal) saveVendor()
// // //         else if (view === 'bill') saveBill()
// // //       },
// // //       f5: () => {
// // //         loadRefs()
// // //         if (view === 'ledger') loadLedger()
// // //         if (view === 'history') loadBills()
// // //       },
// // //       f2: () => {
// // //         if (view === 'ledger') vSearchRef.current?.focus()
// // //         else firstLineRef.current?.focus()
// // //       },
// // //       f6: () => {
// // //         if (payModal && ledger)
// // //           setPayModal((pm) => ({
// // //             ...pm,
// // //             amount: String(
// // //               pm.mode === 'receive'
// // //                 ? Math.abs(Math.min(0, ledger.vendor.current_balance))
// // //                 : Math.max(0, ledger.vendor.current_balance)
// // //             )
// // //           }))
// // //       },
// // //       'alt+1': () => setView('bill'),
// // //       'alt+2': () => setView('ledger'),
// // //       'alt+3': () => setView('history'),
// // //       escape: () => {
// // //         if (payModal) setPayModal(null)
// // //         else if (vendorModal) setVendorModal(null)
// // //         else if (openBillId) setOpenBillId(null)
// // //       }
// // //     },
// // //     [view, payModal, vendorModal, openBillId, busy, lines, vendorId, billDate, vendorBillNo, mode, billAmount, addToStock, payNow, payVia, remarks, ledger, selVendor]
// // //   )

// // //   const vendorField = (label, key, props = {}) => (
// // //     <label className="field">
// // //       <span>{label}</span>
// // //       <input
// // //         value={vendorModal.form[key]}
// // //         onChange={(e) => {
// // //           const val = e.target.value
// // //           setVendorModal((m) => ({ ...m, form: { ...m.form, [key]: val } }))
// // //         }}
// // //         {...props}
// // //       />
// // //     </label>
// // //   )

// // //   return (
// // //     <div className="purchase-page">
// // //       <div className="po-tabs">
// // //         {[
// // //           ['bill', 'New Bill', 'plus'],
// // //           ['ledger', 'Vendors & Ledger', 'book'],
// // //           ['history', 'Bill History', 'receipt']
// // //         ].map(([k, label, icon], i) => (
// // //           <button
// // //             key={k}
// // //             type="button"
// // //             className={'po-tab' + (view === k ? ' active' : '')}
// // //             onClick={() => setView(k)}
// // //             title={`Alt+${i + 1}`}
// // //           >
// // //             <Icon name={icon} size={15} /> {label}
// // //           </button>
// // //         ))}
// // //         <span className="pv-owed">
// // //           Owed to all vendors: <strong>{fmt(totalOwed)}</strong>
// // //         </span>
// // //       </div>

// // //       {notice && <div className="inv-notice">{notice}</div>}
// // //       {/* the payment dialog shows its own error — not twice */}
// // //       {error && !payModal && (
// // //         <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
// // //           {error}
// // //         </div>
// // //       )}

// // //       {/* ═════════════ NEW BILL ═════════════ */}
// // //       {view === 'bill' && (
// // //         <div className="panel pv-bill">
// // //           <div className="pv-row">
// // //             <label className="field pv-vendor">
// // //               <span>Vendor</span>
// // //               <div className="pv-inline">
// // //                 <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
// // //                   <option value="">— select vendor —</option>
// // //                   {vendors.map((v) => (
// // //                     <option key={v.id} value={v.id}>
// // //                       {v.name} {v.telephone ? `· ${v.telephone}` : ''}
// // //                     </option>
// // //                   ))}
// // //                 </select>
// // //                 <button
// // //                   type="button"
// // //                   className="btn-sm primary"
// // //                   title="Add a new vendor"
// // //                   onClick={() => setVendorModal({ mode: 'create', form: { ...blankVendor } })}
// // //                 >
// // //                   <Icon name="plus" size={14} /> New vendor
// // //                 </button>
// // //               </div>
// // //             </label>
// // //             <label className="field">
// // //               <span>Bill date</span>
// // //               <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
// // //             </label>
// // //             <label className="field">
// // //               <span>Vendor's bill no. (optional)</span>
// // //               <input value={vendorBillNo} onChange={(e) => setVendorBillNo(e.target.value)} placeholder="e.g. 4521" />
// // //             </label>
// // //           </div>

// // //           {vendor && (
// // //             <div className="pv-vcard">
// // //               <strong>{vendor.name}</strong>
// // //               {vendor.telephone && <span>☎ {vendor.telephone}</span>}
// // //               {vendor.address && <span>{vendor.address}</span>}
// // //               <span className="pv-vbal">
// // //                 Owed now: <strong>{fmt(owedBefore)}</strong>
// // //               </span>
// // //             </div>
// // //           )}

// // //           <div className="po-tabs pv-mode">
// // //             <button
// // //               type="button"
// // //               className={'po-tab' + (mode === 'lines' ? ' active' : '')}
// // //               onClick={() => setMode('lines')}
// // //             >
// // //               Product types
// // //             </button>
// // //             <button
// // //               type="button"
// // //               className={'po-tab' + (mode === 'amount' ? ' active' : '')}
// // //               onClick={() => setMode('amount')}
// // //             >
// // //               Bill amount only
// // //             </button>
// // //             {mode === 'lines' && (
// // //               <label className="bc-check pv-stock" title="Also add these quantities to Inventory stock">
// // //                 <input type="checkbox" checked={addToStock} onChange={(e) => setAddToStock(e.target.checked)} />{' '}
// // //                 Add to Inventory stock
// // //               </label>
// // //             )}
// // //           </div>

// // //           {mode === 'lines' ? (
// // //             <div className="table-scroll pv-lines">
// // //               <table className="data-table">
// // //                 <thead>
// // //                   <tr>
// // //                     <th style={{ width: 36 }}>#</th>
// // //                     <th>Product type</th>
// // //                     {addToStock && <th>Inventory item (for stock)</th>}
// // //                     <th className="num" style={{ width: 110 }}>Qty</th>
// // //                     <th className="num" style={{ width: 150 }}>Total price</th>
// // //                     <th className="num" style={{ width: 120 }}>Per piece</th>
// // //                     <th style={{ width: 40 }}></th>
// // //                   </tr>
// // //                 </thead>
// // //                 <tbody>
// // //                   {lines.map((l, i) => (
// // //                     <tr key={l.key}>
// // //                       <td>{i + 1}</td>
// // //                       <td>
// // //                         <input
// // //                           ref={i === 0 ? firstLineRef : undefined}
// // //                           className="pv-in"
// // //                           value={l.description}
// // //                           placeholder="e.g. Kids shirts"
// // //                           onChange={(e) => setLine(l.key, 'description', e.target.value)}
// // //                         />
// // //                       </td>
// // //                       {addToStock && (
// // //                         <td>
// // //                           <select
// // //                             className="pv-in"
// // //                             value={l.itemId}
// // //                             onChange={(e) => setLine(l.key, 'itemId', e.target.value)}
// // //                           >
// // //                             <option value="">— not in stock —</option>
// // //                             {items.map((it) => (
// // //                               <option key={it.id} value={it.id}>
// // //                                 {it.item_code} · {it.name}
// // //                               </option>
// // //                             ))}
// // //                           </select>
// // //                         </td>
// // //                       )}
// // //                       <td className="num">
// // //                         <input
// // //                           className="pv-in num"
// // //                           type="number"
// // //                           min="0"
// // //                           value={l.quantity}
// // //                           onChange={(e) => setLine(l.key, 'quantity', e.target.value)}
// // //                         />
// // //                       </td>
// // //                       <td className="num">
// // //                         <input
// // //                           className="pv-in num"
// // //                           type="number"
// // //                           min="0"
// // //                           value={l.lineTotal}
// // //                           onChange={(e) => setLine(l.key, 'lineTotal', e.target.value)}
// // //                           onKeyDown={(e) => {
// // //                             if (e.key === 'Enter' && i === lines.length - 1) {
// // //                               e.preventDefault()
// // //                               addLine()
// // //                             }
// // //                           }}
// // //                         />
// // //                       </td>
// // //                       <td className="num muted-text">{lineRate(l) ? fmt(lineRate(l)) : '—'}</td>
// // //                       <td>
// // //                         <button type="button" className="btn-icon danger" title="Remove line" onClick={() => removeLine(l.key)}>
// // //                           <Icon name="x" size={14} />
// // //                         </button>
// // //                       </td>
// // //                     </tr>
// // //                   ))}
// // //                 </tbody>
// // //               </table>
// // //               <button type="button" className="btn-sm ghost" onClick={addLine} style={{ margin: 8 }}>
// // //                 <Icon name="plus" size={14} /> Add product type
// // //               </button>
// // //             </div>
// // //           ) : (
// // //             <label className="field" style={{ maxWidth: 320 }}>
// // //               <span>Bill amount</span>
// // //               <input type="number" min="0" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="e.g. 200000" />
// // //             </label>
// // //           )}

// // //           <div className="pv-foot">
// // //             <div className="pv-pay">
// // //               <span className="field-label">Payment</span>
// // //               <div className="pay-type-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}>
// // //                 <button
// // //                   type="button"
// // //                   className={'pay-type-btn' + (payMode === 'none' ? ' active pv-record' : '')}
// // //                   onClick={() => setPayMode('none')}
// // //                 >
// // //                   Save only — pay later
// // //                 </button>
// // //                 <button
// // //                   type="button"
// // //                   className={'pay-type-btn' + (payMode === 'pay' ? ' active online' : '')}
// // //                   onClick={() => setPayMode('pay')}
// // //                 >
// // //                   Pay now
// // //                 </button>
// // //               </div>
// // //               {payMode === 'none' ? (
// // //                 <p className="muted-text pv-hint">
// // //                   Only the bill is recorded — the vendor's balance goes up, no money leaves Cash in Hand or
// // //                   Online. Pay any time later from <strong>Vendors &amp; Ledger → Pay vendor</strong>.
// // //                 </p>
// // //               ) : (
// // //                 <div className="pv-inline">
// // //                   <div className="pay-type-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)', minWidth: 220 }}>
// // //                     <button type="button" className={'pay-type-btn' + (payVia === 'cash' ? ' active cash' : '')} onClick={() => setPayVia('cash')}>
// // //                       Cash in Hand
// // //                     </button>
// // //                     <button type="button" className={'pay-type-btn' + (payVia === 'bank' ? ' active online' : '')} onClick={() => setPayVia('bank')}>
// // //                       Online
// // //                     </button>
// // //                   </div>
// // //                   <input type="number" min="0" autoFocus value={payNow} onChange={(e) => setPayNow(e.target.value)} placeholder="Amount" className="pv-amount" />
// // //                   <button type="button" className="btn-sm ghost" onClick={() => setPayNow(String(billTotal))} disabled={!billTotal}>
// // //                     Pay full
// // //                   </button>
// // //                 </div>
// // //               )}
// // //               <input
// // //                 className="pv-remarks"
// // //                 value={remarks}
// // //                 onChange={(e) => setRemarks(e.target.value)}
// // //                 placeholder="Remarks (optional)"
// // //               />
// // //             </div>
// // //             <div className="totals pv-totals">
// // //               <div className="tot-row">
// // //                 <span>Bill total</span>
// // //                 <strong>{fmt(billTotal)}</strong>
// // //               </div>
// // //               {vendor && (
// // //                 <>
// // //                   <div className="tot-row">
// // //                     <span>Owed before</span>
// // //                     <span>{fmt(owedBefore)}</span>
// // //                   </div>
// // //                   {payMode === 'pay' && (
// // //                     <div className="tot-row">
// // //                       <span>Paid now ({payVia === 'bank' ? 'Online' : 'Cash in Hand'})</span>
// // //                       <span className="neg">−{fmt(payAmt)}</span>
// // //                     </div>
// // //                   )}
// // //                   <div className="tot-row">
// // //                     <span>Owed after this bill</span>
// // //                     <strong className={owedAfter > 0 ? 'neg' : 'pos'}>{fmt(owedAfter)}</strong>
// // //                   </div>
// // //                 </>
// // //               )}
// // //               <button type="button" className="btn-primary" onClick={() => saveBill()} disabled={busy} title="Save (F9)">
// // //                 {busy
// // //                   ? 'Saving…'
// // //                   : payMode === 'pay' && payAmt > 0
// // //                     ? `Save & pay ${fmt(payAmt)} from ${payVia === 'bank' ? 'Online' : 'Cash in Hand'} (F9)`
// // //                     : 'Save bill (no payment) (F9)'}
// // //               </button>
// // //             </div>
// // //           </div>
// // //         </div>
// // //       )}

// // //       {/* ═════════════ VENDORS & LEDGER ═════════════ */}
// // //       {view === 'ledger' && (
// // //         <div className="credit-body">
// // //           <div className="inv-pane">
// // //             <div className="inv-pane-head">
// // //               <span>Vendors</span>
// // //               <label className="bc-check" title="Only vendors we still owe">
// // //                 <input type="checkbox" checked={owesOnly} onChange={(e) => setOwesOnly(e.target.checked)} /> We owe
// // //               </label>
// // //             </div>
// // //             <div className="search-box" style={{ margin: 8 }}>
// // //               <Icon name="search" size={15} />
// // //               <input ref={vSearchRef} placeholder="Search name / code / phone (F2)" value={vSearch} onChange={(e) => setVSearch(e.target.value)} />
// // //             </div>
// // //             <button
// // //               type="button"
// // //               className="btn-sm ghost"
// // //               style={{ margin: '0 8px 6px' }}
// // //               onClick={() => setVendorModal({ mode: 'create', form: { ...blankVendor } })}
// // //             >
// // //               <Icon name="plus" size={14} /> New vendor
// // //             </button>
// // //             <div className="inv-list">
// // //               {vendorList.length === 0 && <div className="inv-empty">No vendors</div>}
// // //               {vendorList.map((v) => (
// // //                 <div
// // //                   key={v.id}
// // //                   tabIndex={0}
// // //                   data-nav-item
// // //                   className={'inv-list-item' + (selVendor === v.id ? ' active' : '')}
// // //                   onClick={() => setSelVendor(v.id)}
// // //                   onKeyDown={(e) => e.key === 'Enter' && setSelVendor(v.id)}
// // //                 >
// // //                   <div className="ili-text">
// // //                     <strong>{v.name}</strong>
// // //                     <span>
// // //                       {v.code}
// // //                       {v.telephone ? ` · ${v.telephone}` : ''}
// // //                     </span>
// // //                   </div>
// // //                   <span className="owe-amt">{Number(v.current_balance) > 0.009 ? fmt(v.current_balance) : '—'}</span>
// // //                 </div>
// // //               ))}
// // //             </div>
// // //           </div>

// // //           <div className="panel credit-detail" id="vendor-ledger">
// // //             {!ledger ? (
// // //               <div className="inv-empty" style={{ margin: 'auto' }}>
// // //                 Select a vendor to see their bills, payments and balance
// // //               </div>
// // //             ) : (
// // //               <>
// // //                 <div className="cd-head">
// // //                   <div>
// // //                     <h3>
// // //                       {ledger.vendor.name} <span className="muted-text">· {ledger.vendor.code}</span>
// // //                     </h3>
// // //                     <div className="cd-balance">
// // //                       {ledger.vendor.telephone && <>☎ {ledger.vendor.telephone} · </>}
// // //                       {ledger.vendor.address || 'no address'}
// // //                     </div>
// // //                     <div className="cd-balance">
// // //                       {Number(ledger.vendor.current_balance) < -0.009 ? (
// // //                         <>
// // //                           Vendor owes YOU (advance): <strong className="pos">{fmt(-ledger.vendor.current_balance)}</strong>
// // //                         </>
// // //                       ) : (
// // //                         <>
// // //                           Balance we owe: <strong>{fmt(ledger.vendor.current_balance)}</strong>
// // //                         </>
// // //                       )}
// // //                     </div>
// // //                   </div>
// // //                   <div className="pv-inline">
// // //                     {Number(ledger.vendor.current_balance) < -0.009 ? (
// // //                       <button type="button" className="btn-sm primary" onClick={openReceive} title="The vendor owes you — record the money they pay back">
// // //                         <Icon name="wallet" size={14} /> Receive from vendor
// // //                       </button>
// // //                     ) : (
// // //                       <button type="button" className="btn-sm primary" onClick={openPay} disabled={Number(ledger.vendor.current_balance) <= 0}>
// // //                         <Icon name="wallet" size={14} /> Pay vendor
// // //                       </button>
// // //                     )}
// // //                     <button
// // //                       type="button"
// // //                       className="btn-sm ghost"
// // //                       onClick={() => {
// // //                         setVendorId(String(ledger.vendor.id))
// // //                         setView('bill')
// // //                       }}
// // //                     >
// // //                       <Icon name="plus" size={14} /> New bill
// // //                     </button>
// // //                     <button
// // //                       type="button"
// // //                       className="btn-sm ghost"
// // //                       onClick={() =>
// // //                         setVendorModal({
// // //                           mode: 'edit',
// // //                           id: ledger.vendor.id,
// // //                           form: {
// // //                             name: ledger.vendor.name || '',
// // //                             telephone: ledger.vendor.telephone || '',
// // //                             address: ledger.vendor.address || '',
// // //                             gstRegNo: ledger.vendor.gst_reg_no || '',
// // //                             ntn: ledger.vendor.ntn || '',
// // //                             openingBalance: ''
// // //                           }
// // //                         })
// // //                       }
// // //                     >
// // //                       Edit
// // //                     </button>
// // //                     <button type="button" className="btn-sm ghost" onClick={() => printNow()} title="Print this ledger">
// // //                       <Icon name="printer" size={14} /> Print
// // //                     </button>
// // //                   </div>
// // //                 </div>

// // //                 <div className="report-bar" style={{ marginBottom: 8 }}>
// // //                   <div className="rb-dates">
// // //                     <label>
// // //                       From <input type="date" value={lFrom} onChange={(e) => setLFrom(e.target.value)} />
// // //                     </label>
// // //                     <label>
// // //                       To <input type="date" value={lTo} onChange={(e) => setLTo(e.target.value)} />
// // //                     </label>
// // //                     <DatePresets
// // //                       from={lFrom}
// // //                       to={lTo}
// // //                       onChange={(r) => {
// // //                         setLFrom(r.from)
// // //                         setLTo(r.to)
// // //                       }}
// // //                     />
// // //                   </div>
// // //                 </div>

// // //                 <div className="report-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
// // //                   <div className="rc-card">
// // //                     <span>Opening</span>
// // //                     <strong>{fmt(ledger.opening)}</strong>
// // //                   </div>
// // //                   <div className="rc-card">
// // //                     <span>Bills (+)</span>
// // //                     <strong>{fmt(ledger.totals.billed)}</strong>
// // //                   </div>
// // //                   <div className="rc-card">
// // //                     <span>Paid (−)</span>
// // //                     <strong className="pos">{fmt(ledger.totals.paid)}</strong>
// // //                   </div>
// // //                   <div className="rc-card amber">
// // //                     <span>Balance</span>
// // //                     <strong>{fmt(ledger.totals.closing)}</strong>
// // //                   </div>
// // //                 </div>

// // //                 <div className="table-scroll">
// // //                   <table className="data-table">
// // //                     <thead>
// // //                       <tr>
// // //                         <th>Date</th>
// // //                         <th>Ref</th>
// // //                         <th>Details</th>
// // //                         <th className="num">Bill (+)</th>
// // //                         <th className="num">Paid (−)</th>
// // //                         <th className="num">Balance</th>
// // //                         <th></th>
// // //                       </tr>
// // //                     </thead>
// // //                     <tbody>
// // //                       <tr className="pv-opening">
// // //                         <td colSpan="5">Opening balance</td>
// // //                         <td className="num strong">{fmt(ledger.opening)}</td>
// // //                         <td></td>
// // //                       </tr>
// // //                       {ledger.rows.length === 0 && (
// // //                         <tr>
// // //                           <td colSpan="7" className="empty">
// // //                             No bills or payments in these dates
// // //                           </td>
// // //                         </tr>
// // //                       )}
// // //                       {ledger.rows.map((r) => (
// // //                         <FragmentRow key={r.id}>
// // //                           <tr>
// // //                             <td>{r.date}</td>
// // //                             <td>
// // //                               {r.type === 'bill' ? (
// // //                                 <button type="button" className="po-badge ordered pv-badge-btn" title="Open bill (edit / return)" onClick={() => showBill(r.billId)}>
// // //                                   {r.serial || 'BILL'}
// // //                                 </button>
// // //                               ) : r.type === 'payment' ? (
// // //                                 <span className="po-badge received">{r.voucherNo || 'PAID'}</span>
// // //                               ) : r.type === 'return' ? (
// // //                                 <button type="button" className="po-badge cancelled pv-badge-btn" title="Open the bill" onClick={() => showBill(r.returnBillId)}>
// // //                                   {r.returnNo || 'RETURN'}
// // //                                 </button>
// // //                               ) : r.type === 'refund' ? (
// // //                                 <span className="po-badge received">{r.voucherNo || 'REFUND'}</span>
// // //                               ) : (
// // //                                 <span className="po-badge">{r.type}</span>
// // //                               )}
// // //                             </td>
// // //                             <td>
// // //                               {r.type === 'bill' && r.lines?.length > 0 ? (
// // //                                 <button
// // //                                   type="button"
// // //                                   className="pv-link"
// // //                                   onClick={() => setOpenBill(openBill === r.id ? null : r.id)}
// // //                                 >
// // //                                   {openBill === r.id ? '▼' : '▶'} {r.lines.length} product type{r.lines.length > 1 ? 's' : ''}
// // //                                   {r.vendorBillNo ? ` · vendor #${r.vendorBillNo}` : ''}
// // //                                   {r.stockAdded ? ' · stock added' : ''}
// // //                                 </button>
// // //                               ) : r.type === 'payment' ? (
// // //                                 <span>
// // //                                   {r.accountType === 'bank' ? 'Online' : 'Cash in Hand'} · {r.description?.split(' · ').slice(1).join(' · ')}
// // //                                 </span>
// // //                               ) : r.type === 'return' || r.type === 'refund' ? (
// // //                                 <span>{r.description?.split(' · ').slice(1).join(' · ')}</span>
// // //                               ) : (
// // //                                 r.description
// // //                               )}
// // //                             </td>
// // //                             <td className="num">{r.bill ? fmt(r.bill) : ''}</td>
// // //                             <td className="num pos">{r.paid ? fmt(r.paid) : ''}</td>
// // //                             <td className="num strong">{fmt(r.balance)}</td>
// // //                             <td className="num">
// // //                               {r.voucherId && (
// // //                                 <button type="button" className="btn-icon danger" title="Delete this payment" onClick={() => removePayment(r)}>
// // //                                   <Icon name="trash" size={14} />
// // //                                 </button>
// // //                               )}
// // //                               {r.billId && (
// // //                                 <button type="button" className="btn-icon" title="Open bill: edit / return to vendor" onClick={() => showBill(r.billId)}>
// // //                                   <Icon name="edit" size={14} />
// // //                                 </button>
// // //                               )}
// // //                               {r.returnId && (
// // //                                 <button type="button" className="btn-icon danger" title="Delete this return" onClick={() => removeReturn(r)}>
// // //                                   <Icon name="trash" size={14} />
// // //                                 </button>
// // //                               )}
// // //                             </td>
// // //                           </tr>
// // //                           {openBill === r.id &&
// // //                             r.lines.map((l, i) => (
// // //                               <tr key={i} className="pv-subline">
// // //                                 <td></td>
// // //                                 <td></td>
// // //                                 <td>
// // //                                   {l.description} × {l.quantity} @ {fmt(l.rate)}
// // //                                   {l.linked ? ' (in stock)' : ''}
// // //                                 </td>
// // //                                 <td className="num muted-text">{fmt(l.amount)}</td>
// // //                                 <td colSpan="3"></td>
// // //                               </tr>
// // //                             ))}
// // //                         </FragmentRow>
// // //                       ))}
// // //                     </tbody>
// // //                     <tfoot>
// // //                       <tr>
// // //                         <td colSpan="3" className="num strong">
// // //                           Totals
// // //                         </td>
// // //                         <td className="num strong">{fmt(ledger.totals.billed)}</td>
// // //                         <td className="num strong pos">{fmt(ledger.totals.paid)}</td>
// // //                         <td className="num strong">{fmt(ledger.totals.closing)}</td>
// // //                         <td></td>
// // //                       </tr>
// // //                     </tfoot>
// // //                   </table>
// // //                 </div>
// // //               </>
// // //             )}
// // //           </div>
// // //         </div>
// // //       )}

// // //       {/* ═════════════ BILL HISTORY ═════════════ */}
// // //       {view === 'history' && (
// // //         <div className="panel report-table-wrap">
// // //           <div className="report-bar">
// // //             <div className="rb-dates">
// // //               <label>
// // //                 From <input type="date" value={hFrom} onChange={(e) => setHFrom(e.target.value)} />
// // //               </label>
// // //               <label>
// // //                 To <input type="date" value={hTo} onChange={(e) => setHTo(e.target.value)} />
// // //               </label>
// // //               <DatePresets
// // //                 from={hFrom}
// // //                 to={hTo}
// // //                 onChange={(r) => {
// // //                   setHFrom(r.from)
// // //                   setHTo(r.to)
// // //                 }}
// // //               />
// // //             </div>
// // //             <div className="search-box">
// // //               <Icon name="search" size={15} />
// // //               <input placeholder="Vendor / bill no." value={hSearch} onChange={(e) => setHSearch(e.target.value)} />
// // //             </div>
// // //           </div>
// // //           <p className="muted-text" style={{ fontSize: 12, margin: '4px 0 6px' }}>
// // //             {bills.rows.length} bill{bills.rows.length === 1 ? '' : 's'} · {fmt(bills.total)}
// // //           </p>
// // //           <div className="table-scroll">
// // //             <table className="data-table">
// // //               <thead>
// // //                 <tr>
// // //                   <th>Bill</th>
// // //                   <th>Date</th>
// // //                   <th>Vendor</th>
// // //                   <th>Vendor bill #</th>
// // //                   <th className="num">Types</th>
// // //                   <th className="num">Total</th>
// // //                   <th className="num">Paid with bill</th>
// // //                   <th className="num">Returned</th>
// // //                   <th>Stock</th>
// // //                   <th>Edited</th>
// // //                 </tr>
// // //               </thead>
// // //               <tbody>
// // //                 {bills.rows.length === 0 ? (
// // //                   <tr>
// // //                     <td colSpan="10" className="empty">
// // //                       No bills in these dates
// // //                     </td>
// // //                   </tr>
// // //                 ) : (
// // //                   bills.rows.map((b) => (
// // //                     <tr key={b.id} className="clickable" onClick={() => showBill(b.id)}>
// // //                       <td className="strong">{b.serial_no}</td>
// // //                       <td>{b.order_date}</td>
// // //                       <td>{b.vendor || '—'}</td>
// // //                       <td>{b.vendor_bill_no || '—'}</td>
// // //                       <td className="num">{b.line_count || 'amount only'}</td>
// // //                       <td className="num strong">{fmt(b.total)}</td>
// // //                       <td className="num">{Number(b.paid_with_bill) ? fmt(b.paid_with_bill) : '—'}</td>
// // //                       <td className={'num' + (Number(b.returned_value) ? ' neg' : '')}>
// // //                         {Number(b.return_count) ? `${fmt(b.returned_value)} (${b.return_count})` : '—'}
// // //                       </td>
// // //                       <td>{b.adds_stock ? 'added' : '—'}</td>
// // //                       <td>{Number(b.edit_count) ? `${b.edit_count}×` : '—'}</td>
// // //                     </tr>
// // //                   ))
// // //                 )}
// // //               </tbody>
// // //             </table>
// // //           </div>
// // //         </div>
// // //       )}

// // //       {/* ═════════════ MODALS ═════════════ */}
// // //       {vendorModal && (
// // //         <Modal
// // //           title={vendorModal.mode === 'create' ? 'New vendor' : 'Edit vendor'}
// // //           onClose={() => setVendorModal(null)}
// // //           footer={
// // //             <>
// // //               <button className="btn-secondary" onClick={() => setVendorModal(null)}>
// // //                 Cancel
// // //               </button>
// // //               <button className="btn-primary" onClick={saveVendor} disabled={busy}>
// // //                 Save (F9)
// // //               </button>
// // //             </>
// // //           }
// // //         >
// // //           {vendorField('Name *', 'name', { autoFocus: true })}
// // //           <div className="field-row">
// // //             {vendorField('Contact number', 'telephone')}
// // //             {vendorField('GST reg. no.', 'gstRegNo')}
// // //           </div>
// // //           {vendorField('Address', 'address')}
// // //           <div className="field-row">
// // //             {vendorField('NTN', 'ntn')}
// // //             {vendorModal.mode === 'create' &&
// // //               vendorField('Old balance we owe (optional)', 'openingBalance', { type: 'number', min: 0 })}
// // //           </div>
// // //         </Modal>
// // //       )}

// // //       {payModal && ledger && (
// // //         <Modal
// // //           title={
// // //             payModal.mode === 'receive'
// // //               ? `Receive money from ${ledger.vendor.name}`
// // //               : `Pay ${ledger.vendor.name}`
// // //           }
// // //           onClose={() => setPayModal(null)}
// // //           footer={
// // //             <>
// // //               <button className="btn-secondary" onClick={() => setPayModal(null)}>
// // //                 Cancel
// // //               </button>
// // //               <button className="btn-primary" onClick={savePay} disabled={busy}>
// // //                 {busy
// // //                   ? 'Saving…'
// // //                   : payModal.mode === 'receive'
// // //                     ? 'Save received money (F9)'
// // //                     : 'Save payment (F9)'}
// // //               </button>
// // //             </>
// // //           }
// // //         >
// // //           {error && <div className="login-error">{error}</div>}
// // //           <p className="muted-text" style={{ marginTop: 0 }}>
// // //             {payModal.mode === 'receive' ? (
// // //               <>
// // //                 {ledger.vendor.name} owes you:{' '}
// // //                 <strong>{fmt(Math.abs(Number(ledger.vendor.current_balance)))}</strong>
// // //               </>
// // //             ) : (
// // //               <>
// // //                 Balance we owe: <strong>{fmt(ledger.vendor.current_balance)}</strong>
// // //               </>
// // //             )}
// // //           </p>
// // //           <div className="field">
// // //             <span className="field-label">
// // //               {payModal.mode === 'receive' ? 'Received into' : 'Pay from'}
// // //             </span>
// // //             <div className="pay-type-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
// // //               <button type="button" className={'pay-type-btn' + (payModal.via === 'cash' ? ' active cash' : '')} onClick={() => setPayModal((pm) => ({ ...pm, via: 'cash' }))}>
// // //                 Cash in Hand
// // //               </button>
// // //               <button type="button" className={'pay-type-btn' + (payModal.via === 'bank' ? ' active online' : '')} onClick={() => setPayModal((pm) => ({ ...pm, via: 'bank' }))}>
// // //                 Online
// // //               </button>
// // //             </div>
// // //           </div>
// // //           <div className="field-row">
// // //             <label className="field">
// // //               <span>
// // //                 Amount <em className="hint-em">(F6 = full balance)</em>
// // //               </span>
// // //               <input
// // //                 type="number"
// // //                 min="0"
// // //                 autoFocus
// // //                 value={payModal.amount}
// // //                 onChange={(e) => setPayModal((pm) => ({ ...pm, amount: e.target.value }))}
// // //                 onKeyDown={(e) => e.key === 'Enter' && savePay()}
// // //               />
// // //             </label>
// // //             <label className="field">
// // //               <span>Date</span>
// // //               <input type="date" value={payModal.date} onChange={(e) => setPayModal((pm) => ({ ...pm, date: e.target.value }))} />
// // //             </label>
// // //           </div>
// // //           <label className="field">
// // //             <span>Note (optional)</span>
// // //             <input value={payModal.note} onChange={(e) => setPayModal((pm) => ({ ...pm, note: e.target.value }))} />
// // //           </label>
// // //           {Number(payModal.amount) > 0 && payModal.mode !== 'receive' && (
// // //             <p className="muted-text">
// // //               Balance after payment: <strong>{fmt(r2(Number(ledger.vendor.current_balance) - Number(payModal.amount)))}</strong>
// // //             </p>
// // //           )}
// // //           {Number(payModal.amount) > 0 && payModal.mode === 'receive' && (
// // //             <p className="muted-text">
// // //               Vendor will still owe you:{' '}
// // //               <strong>
// // //                 {fmt(Math.max(0, r2(Math.abs(Number(ledger.vendor.current_balance)) - Number(payModal.amount))))}
// // //               </strong>
// // //             </p>
// // //           )}
// // //         </Modal>
// // //       )}

// // //       {openBillId && (
// // //         <PurchaseBillModal
// // //           billId={openBillId}
// // //           uid={uid}
// // //           accounts={accounts}
// // //           onClose={() => setOpenBillId(null)}
// // //           onChanged={onBillChanged}
// // //           onDelete={(b) => {
// // //             // say what blocks it BEFORE asking "Delete?" (was: confirm first, then refuse);
// // //             // a returned message is shown inside the bill dialog
// // //             if (b.payments?.length)
// // //               return `This bill has a payment made with it — delete that payment first (vendor ledger).`
// // //             if (b.returns?.length)
// // //               return 'This bill has returns to the vendor — delete those returns first.'
// // //             removeBill(b.id, b.serial_no, !!b.adds_stock)
// // //           }}
// // //         />
// // //       )}

// // //       <div className="hotkey-hint">
// // //         <span>
// // //           <kbd>Alt</kbd>+<kbd>1/2/3</kbd> Tabs
// // //         </span>
// // //         <span>
// // //           <kbd>F2</kbd> Search / first line
// // //         </span>
// // //         <span>
// // //           <kbd>F9</kbd> Save
// // //         </span>
// // //         <span>
// // //           <kbd>F6</kbd> Full balance (pay)
// // //         </span>
// // //         <span>
// // //           <kbd>F5</kbd> Refresh
// // //         </span>
// // //         <span>
// // //           <kbd>Esc</kbd> Close
// // //         </span>
// // //       </div>
// // //     </div>
// // //   )
// // // }

// // // // Groups a ledger row with its expanded product lines (keys stay on the outer element).
// // // function FragmentRow({ children }) {
// // //   return <>{children}</>
// // // }

// // import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
// // import { purchasesApi, inventoryApi } from '../api/ipc.js'
// // import { useAuth } from '../context/AuthContext.jsx'
// // import Icon from '../components/Icons.jsx'
// // import Modal from '../components/Modal.jsx'
// // import PurchaseBillModal from '../components/PurchaseBillModal.jsx'
// // import ProductHistoryModal from '../components/ProductHistoryModal.jsx'
// // import DatePresets from '../components/DatePresets.jsx'
// // import { localToday } from '../utils/date.js'
// // import { useHotkeys } from '../hooks/useHotkeys.js'
// // import { printNow } from '../utils/print.js'
// // import { notifyStockChanged } from '../utils/lowStock.js'

// // // Purchases = the VENDOR ACCOUNT BOOK (client's requirement):
// // //  • New Bill: pick a vendor, type the product types that came (qty + that type's total) —
// // //    or just the bill amount — optionally add them to Inventory stock, optionally pay now.
// // //  • Vendors & Ledger: like credit customers — each vendor's bills (+), payments (−) and
// // //    balance; pay any amount any time from Cash in Hand or Online (bank).
// // //  • Bill History: every bill, by date.
// // // Payments reduce the Dashboard's Cash in Hand / Bank-Online card and the Sales card.

// // const fmt = (n) =>
// //   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
// // const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
// // let keySeq = 0
// // const blankLine = () => ({
// //   key: ++keySeq,
// //   description: '',
// //   quantity: '',
// //   lineTotal: '',
// //   itemId: ''
// // })
// // const blankVendor = {
// //   name: '',
// //   telephone: '',
// //   address: '',
// //   gstRegNo: '',
// //   ntn: '',
// //   openingBalance: ''
// // }

// // export default function Purchases() {
// //   const { session } = useAuth()
// //   const uid = session?.id
// //   const [view, setView] = useState('bill') // 'bill' | 'ledger' | 'history'
// //   const [vendors, setVendors] = useState([])
// //   const [accounts, setAccounts] = useState([])
// //   const [items, setItems] = useState([])
// //   const [error, setError] = useState('')
// //   const [notice, setNotice] = useState('')
// //   const [busy, setBusy] = useState(false)

// //   // ── new bill ──
// //   const [vendorId, setVendorId] = useState('')
// //   const [billDate, setBillDate] = useState(localToday())
// //   const [vendorBillNo, setVendorBillNo] = useState('')
// //   const [mode, setMode] = useState('lines') // 'lines' | 'amount'
// //   const [lines, setLines] = useState([blankLine()])
// //   const [billAmount, setBillAmount] = useState('')
// //   const [addToStock, setAddToStock] = useState(false)
// //   // Owner's rule: saving a bill only RECORDS it. Money moves only if "Pay now" is chosen
// //   // on purpose (or later from Vendors & Ledger → Pay vendor). Default is always 'none'.
// //   const [payMode, setPayMode] = useState('none') // 'none' | 'pay'
// //   const [payNow, setPayNow] = useState('')
// //   const [payVia, setPayVia] = useState('cash') // 'cash' | 'bank'
// //   const [remarks, setRemarks] = useState('')

// //   // ── vendors & ledger ──
// //   const [selVendor, setSelVendor] = useState(null)
// //   const [vSearch, setVSearch] = useState('')
// //   const [owesOnly, setOwesOnly] = useState(false)
// //   const [ledger, setLedger] = useState(null)
// //   const [lFrom, setLFrom] = useState('')
// //   const [lTo, setLTo] = useState('')
// //   const [openBill, setOpenBill] = useState(null) // ledger row whose lines are expanded

// //   // ── history ──
// //   const [hFrom, setHFrom] = useState(localToday().slice(0, 8) + '01')
// //   const [hTo, setHTo] = useState(localToday())
// //   const [hSearch, setHSearch] = useState('')
// //   const [bills, setBills] = useState({ rows: [], total: 0 })
// //   const [openBillId, setOpenBillId] = useState(null) // bill window (view / edit / return)

// //   // ── modals ──
// //   const [vendorModal, setVendorModal] = useState(null) // { mode: 'create'|'edit', form }
// //   const [payModal, setPayModal] = useState(null) // { amount, via, date, note }
// //   // Product Stock & Purchase History modal (self-contained component).
// //   const [stockPriceModal, setStockPriceModal] = useState(false)

// //   const firstLineRef = useRef(null)
// //   const vSearchRef = useRef(null)

// //   const cashAcct = accounts.find((a) => a.type === 'cash')
// //   const bankAcct = accounts.find((a) => a.type === 'bank')
// //   const acctFor = (via) => (via === 'bank' ? bankAcct : cashAcct)

// //   // Each new message restarts the timer — otherwise an earlier message's timer (e.g.
// //   // "Vendor added") wiped a newer one ("Bill saved") after a second or two.
// //   const noticeTimer = useRef(null)
// //   // Warn before paying more than the account holds (it would go negative).
// //   const confirmFunds = (via, amount) => {
// //     const acct = acctFor(via)
// //     const bal = Number(acct?.current_balance) || 0
// //     if (amount <= bal + 0.009) return true
// //     return window.confirm(
// //       `${via === 'bank' ? 'Online (bank)' : 'Cash in Hand'} has only ${fmt(bal)}. ` +
// //         `Paying ${fmt(amount)} will make it ${fmt(bal - amount)}. Pay anyway?`
// //     )
// //   }

// //   const flash = (msg) => {
// //     setNotice(msg)
// //     clearTimeout(noticeTimer.current)
// //     noticeTimer.current = setTimeout(() => setNotice(''), 8000)
// //   }
// //   useEffect(() => () => clearTimeout(noticeTimer.current), [])

// //   const loadRefs = useCallback(async () => {
// //     const [v, a] = await Promise.all([
// //       purchasesApi.vendors(),
// //       purchasesApi.accounts()
// //     ])
// //     setVendors(v)
// //     setAccounts(a)
// //   }, [])
// //   useEffect(() => {
// //     loadRefs().catch((e) => setError(e.message))
// //   }, [loadRefs])

// //   // Inventory items are only needed when the owner wants this bill to add stock
// //   useEffect(() => {
// //     if (addToStock && items.length === 0)
// //       inventoryApi.items
// //         .list({})
// //         .then(setItems)
// //         .catch((e) => setError(e.message))
// //   }, [addToStock, items.length])

// //   const loadLedger = useCallback(async () => {
// //     if (!selVendor) return setLedger(null)
// //     setLedger(
// //       await purchasesApi.vendorLedger({
// //         actingUserId: uid,
// //         vendorId: selVendor,
// //         from: lFrom,
// //         to: lTo
// //       })
// //     )
// //   }, [uid, selVendor, lFrom, lTo])
// //   useEffect(() => {
// //     loadLedger().catch((e) => setError(e.message))
// //   }, [loadLedger])

// //   const loadBills = useCallback(async () => {
// //     setBills(
// //       await purchasesApi.bills({
// //         actingUserId: uid,
// //         from: hFrom,
// //         to: hTo,
// //         search: hSearch
// //       })
// //     )
// //   }, [uid, hFrom, hTo, hSearch])
// //   useEffect(() => {
// //     if (view === 'history') loadBills().catch((e) => setError(e.message))
// //   }, [view, loadBills])

// //   // ── bill maths ──
// //   const lineRate = (l) => {
// //     const q = Number(l.quantity) || 0
// //     const t = Number(l.lineTotal) || 0
// //     return q > 0 && t > 0 ? r2(t / q) : 0
// //   }
// //   const billTotal =
// //     mode === 'lines'
// //       ? r2(lines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0))
// //       : r2(Number(billAmount) || 0)
// //   const vendor = vendors.find((v) => String(v.id) === String(vendorId))
// //   const owedBefore = Number(vendor?.current_balance) || 0
// //   const payAmt = payMode === 'pay' ? r2(Number(payNow) || 0) : 0
// //   const owedAfter = r2(owedBefore + billTotal - payAmt)

// //   const setLine = (key, field, value) =>
// //     setLines((p) =>
// //       p.map((l) => (l.key === key ? { ...l, [field]: value } : l))
// //     )
// //   const addLine = () => setLines((p) => [...p, blankLine()])
// //   const removeLine = (key) =>
// //     setLines((p) =>
// //       p.length > 1 ? p.filter((l) => l.key !== key) : [blankLine()]
// //     )

// //   const resetBill = () => {
// //     setLines([blankLine()])
// //     setBillAmount('')
// //     setVendorBillNo('')
// //     setPayNow('')
// //     setPayMode('none') // next bill starts as "save only" again
// //     setRemarks('')
// //     setAddToStock(false)
// //     setBillDate(localToday())
// //   }

// //   const saveBill = async (allowDuplicateBillNo = false) => {
// //     if (busy) return
// //     setError('')
// //     if (!vendorId)
// //       return setError('Select the vendor first (or add a new one with +).')
// //     if (billTotal <= 0)
// //       return setError(
// //         'Add product types with their total, or enter the bill amount.'
// //       )
// //     if (payMode === 'pay' && payAmt <= 0)
// //       return setError(
// //         'Enter the amount to pay now — or choose "Save only — pay later".'
// //       )
// //     if (payAmt > 0 && !acctFor(payVia))
// //       return setError('No account found for this payment type.')
// //     if (!allowDuplicateBillNo && payAmt > 0 && !confirmFunds(payVia, payAmt))
// //       return
// //     setBusy(true)
// //     let askDuplicate = null
// //     try {
// //       const res = await purchasesApi.createBill({
// //         actingUserId: uid,
// //         vendorId: Number(vendorId),
// //         billDate,
// //         vendorBillNo,
// //         allowDuplicateBillNo,
// //         lines:
// //           mode === 'lines'
// //             ? lines.map((l) => ({
// //                 description: l.description,
// //                 quantity: Number(l.quantity) || 0,
// //                 lineTotal: Number(l.lineTotal) || 0,
// //                 itemId: addToStock && l.itemId ? Number(l.itemId) : null
// //               }))
// //             : [],
// //         billAmount: mode === 'amount' ? billTotal : 0,
// //         addToStock: mode === 'lines' && addToStock,
// //         payNow: payAmt,
// //         accountId: payAmt > 0 ? acctFor(payVia).id : null,
// //         remarks
// //       })
// //       flash(
// //         `Bill ${res.serial} saved — ${fmt(res.total)} added to ${vendor.name}.` +
// //           (res.payment
// //             ? ` Paid ${fmt(res.payment.amount)} from ${res.payment.account}.`
// //             : '') +
// //           (res.stockAdded ? ' Stock updated.' : '')
// //       )
// //       if (res.stockAdded) notifyStockChanged()
// //       resetBill()
// //       await loadRefs()
// //       if (String(selVendor) === String(vendorId)) loadLedger()
// //     } catch (e) {
// //       const m = /^DUPLICATE_VENDOR_BILL:(.*)$/.exec(e.message || '')
// //       if (m) askDuplicate = m[1]
// //       else setError(e.message)
// //     } finally {
// //       setBusy(false)
// //     }
// //     // Same vendor bill number already recorded (e.g. PO-0003) — ask before saving it twice
// //     if (
// //       askDuplicate &&
// //       window.confirm(
// //         `Vendor bill # "${vendorBillNo}" is already recorded for this vendor (${askDuplicate}).\n` +
// //           "Is this really a different bill? OK = save it anyway, Cancel = don't save."
// //       )
// //     )
// //       saveBill(true)
// //   }

// //   // ── vendors ──
// //   const saveVendor = async () => {
// //     const f = vendorModal.form
// //     if (!f.name.trim()) return setError('Vendor name is required.')
// //     setBusy(true)
// //     setError('')
// //     try {
// //       if (vendorModal.mode === 'create') {
// //         const r = await purchasesApi.createVendor({
// //           ...f,
// //           openingBalance: Number(f.openingBalance) || 0
// //         })
// //         await loadRefs()
// //         setVendorId(String(r.id))
// //         if (view === 'ledger') setSelVendor(r.id)
// //         flash(`Vendor "${f.name.trim()}" added.`)
// //       } else {
// //         await purchasesApi.updateVendor({
// //           actingUserId: uid,
// //           id: vendorModal.id,
// //           ...f
// //         })
// //         await loadRefs()
// //         loadLedger()
// //         flash('Vendor details saved.')
// //       }
// //       setVendorModal(null)
// //     } catch (e) {
// //       setError(e.message)
// //     } finally {
// //       setBusy(false)
// //     }
// //   }

// //   const openPay = () => {
// //     setError('')
// //     setPayModal({
// //       mode: 'pay',
// //       amount: '',
// //       via: 'cash',
// //       date: localToday(),
// //       note: ''
// //     })
// //   }
// //   // Vendor owes US (balance below 0, e.g. after a return) and pays it back
// //   const openReceive = () => {
// //     setError('')
// //     setPayModal({
// //       mode: 'receive',
// //       amount: '',
// //       via: 'cash',
// //       date: localToday(),
// //       note: ''
// //     })
// //   }
// //   const savePay = async () => {
// //     const amt = r2(Number(payModal.amount) || 0)
// //     if (amt <= 0) return setError('Enter the amount paid.')
// //     const acct = acctFor(payModal.via)
// //     if (!acct) return setError('No account found for this payment type.')
// //     if (payModal.mode === 'receive') {
// //       setBusy(true)
// //       setError('')
// //       try {
// //         const r = await purchasesApi.receiveFromVendor({
// //           actingUserId: uid,
// //           vendorId: selVendor,
// //           amount: amt,
// //           accountId: acct.id,
// //           date: payModal.date,
// //           note: payModal.note
// //         })
// //         flash(
// //           `${r.voucherNo}: received ${fmt(r.amount)} from ${ledger.vendor.name} into ${r.account}.`
// //         )
// //         setPayModal(null)
// //         await loadRefs()
// //         await loadLedger()
// //       } catch (e) {
// //         setError(e.message)
// //       } finally {
// //         setBusy(false)
// //       }
// //       return
// //     }
// //     // hard rule first (more than owed), the "cash will go minus — pay anyway?" question after
// //     const owed = Number(ledger?.vendor?.current_balance) || 0
// //     if (amt > owed + 0.009)
// //       return setError(
// //         `Payment is more than the balance owed to ${ledger.vendor.name} (${fmt(owed)}).`
// //       )
// //     if (!confirmFunds(payModal.via, amt)) return
// //     setBusy(true)
// //     setError('')
// //     try {
// //       const r = await purchasesApi.payVendor({
// //         actingUserId: uid,
// //         vendorId: selVendor,
// //         amount: amt,
// //         accountId: acct.id,
// //         date: payModal.date,
// //         note: payModal.note
// //       })
// //       flash(
// //         `${r.voucherNo}: paid ${fmt(r.amount)} to ${ledger.vendor.name} from ${r.account}.`
// //       )
// //       setPayModal(null)
// //       await loadRefs()
// //       await loadLedger()
// //     } catch (e) {
// //       setError(e.message)
// //     } finally {
// //       setBusy(false)
// //     }
// //   }

// //   const removePayment = async (row) => {
// //     const msg =
// //       row.type === 'refund'
// //         ? `Delete ${row.voucherNo} — ${fmt(row.bill)} received from the vendor? The money leaves ${row.account} again and the vendor owes you again.`
// //         : `Delete payment ${row.voucherNo} of ${fmt(row.paid)}? The money goes back to ${row.account} and the vendor balance goes up again.`
// //     if (!window.confirm(msg)) return
// //     setBusy(true)
// //     try {
// //       await purchasesApi.deleteVendorPayment({
// //         actingUserId: uid,
// //         voucherId: row.voucherId
// //       })
// //       await loadRefs()
// //       await loadLedger()
// //       flash('Payment deleted.')
// //     } catch (e) {
// //       setError(e.message)
// //     } finally {
// //       setBusy(false)
// //     }
// //   }
// //   const removeBill = async (id, label, stockAdded) => {
// //     if (
// //       !window.confirm(
// //         `Delete bill ${label}? The vendor balance goes down by its amount.${stockAdded ? ' The stock it added is taken back out.' : ''}`
// //       )
// //     )
// //       return
// //     setBusy(true)
// //     try {
// //       await purchasesApi.deleteBill({ actingUserId: uid, id })
// //       if (stockAdded) notifyStockChanged()
// //       setOpenBillId(null)
// //       await loadRefs()
// //       await loadLedger()
// //       if (view === 'history') await loadBills()
// //       flash(`Bill ${label} deleted.`)
// //     } catch (e) {
// //       setError(e.message)
// //     } finally {
// //       setBusy(false)
// //     }
// //   }
// //   const showBill = (id) => setOpenBillId(id)
// //   // after an edit / return inside the bill window: refresh balances, ledger and history
// //   const onBillChanged = async (msg) => {
// //     if (msg) flash(msg)
// //     await loadRefs()
// //     await loadLedger()
// //     if (view === 'history') await loadBills()
// //   }
// //   const removeReturn = async (row) => {
// //     if (
// //       !window.confirm(
// //         `Delete return ${row.returnNo}? Everything it changed is reversed.`
// //       )
// //     )
// //       return
// //     setBusy(true)
// //     try {
// //       await purchasesApi.deleteReturn({ actingUserId: uid, id: row.returnId })
// //       await onBillChanged(`Return ${row.returnNo} deleted.`)
// //     } catch (e) {
// //       setError(e.message)
// //     } finally {
// //       setBusy(false)
// //     }
// //   }

// //   const vendorList = useMemo(() => {
// //     const q = vSearch.trim().toLowerCase()
// //     return vendors
// //       .filter((v) => !owesOnly || Number(v.current_balance) > 0.009)
// //       .filter(
// //         (v) =>
// //           !q ||
// //           v.name.toLowerCase().includes(q) ||
// //           String(v.code).includes(q) ||
// //           String(v.telephone || '').includes(q)
// //       )
// //       .sort(
// //         (a, b) =>
// //           Number(b.current_balance) - Number(a.current_balance) ||
// //           a.name.localeCompare(b.name)
// //       )
// //   }, [vendors, vSearch, owesOnly])
// //   const totalOwed = vendors.reduce(
// //     (s, v) => s + Math.max(0, Number(v.current_balance) || 0),
// //     0
// //   )

// //   useHotkeys(
// //     {
// //       f9: () => {
// //         if (payModal) savePay()
// //         else if (vendorModal) saveVendor()
// //         else if (!stockPriceModal && view === 'bill') saveBill()
// //       },
// //       f5: () => {
// //         loadRefs()
// //         if (view === 'ledger') loadLedger()
// //         if (view === 'history') loadBills()
// //       },
// //       f2: () => {
// //         if (view === 'ledger') vSearchRef.current?.focus()
// //         else firstLineRef.current?.focus()
// //       },
// //       f6: () => {
// //         if (payModal && ledger)
// //           setPayModal((pm) => ({
// //             ...pm,
// //             amount: String(
// //               pm.mode === 'receive'
// //                 ? Math.abs(Math.min(0, ledger.vendor.current_balance))
// //                 : Math.max(0, ledger.vendor.current_balance)
// //             )
// //           }))
// //       },
// //       'alt+1': () => setView('bill'),
// //       'alt+2': () => setView('ledger'),
// //       'alt+3': () => setView('history'),
// //       escape: () => {
// //         if (stockPriceModal) setStockPriceModal(false)
// //         else if (payModal) setPayModal(null)
// //         else if (vendorModal) setVendorModal(null)
// //         else if (openBillId) setOpenBillId(null)
// //       }
// //     },
// //     [
// //       view,
// //       payModal,
// //       vendorModal,
// //       openBillId,
// //       busy,
// //       lines,
// //       vendorId,
// //       billDate,
// //       vendorBillNo,
// //       mode,
// //       billAmount,
// //       addToStock,
// //       payNow,
// //       payVia,
// //       remarks,
// //       ledger,
// //       selVendor,
// //       stockPriceModal
// //     ]
// //   )

// //   const vendorField = (label, key, props = {}) => (
// //     <label className="field">
// //       <span>{label}</span>
// //       <input
// //         value={vendorModal.form[key]}
// //         onChange={(e) => {
// //           const val = e.target.value
// //           setVendorModal((m) => ({ ...m, form: { ...m.form, [key]: val } }))
// //         }}
// //         {...props}
// //       />
// //     </label>
// //   )

// //   return (
// //     <div className="purchase-page">
// //       <div className="po-tabs">
// //         {[
// //           ['bill', 'New Bill', 'plus'],
// //           ['ledger', 'Vendors & Ledger', 'book'],
// //           ['history', 'Bill History', 'receipt']
// //         ].map(([k, label, icon], i) => (
// //           <button
// //             key={k}
// //             type="button"
// //             className={'po-tab' + (view === k ? ' active' : '')}
// //             onClick={() => setView(k)}
// //             title={`Alt+${i + 1}`}
// //           >
// //             <Icon name={icon} size={15} /> {label}
// //           </button>
// //         ))}
// //         <span className="pv-owed">
// //           Owed to all vendors: <strong>{fmt(totalOwed)}</strong>
// //         </span>
// //         <button
// //           type="button"
// //           className="btn-sm ghost"
// //           onClick={() => setStockPriceModal(true)}
// //           title="See one product's full purchase & stock history, and adjust stock / prices"
// //         >
// //           <Icon name="book" size={14} /> Product Stock &amp; Purchase History
// //         </button>
// //       </div>

// //       {notice && <div className="inv-notice">{notice}</div>}
// //       {/* the payment dialog shows its own error — not twice */}
// //       {error && !payModal && (
// //         <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
// //           {error}
// //         </div>
// //       )}

// //       {/* ═════════════ NEW BILL ═════════════ */}
// //       {view === 'bill' && (
// //         <div className="panel pv-bill">
// //           <div className="pv-row">
// //             <label className="field pv-vendor">
// //               <span>Vendor</span>
// //               <div className="pv-inline">
// //                 <select
// //                   value={vendorId}
// //                   onChange={(e) => setVendorId(e.target.value)}
// //                 >
// //                   <option value="">— select vendor —</option>
// //                   {vendors.map((v) => (
// //                     <option key={v.id} value={v.id}>
// //                       {v.name} {v.telephone ? `· ${v.telephone}` : ''}
// //                     </option>
// //                   ))}
// //                 </select>
// //                 <button
// //                   type="button"
// //                   className="btn-sm primary"
// //                   title="Add a new vendor"
// //                   onClick={() =>
// //                     setVendorModal({ mode: 'create', form: { ...blankVendor } })
// //                   }
// //                 >
// //                   <Icon name="plus" size={14} /> New vendor
// //                 </button>
// //               </div>
// //             </label>
// //             <label className="field">
// //               <span>Bill date</span>
// //               <input
// //                 type="date"
// //                 value={billDate}
// //                 onChange={(e) => setBillDate(e.target.value)}
// //               />
// //             </label>
// //             <label className="field">
// //               <span>Vendor's bill no. (optional)</span>
// //               <input
// //                 value={vendorBillNo}
// //                 onChange={(e) => setVendorBillNo(e.target.value)}
// //                 placeholder="e.g. 4521"
// //               />
// //             </label>
// //           </div>

// //           {vendor && (
// //             <div className="pv-vcard">
// //               <strong>{vendor.name}</strong>
// //               {vendor.telephone && <span>☎ {vendor.telephone}</span>}
// //               {vendor.address && <span>{vendor.address}</span>}
// //               <span className="pv-vbal">
// //                 Owed now: <strong>{fmt(owedBefore)}</strong>
// //               </span>
// //             </div>
// //           )}

// //           <div className="po-tabs pv-mode">
// //             <button
// //               type="button"
// //               className={'po-tab' + (mode === 'lines' ? ' active' : '')}
// //               onClick={() => setMode('lines')}
// //             >
// //               Product types
// //             </button>
// //             <button
// //               type="button"
// //               className={'po-tab' + (mode === 'amount' ? ' active' : '')}
// //               onClick={() => setMode('amount')}
// //             >
// //               Bill amount only
// //             </button>
// //             {mode === 'lines' && (
// //               <label
// //                 className="bc-check pv-stock"
// //                 title="Also add these quantities to Inventory stock"
// //               >
// //                 <input
// //                   type="checkbox"
// //                   checked={addToStock}
// //                   onChange={(e) => setAddToStock(e.target.checked)}
// //                 />{' '}
// //                 Add to Inventory stock
// //               </label>
// //             )}
// //           </div>

// //           {mode === 'lines' ? (
// //             <div className="table-scroll pv-lines">
// //               <table className="data-table">
// //                 <thead>
// //                   <tr>
// //                     <th style={{ width: 36 }}>#</th>
// //                     <th>Product type</th>
// //                     {addToStock && <th>Inventory item (for stock)</th>}
// //                     <th className="num" style={{ width: 110 }}>
// //                       Qty
// //                     </th>
// //                     <th className="num" style={{ width: 150 }}>
// //                       Total price
// //                     </th>
// //                     <th className="num" style={{ width: 120 }}>
// //                       Per piece
// //                     </th>
// //                     <th style={{ width: 40 }}></th>
// //                   </tr>
// //                 </thead>
// //                 <tbody>
// //                   {lines.map((l, i) => (
// //                     <tr key={l.key}>
// //                       <td>{i + 1}</td>
// //                       <td>
// //                         <input
// //                           ref={i === 0 ? firstLineRef : undefined}
// //                           className="pv-in"
// //                           value={l.description}
// //                           placeholder="e.g. Kids shirts"
// //                           onChange={(e) =>
// //                             setLine(l.key, 'description', e.target.value)
// //                           }
// //                         />
// //                       </td>
// //                       {addToStock && (
// //                         <td>
// //                           <select
// //                             className="pv-in"
// //                             value={l.itemId}
// //                             onChange={(e) =>
// //                               setLine(l.key, 'itemId', e.target.value)
// //                             }
// //                           >
// //                             <option value="">— not in stock —</option>
// //                             {items.map((it) => (
// //                               <option key={it.id} value={it.id}>
// //                                 {it.item_code} · {it.name}
// //                               </option>
// //                             ))}
// //                           </select>
// //                         </td>
// //                       )}
// //                       <td className="num">
// //                         <input
// //                           className="pv-in num"
// //                           type="number"
// //                           min="0"
// //                           value={l.quantity}
// //                           onChange={(e) =>
// //                             setLine(l.key, 'quantity', e.target.value)
// //                           }
// //                         />
// //                       </td>
// //                       <td className="num">
// //                         <input
// //                           className="pv-in num"
// //                           type="number"
// //                           min="0"
// //                           value={l.lineTotal}
// //                           onChange={(e) =>
// //                             setLine(l.key, 'lineTotal', e.target.value)
// //                           }
// //                           onKeyDown={(e) => {
// //                             if (e.key === 'Enter' && i === lines.length - 1) {
// //                               e.preventDefault()
// //                               addLine()
// //                             }
// //                           }}
// //                         />
// //                       </td>
// //                       <td className="num muted-text">
// //                         {lineRate(l) ? fmt(lineRate(l)) : '—'}
// //                       </td>
// //                       <td>
// //                         <button
// //                           type="button"
// //                           className="btn-icon danger"
// //                           title="Remove line"
// //                           onClick={() => removeLine(l.key)}
// //                         >
// //                           <Icon name="x" size={14} />
// //                         </button>
// //                       </td>
// //                     </tr>
// //                   ))}
// //                 </tbody>
// //               </table>
// //               <button
// //                 type="button"
// //                 className="btn-sm ghost"
// //                 onClick={addLine}
// //                 style={{ margin: 8 }}
// //               >
// //                 <Icon name="plus" size={14} /> Add product type
// //               </button>
// //             </div>
// //           ) : (
// //             <label className="field" style={{ maxWidth: 320 }}>
// //               <span>Bill amount</span>
// //               <input
// //                 type="number"
// //                 min="0"
// //                 value={billAmount}
// //                 onChange={(e) => setBillAmount(e.target.value)}
// //                 placeholder="e.g. 200000"
// //               />
// //             </label>
// //           )}

// //           <div className="pv-foot">
// //             <div className="pv-pay">
// //               <span className="field-label">Payment</span>
// //               <div
// //                 className="pay-type-group"
// //                 style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}
// //               >
// //                 <button
// //                   type="button"
// //                   className={
// //                     'pay-type-btn' +
// //                     (payMode === 'none' ? ' active pv-record' : '')
// //                   }
// //                   onClick={() => setPayMode('none')}
// //                 >
// //                   Save only — pay later
// //                 </button>
// //                 <button
// //                   type="button"
// //                   className={
// //                     'pay-type-btn' + (payMode === 'pay' ? ' active online' : '')
// //                   }
// //                   onClick={() => setPayMode('pay')}
// //                 >
// //                   Pay now
// //                 </button>
// //               </div>
// //               {payMode === 'none' ? (
// //                 <p className="muted-text pv-hint">
// //                   Only the bill is recorded — the vendor's balance goes up, no
// //                   money leaves Cash in Hand or Online. Pay any time later from{' '}
// //                   <strong>Vendors &amp; Ledger → Pay vendor</strong>.
// //                 </p>
// //               ) : (
// //                 <div className="pv-inline">
// //                   <div
// //                     className="pay-type-group"
// //                     style={{
// //                       gridTemplateColumns: 'repeat(2, 1fr)',
// //                       minWidth: 220
// //                     }}
// //                   >
// //                     <button
// //                       type="button"
// //                       className={
// //                         'pay-type-btn' +
// //                         (payVia === 'cash' ? ' active cash' : '')
// //                       }
// //                       onClick={() => setPayVia('cash')}
// //                     >
// //                       Cash in Hand
// //                     </button>
// //                     <button
// //                       type="button"
// //                       className={
// //                         'pay-type-btn' +
// //                         (payVia === 'bank' ? ' active online' : '')
// //                       }
// //                       onClick={() => setPayVia('bank')}
// //                     >
// //                       Online
// //                     </button>
// //                   </div>
// //                   <input
// //                     type="number"
// //                     min="0"
// //                     autoFocus
// //                     value={payNow}
// //                     onChange={(e) => setPayNow(e.target.value)}
// //                     placeholder="Amount"
// //                     className="pv-amount"
// //                   />
// //                   <button
// //                     type="button"
// //                     className="btn-sm ghost"
// //                     onClick={() => setPayNow(String(billTotal))}
// //                     disabled={!billTotal}
// //                   >
// //                     Pay full
// //                   </button>
// //                 </div>
// //               )}
// //               <input
// //                 className="pv-remarks"
// //                 value={remarks}
// //                 onChange={(e) => setRemarks(e.target.value)}
// //                 placeholder="Remarks (optional)"
// //               />
// //             </div>
// //             <div className="totals pv-totals">
// //               <div className="tot-row">
// //                 <span>Bill total</span>
// //                 <strong>{fmt(billTotal)}</strong>
// //               </div>
// //               {vendor && (
// //                 <>
// //                   <div className="tot-row">
// //                     <span>Owed before</span>
// //                     <span>{fmt(owedBefore)}</span>
// //                   </div>
// //                   {payMode === 'pay' && (
// //                     <div className="tot-row">
// //                       <span>
// //                         Paid now (
// //                         {payVia === 'bank' ? 'Online' : 'Cash in Hand'})
// //                       </span>
// //                       <span className="neg">−{fmt(payAmt)}</span>
// //                     </div>
// //                   )}
// //                   <div className="tot-row">
// //                     <span>Owed after this bill</span>
// //                     <strong className={owedAfter > 0 ? 'neg' : 'pos'}>
// //                       {fmt(owedAfter)}
// //                     </strong>
// //                   </div>
// //                 </>
// //               )}
// //               <button
// //                 type="button"
// //                 className="btn-primary"
// //                 onClick={() => saveBill()}
// //                 disabled={busy}
// //                 title="Save (F9)"
// //               >
// //                 {busy
// //                   ? 'Saving…'
// //                   : payMode === 'pay' && payAmt > 0
// //                     ? `Save & pay ${fmt(payAmt)} from ${payVia === 'bank' ? 'Online' : 'Cash in Hand'} (F9)`
// //                     : 'Save bill (no payment) (F9)'}
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       )}

// //       {/* ═════════════ VENDORS & LEDGER ═════════════ */}
// //       {view === 'ledger' && (
// //         <div className="credit-body">
// //           <div className="inv-pane">
// //             <div className="inv-pane-head">
// //               <span>Vendors</span>
// //               <label className="bc-check" title="Only vendors we still owe">
// //                 <input
// //                   type="checkbox"
// //                   checked={owesOnly}
// //                   onChange={(e) => setOwesOnly(e.target.checked)}
// //                 />{' '}
// //                 We owe
// //               </label>
// //             </div>
// //             <div className="search-box" style={{ margin: 8 }}>
// //               <Icon name="search" size={15} />
// //               <input
// //                 ref={vSearchRef}
// //                 placeholder="Search name / code / phone (F2)"
// //                 value={vSearch}
// //                 onChange={(e) => setVSearch(e.target.value)}
// //               />
// //             </div>
// //             <button
// //               type="button"
// //               className="btn-sm ghost"
// //               style={{ margin: '0 8px 6px' }}
// //               onClick={() =>
// //                 setVendorModal({ mode: 'create', form: { ...blankVendor } })
// //               }
// //             >
// //               <Icon name="plus" size={14} /> New vendor
// //             </button>
// //             <div className="inv-list">
// //               {vendorList.length === 0 && (
// //                 <div className="inv-empty">No vendors</div>
// //               )}
// //               {vendorList.map((v) => (
// //                 <div
// //                   key={v.id}
// //                   tabIndex={0}
// //                   data-nav-item
// //                   className={
// //                     'inv-list-item' + (selVendor === v.id ? ' active' : '')
// //                   }
// //                   onClick={() => setSelVendor(v.id)}
// //                   onKeyDown={(e) => e.key === 'Enter' && setSelVendor(v.id)}
// //                 >
// //                   <div className="ili-text">
// //                     <strong>{v.name}</strong>
// //                     <span>
// //                       {v.code}
// //                       {v.telephone ? ` · ${v.telephone}` : ''}
// //                     </span>
// //                   </div>
// //                   <span className="owe-amt">
// //                     {Number(v.current_balance) > 0.009
// //                       ? fmt(v.current_balance)
// //                       : '—'}
// //                   </span>
// //                 </div>
// //               ))}
// //             </div>
// //           </div>

// //           <div className="panel credit-detail" id="vendor-ledger">
// //             {!ledger ? (
// //               <div className="inv-empty" style={{ margin: 'auto' }}>
// //                 Select a vendor to see their bills, payments and balance
// //               </div>
// //             ) : (
// //               <>
// //                 <div className="cd-head">
// //                   <div>
// //                     <h3>
// //                       {ledger.vendor.name}{' '}
// //                       <span className="muted-text">· {ledger.vendor.code}</span>
// //                     </h3>
// //                     <div className="cd-balance">
// //                       {ledger.vendor.telephone && (
// //                         <>☎ {ledger.vendor.telephone} · </>
// //                       )}
// //                       {ledger.vendor.address || 'no address'}
// //                     </div>
// //                     <div className="cd-balance">
// //                       {Number(ledger.vendor.current_balance) < -0.009 ? (
// //                         <>
// //                           Vendor owes YOU (advance):{' '}
// //                           <strong className="pos">
// //                             {fmt(-ledger.vendor.current_balance)}
// //                           </strong>
// //                         </>
// //                       ) : (
// //                         <>
// //                           Balance we owe:{' '}
// //                           <strong>{fmt(ledger.vendor.current_balance)}</strong>
// //                         </>
// //                       )}
// //                     </div>
// //                   </div>
// //                   <div className="pv-inline">
// //                     {Number(ledger.vendor.current_balance) < -0.009 ? (
// //                       <button
// //                         type="button"
// //                         className="btn-sm primary"
// //                         onClick={openReceive}
// //                         title="The vendor owes you — record the money they pay back"
// //                       >
// //                         <Icon name="wallet" size={14} /> Receive from vendor
// //                       </button>
// //                     ) : (
// //                       <button
// //                         type="button"
// //                         className="btn-sm primary"
// //                         onClick={openPay}
// //                         disabled={Number(ledger.vendor.current_balance) <= 0}
// //                       >
// //                         <Icon name="wallet" size={14} /> Pay vendor
// //                       </button>
// //                     )}
// //                     <button
// //                       type="button"
// //                       className="btn-sm ghost"
// //                       onClick={() => {
// //                         setVendorId(String(ledger.vendor.id))
// //                         setView('bill')
// //                       }}
// //                     >
// //                       <Icon name="plus" size={14} /> New bill
// //                     </button>
// //                     <button
// //                       type="button"
// //                       className="btn-sm ghost"
// //                       onClick={() =>
// //                         setVendorModal({
// //                           mode: 'edit',
// //                           id: ledger.vendor.id,
// //                           form: {
// //                             name: ledger.vendor.name || '',
// //                             telephone: ledger.vendor.telephone || '',
// //                             address: ledger.vendor.address || '',
// //                             gstRegNo: ledger.vendor.gst_reg_no || '',
// //                             ntn: ledger.vendor.ntn || '',
// //                             openingBalance: ''
// //                           }
// //                         })
// //                       }
// //                     >
// //                       Edit
// //                     </button>
// //                     <button
// //                       type="button"
// //                       className="btn-sm ghost"
// //                       onClick={() => printNow()}
// //                       title="Print this ledger"
// //                     >
// //                       <Icon name="printer" size={14} /> Print
// //                     </button>
// //                   </div>
// //                 </div>

// //                 <div className="report-bar" style={{ marginBottom: 8 }}>
// //                   <div className="rb-dates">
// //                     <label>
// //                       From{' '}
// //                       <input
// //                         type="date"
// //                         value={lFrom}
// //                         onChange={(e) => setLFrom(e.target.value)}
// //                       />
// //                     </label>
// //                     <label>
// //                       To{' '}
// //                       <input
// //                         type="date"
// //                         value={lTo}
// //                         onChange={(e) => setLTo(e.target.value)}
// //                       />
// //                     </label>
// //                     <DatePresets
// //                       from={lFrom}
// //                       to={lTo}
// //                       onChange={(r) => {
// //                         setLFrom(r.from)
// //                         setLTo(r.to)
// //                       }}
// //                     />
// //                   </div>
// //                 </div>

// //                 <div
// //                   className="report-cards"
// //                   style={{
// //                     gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'
// //                   }}
// //                 >
// //                   <div className="rc-card">
// //                     <span>Opening</span>
// //                     <strong>{fmt(ledger.opening)}</strong>
// //                   </div>
// //                   <div className="rc-card">
// //                     <span>Bills (+)</span>
// //                     <strong>{fmt(ledger.totals.billed)}</strong>
// //                   </div>
// //                   <div className="rc-card">
// //                     <span>Paid (−)</span>
// //                     <strong className="pos">{fmt(ledger.totals.paid)}</strong>
// //                   </div>
// //                   <div className="rc-card amber">
// //                     <span>Balance</span>
// //                     <strong>{fmt(ledger.totals.closing)}</strong>
// //                   </div>
// //                 </div>

// //                 <div className="table-scroll">
// //                   <table className="data-table">
// //                     <thead>
// //                       <tr>
// //                         <th>Date</th>
// //                         <th>Ref</th>
// //                         <th>Details</th>
// //                         <th className="num">Bill (+)</th>
// //                         <th className="num">Paid (−)</th>
// //                         <th className="num">Balance</th>
// //                         <th></th>
// //                       </tr>
// //                     </thead>
// //                     <tbody>
// //                       <tr className="pv-opening">
// //                         <td colSpan="5">Opening balance</td>
// //                         <td className="num strong">{fmt(ledger.opening)}</td>
// //                         <td></td>
// //                       </tr>
// //                       {ledger.rows.length === 0 && (
// //                         <tr>
// //                           <td colSpan="7" className="empty">
// //                             No bills or payments in these dates
// //                           </td>
// //                         </tr>
// //                       )}
// //                       {ledger.rows.map((r) => (
// //                         <FragmentRow key={r.id}>
// //                           <tr>
// //                             <td>{r.date}</td>
// //                             <td>
// //                               {r.type === 'bill' ? (
// //                                 <button
// //                                   type="button"
// //                                   className="po-badge ordered pv-badge-btn"
// //                                   title="Open bill (edit / return)"
// //                                   onClick={() => showBill(r.billId)}
// //                                 >
// //                                   {r.serial || 'BILL'}
// //                                 </button>
// //                               ) : r.type === 'payment' ? (
// //                                 <span className="po-badge received">
// //                                   {r.voucherNo || 'PAID'}
// //                                 </span>
// //                               ) : r.type === 'return' ? (
// //                                 <button
// //                                   type="button"
// //                                   className="po-badge cancelled pv-badge-btn"
// //                                   title="Open the bill"
// //                                   onClick={() => showBill(r.returnBillId)}
// //                                 >
// //                                   {r.returnNo || 'RETURN'}
// //                                 </button>
// //                               ) : r.type === 'refund' ? (
// //                                 <span className="po-badge received">
// //                                   {r.voucherNo || 'REFUND'}
// //                                 </span>
// //                               ) : (
// //                                 <span className="po-badge">{r.type}</span>
// //                               )}
// //                             </td>
// //                             <td>
// //                               {r.type === 'bill' && r.lines?.length > 0 ? (
// //                                 <button
// //                                   type="button"
// //                                   className="pv-link"
// //                                   onClick={() =>
// //                                     setOpenBill(openBill === r.id ? null : r.id)
// //                                   }
// //                                 >
// //                                   {openBill === r.id ? '▼' : '▶'}{' '}
// //                                   {r.lines.length} product type
// //                                   {r.lines.length > 1 ? 's' : ''}
// //                                   {r.vendorBillNo
// //                                     ? ` · vendor #${r.vendorBillNo}`
// //                                     : ''}
// //                                   {r.stockAdded ? ' · stock added' : ''}
// //                                 </button>
// //                               ) : r.type === 'payment' ? (
// //                                 <span>
// //                                   {r.accountType === 'bank'
// //                                     ? 'Online'
// //                                     : 'Cash in Hand'}{' '}
// //                                   ·{' '}
// //                                   {r.description
// //                                     ?.split(' · ')
// //                                     .slice(1)
// //                                     .join(' · ')}
// //                                 </span>
// //                               ) : r.type === 'return' || r.type === 'refund' ? (
// //                                 <span>
// //                                   {r.description
// //                                     ?.split(' · ')
// //                                     .slice(1)
// //                                     .join(' · ')}
// //                                 </span>
// //                               ) : (
// //                                 r.description
// //                               )}
// //                             </td>
// //                             <td className="num">{r.bill ? fmt(r.bill) : ''}</td>
// //                             <td className="num pos">
// //                               {r.paid ? fmt(r.paid) : ''}
// //                             </td>
// //                             <td className="num strong">{fmt(r.balance)}</td>
// //                             <td className="num">
// //                               {r.voucherId && (
// //                                 <button
// //                                   type="button"
// //                                   className="btn-icon danger"
// //                                   title="Delete this payment"
// //                                   onClick={() => removePayment(r)}
// //                                 >
// //                                   <Icon name="trash" size={14} />
// //                                 </button>
// //                               )}
// //                               {r.billId && (
// //                                 <button
// //                                   type="button"
// //                                   className="btn-icon"
// //                                   title="Open bill: edit / return to vendor"
// //                                   onClick={() => showBill(r.billId)}
// //                                 >
// //                                   <Icon name="edit" size={14} />
// //                                 </button>
// //                               )}
// //                               {r.returnId && (
// //                                 <button
// //                                   type="button"
// //                                   className="btn-icon danger"
// //                                   title="Delete this return"
// //                                   onClick={() => removeReturn(r)}
// //                                 >
// //                                   <Icon name="trash" size={14} />
// //                                 </button>
// //                               )}
// //                             </td>
// //                           </tr>
// //                           {openBill === r.id &&
// //                             r.lines.map((l, i) => (
// //                               <tr key={i} className="pv-subline">
// //                                 <td></td>
// //                                 <td></td>
// //                                 <td>
// //                                   {l.description} × {l.quantity} @ {fmt(l.rate)}
// //                                   {l.linked ? ' (in stock)' : ''}
// //                                 </td>
// //                                 <td className="num muted-text">
// //                                   {fmt(l.amount)}
// //                                 </td>
// //                                 <td colSpan="3"></td>
// //                               </tr>
// //                             ))}
// //                         </FragmentRow>
// //                       ))}
// //                     </tbody>
// //                     <tfoot>
// //                       <tr>
// //                         <td colSpan="3" className="num strong">
// //                           Totals
// //                         </td>
// //                         <td className="num strong">
// //                           {fmt(ledger.totals.billed)}
// //                         </td>
// //                         <td className="num strong pos">
// //                           {fmt(ledger.totals.paid)}
// //                         </td>
// //                         <td className="num strong">
// //                           {fmt(ledger.totals.closing)}
// //                         </td>
// //                         <td></td>
// //                       </tr>
// //                     </tfoot>
// //                   </table>
// //                 </div>
// //               </>
// //             )}
// //           </div>
// //         </div>
// //       )}

// //       {/* ═════════════ BILL HISTORY ═════════════ */}
// //       {view === 'history' && (
// //         <div className="panel report-table-wrap">
// //           <div className="report-bar">
// //             <div className="rb-dates">
// //               <label>
// //                 From{' '}
// //                 <input
// //                   type="date"
// //                   value={hFrom}
// //                   onChange={(e) => setHFrom(e.target.value)}
// //                 />
// //               </label>
// //               <label>
// //                 To{' '}
// //                 <input
// //                   type="date"
// //                   value={hTo}
// //                   onChange={(e) => setHTo(e.target.value)}
// //                 />
// //               </label>
// //               <DatePresets
// //                 from={hFrom}
// //                 to={hTo}
// //                 onChange={(r) => {
// //                   setHFrom(r.from)
// //                   setHTo(r.to)
// //                 }}
// //               />
// //             </div>
// //             <div className="search-box">
// //               <Icon name="search" size={15} />
// //               <input
// //                 placeholder="Vendor / bill no."
// //                 value={hSearch}
// //                 onChange={(e) => setHSearch(e.target.value)}
// //               />
// //             </div>
// //           </div>
// //           <p
// //             className="muted-text"
// //             style={{ fontSize: 12, margin: '4px 0 6px' }}
// //           >
// //             {bills.rows.length} bill{bills.rows.length === 1 ? '' : 's'} ·{' '}
// //             {fmt(bills.total)}
// //           </p>
// //           <div className="table-scroll">
// //             <table className="data-table">
// //               <thead>
// //                 <tr>
// //                   <th>Bill</th>
// //                   <th>Date</th>
// //                   <th>Vendor</th>
// //                   <th>Vendor bill #</th>
// //                   <th className="num">Types</th>
// //                   <th className="num">Total</th>
// //                   <th className="num">Paid with bill</th>
// //                   <th className="num">Returned</th>
// //                   <th>Stock</th>
// //                   <th>Edited</th>
// //                 </tr>
// //               </thead>
// //               <tbody>
// //                 {bills.rows.length === 0 ? (
// //                   <tr>
// //                     <td colSpan="10" className="empty">
// //                       No bills in these dates
// //                     </td>
// //                   </tr>
// //                 ) : (
// //                   bills.rows.map((b) => (
// //                     <tr
// //                       key={b.id}
// //                       className="clickable"
// //                       onClick={() => showBill(b.id)}
// //                     >
// //                       <td className="strong">{b.serial_no}</td>
// //                       <td>{b.order_date}</td>
// //                       <td>{b.vendor || '—'}</td>
// //                       <td>{b.vendor_bill_no || '—'}</td>
// //                       <td className="num">{b.line_count || 'amount only'}</td>
// //                       <td className="num strong">{fmt(b.total)}</td>
// //                       <td className="num">
// //                         {Number(b.paid_with_bill) ? fmt(b.paid_with_bill) : '—'}
// //                       </td>
// //                       <td
// //                         className={
// //                           'num' + (Number(b.returned_value) ? ' neg' : '')
// //                         }
// //                       >
// //                         {Number(b.return_count)
// //                           ? `${fmt(b.returned_value)} (${b.return_count})`
// //                           : '—'}
// //                       </td>
// //                       <td>{b.adds_stock ? 'added' : '—'}</td>
// //                       <td>{Number(b.edit_count) ? `${b.edit_count}×` : '—'}</td>
// //                     </tr>
// //                   ))
// //                 )}
// //               </tbody>
// //             </table>
// //           </div>
// //         </div>
// //       )}

// //       {/* ═════════════ MODALS ═════════════ */}
// //       {vendorModal && (
// //         <Modal
// //           title={vendorModal.mode === 'create' ? 'New vendor' : 'Edit vendor'}
// //           onClose={() => setVendorModal(null)}
// //           footer={
// //             <>
// //               <button
// //                 className="btn-secondary"
// //                 onClick={() => setVendorModal(null)}
// //               >
// //                 Cancel
// //               </button>
// //               <button
// //                 className="btn-primary"
// //                 onClick={saveVendor}
// //                 disabled={busy}
// //               >
// //                 Save (F9)
// //               </button>
// //             </>
// //           }
// //         >
// //           {vendorField('Name *', 'name', { autoFocus: true })}
// //           <div className="field-row">
// //             {vendorField('Contact number', 'telephone')}
// //             {vendorField('GST reg. no.', 'gstRegNo')}
// //           </div>
// //           {vendorField('Address', 'address')}
// //           <div className="field-row">
// //             {vendorField('NTN', 'ntn')}
// //             {vendorModal.mode === 'create' &&
// //               vendorField('Old balance we owe (optional)', 'openingBalance', {
// //                 type: 'number',
// //                 min: 0
// //               })}
// //           </div>
// //         </Modal>
// //       )}

// //       {payModal && ledger && (
// //         <Modal
// //           title={
// //             payModal.mode === 'receive'
// //               ? `Receive money from ${ledger.vendor.name}`
// //               : `Pay ${ledger.vendor.name}`
// //           }
// //           onClose={() => setPayModal(null)}
// //           footer={
// //             <>
// //               <button
// //                 className="btn-secondary"
// //                 onClick={() => setPayModal(null)}
// //               >
// //                 Cancel
// //               </button>
// //               <button className="btn-primary" onClick={savePay} disabled={busy}>
// //                 {busy
// //                   ? 'Saving…'
// //                   : payModal.mode === 'receive'
// //                     ? 'Save received money (F9)'
// //                     : 'Save payment (F9)'}
// //               </button>
// //             </>
// //           }
// //         >
// //           {error && <div className="login-error">{error}</div>}
// //           <p className="muted-text" style={{ marginTop: 0 }}>
// //             {payModal.mode === 'receive' ? (
// //               <>
// //                 {ledger.vendor.name} owes you:{' '}
// //                 <strong>
// //                   {fmt(Math.abs(Number(ledger.vendor.current_balance)))}
// //                 </strong>
// //               </>
// //             ) : (
// //               <>
// //                 Balance we owe:{' '}
// //                 <strong>{fmt(ledger.vendor.current_balance)}</strong>
// //               </>
// //             )}
// //           </p>
// //           <div className="field">
// //             <span className="field-label">
// //               {payModal.mode === 'receive' ? 'Received into' : 'Pay from'}
// //             </span>
// //             <div
// //               className="pay-type-group"
// //               style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
// //             >
// //               <button
// //                 type="button"
// //                 className={
// //                   'pay-type-btn' +
// //                   (payModal.via === 'cash' ? ' active cash' : '')
// //                 }
// //                 onClick={() => setPayModal((pm) => ({ ...pm, via: 'cash' }))}
// //               >
// //                 Cash in Hand
// //               </button>
// //               <button
// //                 type="button"
// //                 className={
// //                   'pay-type-btn' +
// //                   (payModal.via === 'bank' ? ' active online' : '')
// //                 }
// //                 onClick={() => setPayModal((pm) => ({ ...pm, via: 'bank' }))}
// //               >
// //                 Online
// //               </button>
// //             </div>
// //           </div>
// //           <div className="field-row">
// //             <label className="field">
// //               <span>
// //                 Amount <em className="hint-em">(F6 = full balance)</em>
// //               </span>
// //               <input
// //                 type="number"
// //                 min="0"
// //                 autoFocus
// //                 value={payModal.amount}
// //                 onChange={(e) =>
// //                   setPayModal((pm) => ({ ...pm, amount: e.target.value }))
// //                 }
// //                 onKeyDown={(e) => e.key === 'Enter' && savePay()}
// //               />
// //             </label>
// //             <label className="field">
// //               <span>Date</span>
// //               <input
// //                 type="date"
// //                 value={payModal.date}
// //                 onChange={(e) =>
// //                   setPayModal((pm) => ({ ...pm, date: e.target.value }))
// //                 }
// //               />
// //             </label>
// //           </div>
// //           <label className="field">
// //             <span>Note (optional)</span>
// //             <input
// //               value={payModal.note}
// //               onChange={(e) =>
// //                 setPayModal((pm) => ({ ...pm, note: e.target.value }))
// //               }
// //             />
// //           </label>
// //           {Number(payModal.amount) > 0 && payModal.mode !== 'receive' && (
// //             <p className="muted-text">
// //               Balance after payment:{' '}
// //               <strong>
// //                 {fmt(
// //                   r2(
// //                     Number(ledger.vendor.current_balance) -
// //                       Number(payModal.amount)
// //                   )
// //                 )}
// //               </strong>
// //             </p>
// //           )}
// //           {Number(payModal.amount) > 0 && payModal.mode === 'receive' && (
// //             <p className="muted-text">
// //               Vendor will still owe you:{' '}
// //               <strong>
// //                 {fmt(
// //                   Math.max(
// //                     0,
// //                     r2(
// //                       Math.abs(Number(ledger.vendor.current_balance)) -
// //                         Number(payModal.amount)
// //                     )
// //                   )
// //                 )}
// //               </strong>
// //             </p>
// //           )}
// //         </Modal>
// //       )}

// //       {stockPriceModal && (
// //         <ProductHistoryModal
// //           onClose={() => setStockPriceModal(false)}
// //           onSaved={() => {
// //             loadRefs()
// //             if (items.length > 0)
// //               inventoryApi.items
// //                 .list({})
// //                 .then(setItems)
// //                 .catch(() => {})
// //           }}
// //         />
// //       )}

// //       {openBillId && (
// //         <PurchaseBillModal
// //           billId={openBillId}
// //           uid={uid}
// //           accounts={accounts}
// //           onClose={() => setOpenBillId(null)}
// //           onChanged={onBillChanged}
// //           onDelete={(b) => {
// //             // say what blocks it BEFORE asking "Delete?" (was: confirm first, then refuse);
// //             // a returned message is shown inside the bill dialog
// //             if (b.payments?.length)
// //               return `This bill has a payment made with it — delete that payment first (vendor ledger).`
// //             if (b.returns?.length)
// //               return 'This bill has returns to the vendor — delete those returns first.'
// //             removeBill(b.id, b.serial_no, !!b.adds_stock)
// //           }}
// //         />
// //       )}

// //       <div className="hotkey-hint">
// //         <span>
// //           <kbd>Alt</kbd>+<kbd>1/2/3</kbd> Tabs
// //         </span>
// //         <span>
// //           <kbd>F2</kbd> Search / first line
// //         </span>
// //         <span>
// //           <kbd>F9</kbd> Save
// //         </span>
// //         <span>
// //           <kbd>F6</kbd> Full balance (pay)
// //         </span>
// //         <span>
// //           <kbd>F5</kbd> Refresh
// //         </span>
// //         <span>
// //           <kbd>Esc</kbd> Close
// //         </span>
// //       </div>
// //     </div>
// //   )
// // }

// // // Groups a ledger row with its expanded product lines (keys stay on the outer element).
// // function FragmentRow({ children }) {
// //   return <>{children}</>
// // }

// import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
// import { purchasesApi, inventoryApi } from '../api/ipc.js'
// import { useAuth } from '../context/AuthContext.jsx'
// import Icon from '../components/Icons.jsx'
// import Modal from '../components/Modal.jsx'
// import PurchaseBillModal from '../components/PurchaseBillModal.jsx'
// import ProductHistoryModal from '../components/ProductHistoryModal.jsx'
// import DatePresets from '../components/DatePresets.jsx'
// import { localToday } from '../utils/date.js'
// import { useHotkeys } from '../hooks/useHotkeys.js'
// import { printNow } from '../utils/print.js'
// import { notifyStockChanged } from '../utils/lowStock.js'

// // Purchases = the VENDOR ACCOUNT BOOK (client's requirement):
// //  • New Bill: pick a vendor, type the product types that came (qty + that type's total) —
// //    or just the bill amount — optionally add them to Inventory stock, optionally pay now.
// //  • Vendors & Ledger: like credit customers — each vendor's bills (+), payments (−) and
// //    balance; pay any amount any time from Cash in Hand or Online (bank).
// //  • Bill History: every bill, by date.
// // Payments reduce the Dashboard's Cash in Hand / Bank-Online card and the Sales card.

// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
// const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
// let keySeq = 0

// const blankLine = () => ({
//   key: ++keySeq,
//   description: '',
//   quantity: '',
//   lineTotal: '',
//   itemId: '',
//   stockOperation: 'add', // 'add' | 'replace'
//   searchResults: [],
//   selectedItem: null,
//   sellingPrice: '',
//   sellingPrice: ''
// })

// const blankVendor = {
//   name: '',
//   telephone: '',
//   address: '',
//   gstRegNo: '',
//   ntn: '',
//   openingBalance: ''
// }

// export default function Purchases() {
//   const { session } = useAuth()
//   const uid = session?.id
//   const [view, setView] = useState('bill') // 'bill' | 'ledger' | 'history'
//   const [vendors, setVendors] = useState([])
//   const [accounts, setAccounts] = useState([])
//   const [items, setItems] = useState([])
//   const [error, setError] = useState('')
//   const [notice, setNotice] = useState('')
//   const [busy, setBusy] = useState(false)

//   // ── new bill ──
//   const [vendorId, setVendorId] = useState('')
//   const [billDate, setBillDate] = useState(localToday())
//   const [vendorBillNo, setVendorBillNo] = useState('')
//   const [mode, setMode] = useState('lines') // 'lines' | 'amount'
//   const [lines, setLines] = useState([blankLine()])
//   const [billAmount, setBillAmount] = useState('')
//   const [addToStock, setAddToStock] = useState(false)
//   // Owner's rule: saving a bill only RECORDS it. Money moves only if "Pay now" is chosen
//   // on purpose (or later from Vendors & Ledger → Pay vendor). Default is always 'none'.
//   const [payMode, setPayMode] = useState('none') // 'none' | 'pay'
//   const [payNow, setPayNow] = useState('')
//   const [payVia, setPayVia] = useState('cash') // 'cash' | 'bank'
//   const [remarks, setRemarks] = useState('')

//   // ── vendors & ledger ──
//   const [selVendor, setSelVendor] = useState(null)
//   const [vSearch, setVSearch] = useState('')
//   const [owesOnly, setOwesOnly] = useState(false)
//   const [ledger, setLedger] = useState(null)
//   const [lFrom, setLFrom] = useState('')
//   const [lTo, setLTo] = useState('')
//   const [openBill, setOpenBill] = useState(null)

//   // ── history ──
//   const [hFrom, setHFrom] = useState(localToday().slice(0, 8) + '01')
//   const [hTo, setHTo] = useState(localToday())
//   const [hSearch, setHSearch] = useState('')
//   const [bills, setBills] = useState({ rows: [], total: 0 })
//   const [openBillId, setOpenBillId] = useState(null)

//   // ── modals ──
//   const [vendorModal, setVendorModal] = useState(null)
//   const [payModal, setPayModal] = useState(null)
//   const [stockPriceModal, setStockPriceModal] = useState(false)

//   const firstLineRef = useRef(null)
//   const vSearchRef = useRef(null)
//   const searchTimer = useRef(null)

//   const cashAcct = accounts.find((a) => a.type === 'cash')
//   const bankAcct = accounts.find((a) => a.type === 'bank')
//   const acctFor = (via) => (via === 'bank' ? bankAcct : cashAcct)

//   const noticeTimer = useRef(null)
//   const confirmFunds = (via, amount) => {
//     const acct = acctFor(via)
//     const bal = Number(acct?.current_balance) || 0
//     if (amount <= bal + 0.009) return true
//     return window.confirm(
//       `${via === 'bank' ? 'Online (bank)' : 'Cash in Hand'} has only ${fmt(bal)}. ` +
//         `Paying ${fmt(amount)} will make it ${fmt(bal - amount)}. Pay anyway?`
//     )
//   }

//   const flash = (msg) => {
//     setNotice(msg)
//     clearTimeout(noticeTimer.current)
//     noticeTimer.current = setTimeout(() => setNotice(''), 8000)
//   }
//   useEffect(
//     () => () => {
//       clearTimeout(noticeTimer.current)
//       clearTimeout(searchTimer.current)
//     },
//     []
//   )

//   const loadRefs = useCallback(async () => {
//     const [v, a] = await Promise.all([
//       purchasesApi.vendors(),
//       purchasesApi.accounts()
//     ])
//     setVendors(v)
//     setAccounts(a)
//   }, [])
//   useEffect(() => {
//     loadRefs().catch((e) => setError(e.message))
//   }, [loadRefs])

//   useEffect(() => {
//     if (addToStock && items.length === 0)
//       inventoryApi.items
//         .list({})
//         .then(setItems)
//         .catch((e) => setError(e.message))
//   }, [addToStock, items.length])

//   const loadLedger = useCallback(async () => {
//     if (!selVendor) return setLedger(null)
//     setLedger(
//       await purchasesApi.vendorLedger({
//         actingUserId: uid,
//         vendorId: selVendor,
//         from: lFrom,
//         to: lTo
//       })
//     )
//   }, [uid, selVendor, lFrom, lTo])
//   useEffect(() => {
//     loadLedger().catch((e) => setError(e.message))
//   }, [loadLedger])

//   const loadBills = useCallback(async () => {
//     setBills(
//       await purchasesApi.bills({
//         actingUserId: uid,
//         from: hFrom,
//         to: hTo,
//         search: hSearch
//       })
//     )
//   }, [uid, hFrom, hTo, hSearch])
//   useEffect(() => {
//     if (view === 'history') loadBills().catch((e) => setError(e.message))
//   }, [view, loadBills])

//   // ── bill maths ──
//   const lineRate = (l) => {
//     const q = Number(l.quantity) || 0
//     const t = Number(l.lineTotal) || 0
//     return q > 0 && t > 0 ? r2(t / q) : 0
//   }
//   const billTotal =
//     mode === 'lines'
//       ? r2(lines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0))
//       : r2(Number(billAmount) || 0)
//   const vendor = vendors.find((v) => String(v.id) === String(vendorId))
//   const owedBefore = Number(vendor?.current_balance) || 0
//   const payAmt = payMode === 'pay' ? r2(Number(payNow) || 0) : 0
//   const owedAfter = r2(owedBefore + billTotal - payAmt)

//   const setLine = (key, field, value) =>
//     setLines((p) =>
//       p.map((l) => (l.key === key ? { ...l, [field]: value } : l))
//     )

//   const handleItemSearch = (key, value) => {
//     setLine(key, 'description', value)
//     setLine(key, 'selectedItem', null)
//     setLine(key, 'itemId', '')

//     clearTimeout(searchTimer.current)
//     if (!value.trim()) {
//       setLine(key, 'searchResults', [])
//       return
//     }

//     searchTimer.current = setTimeout(async () => {
//       try {
//         const results = await inventoryApi.items.list({ search: value })
//         setLine(key, 'searchResults', results.slice(0, 10))
//       } catch (e) {
//         console.error(e)
//       }
//     }, 200)
//   }

//   const selectItem = (key, it) => {
//     setLines((p) =>
//       p.map((l) => {
//         if (l.key !== key) return l
//         const qty = l.quantity ? Number(l.quantity) : 1
//         return {
//           ...l,
//           itemId: it.id,
//           description: it.name,
//           quantity: qty,
//           lineTotal: it.purchase_price
//             ? String(it.purchase_price * qty)
//             : l.lineTotal,
//           selectedItem: it,
//           searchResults: [],
//           sellingPrice: String(it.selling_price || '')
//         }
//       })
//     )
//   }

//   const addLine = () => setLines((p) => [...p, blankLine()])
//   const removeLine = (key) =>
//     setLines((p) =>
//       p.length > 1 ? p.filter((l) => l.key !== key) : [blankLine()]
//     )

//   const resetBill = () => {
//     setLines([blankLine()])
//     setBillAmount('')
//     setVendorBillNo('')
//     setPayNow('')
//     setPayMode('none')
//     setRemarks('')
//     setAddToStock(false)
//     setBillDate(localToday())
//   }

//   const saveBill = async (allowDuplicateBillNo = false) => {
//     if (busy) return
//     setError('')
//     if (!vendorId)
//       return setError('Select the vendor first (or add a new one with +).')
//     if (billTotal <= 0)
//       return setError(
//         'Add product types with their total, or enter the bill amount.'
//       )
//     if (payMode === 'pay' && payAmt <= 0)
//       return setError(
//         'Enter the amount to pay now — or choose "Save only — pay later".'
//       )
//     if (payAmt > 0 && !acctFor(payVia))
//       return setError('No account found for this payment type.')
//     if (!allowDuplicateBillNo && payAmt > 0 && !confirmFunds(payVia, payAmt))
//       return
//     setBusy(true)
//     let askDuplicate = null
//     try {
//       const res = await purchasesApi.createBill({
//         actingUserId: uid,
//         vendorId: Number(vendorId),
//         billDate,
//         vendorBillNo,
//         allowDuplicateBillNo,
//         lines:
//           mode === 'lines'
//             ? lines.map((l) => ({
//                 description: l.description,
//                 quantity: Number(l.quantity) || 0,
//                 lineTotal: Number(l.lineTotal) || 0,
//                 itemId: addToStock && l.itemId ? Number(l.itemId) : null,
//                 stockOperation:
//                   addToStock && l.selectedItem ? l.stockOperation : 'add',
//                 sellingPrice:
//                   addToStock && l.selectedItem ? Number(l.sellingPrice) : 0
//               }))
//             : [],
//         billAmount: mode === 'amount' ? billTotal : 0,
//         addToStock: mode === 'lines' && addToStock,
//         payNow: payAmt,
//         accountId: payAmt > 0 ? acctFor(payVia).id : null,
//         remarks
//       })
//       flash(
//         `Bill ${res.serial} saved — ${fmt(res.total)} added to ${vendor.name}.` +
//           (res.payment
//             ? ` Paid ${fmt(res.payment.amount)} from ${res.payment.account}.`
//             : '') +
//           (res.stockAdded ? ' Stock updated.' : '')
//       )
//       if (res.stockAdded) notifyStockChanged()
//       resetBill()
//       await loadRefs()
//       if (String(selVendor) === String(vendorId)) loadLedger()
//     } catch (e) {
//       const m = /^DUPLICATE_VENDOR_BILL:(.*)$/.exec(e.message || '')
//       if (m) askDuplicate = m[1]
//       else setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//     if (
//       askDuplicate &&
//       window.confirm(
//         `Vendor bill # "${vendorBillNo}" is already recorded for this vendor (${askDuplicate}).\n` +
//           "Is this really a different bill? OK = save it anyway, Cancel = don't save."
//       )
//     )
//       saveBill(true)
//   }

//   const saveVendor = async () => {
//     const f = vendorModal.form
//     if (!f.name.trim()) return setError('Vendor name is required.')
//     setBusy(true)
//     setError('')
//     try {
//       if (vendorModal.mode === 'create') {
//         const r = await purchasesApi.createVendor({
//           ...f,
//           openingBalance: Number(f.openingBalance) || 0
//         })
//         await loadRefs()
//         setVendorId(String(r.id))
//         if (view === 'ledger') setSelVendor(r.id)
//         flash(`Vendor "${f.name.trim()}" added.`)
//       } else {
//         await purchasesApi.updateVendor({
//           actingUserId: uid,
//           id: vendorModal.id,
//           ...f
//         })
//         await loadRefs()
//         loadLedger()
//         flash('Vendor details saved.')
//       }
//       setVendorModal(null)
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const openPay = () => {
//     setError('')
//     setPayModal({
//       mode: 'pay',
//       amount: '',
//       via: 'cash',
//       date: localToday(),
//       note: ''
//     })
//   }
//   const openReceive = () => {
//     setError('')
//     setPayModal({
//       mode: 'receive',
//       amount: '',
//       via: 'cash',
//       date: localToday(),
//       note: ''
//     })
//   }
//   const savePay = async () => {
//     const amt = r2(Number(payModal.amount) || 0)
//     if (amt <= 0) return setError('Enter the amount paid.')
//     const acct = acctFor(payModal.via)
//     if (!acct) return setError('No account found for this payment type.')
//     if (payModal.mode === 'receive') {
//       setBusy(true)
//       setError('')
//       try {
//         const r = await purchasesApi.receiveFromVendor({
//           actingUserId: uid,
//           vendorId: selVendor,
//           amount: amt,
//           accountId: acct.id,
//           date: payModal.date,
//           note: payModal.note
//         })
//         flash(
//           `${r.voucherNo}: received ${fmt(r.amount)} from ${ledger.vendor.name} into ${r.account}.`
//         )
//         setPayModal(null)
//         await loadRefs()
//         await loadLedger()
//       } catch (e) {
//         setError(e.message)
//       } finally {
//         setBusy(false)
//       }
//       return
//     }
//     const owed = Number(ledger?.vendor?.current_balance) || 0
//     if (amt > owed + 0.009)
//       return setError(
//         `Payment is more than the balance owed to ${ledger.vendor.name} (${fmt(owed)}).`
//       )
//     if (!confirmFunds(payModal.via, amt)) return
//     setBusy(true)
//     setError('')
//     try {
//       const r = await purchasesApi.payVendor({
//         actingUserId: uid,
//         vendorId: selVendor,
//         amount: amt,
//         accountId: acct.id,
//         date: payModal.date,
//         note: payModal.note
//       })
//       flash(
//         `${r.voucherNo}: paid ${fmt(r.amount)} to ${ledger.vendor.name} from ${r.account}.`
//       )
//       setPayModal(null)
//       await loadRefs()
//       await loadLedger()
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const removePayment = async (row) => {
//     const msg =
//       row.type === 'refund'
//         ? `Delete ${row.voucherNo} — ${fmt(row.bill)} received from the vendor? The money leaves ${row.account} again and the vendor owes you again.`
//         : `Delete payment ${row.voucherNo} of ${fmt(row.paid)}? The money goes back to ${row.account} and the vendor balance goes up again.`
//     if (!window.confirm(msg)) return
//     setBusy(true)
//     try {
//       await purchasesApi.deleteVendorPayment({
//         actingUserId: uid,
//         voucherId: row.voucherId
//       })
//       await loadRefs()
//       await loadLedger()
//       flash('Payment deleted.')
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }
//   const removeBill = async (id, label, stockAdded) => {
//     if (
//       !window.confirm(
//         `Delete bill ${label}? The vendor balance goes down by its amount.${stockAdded ? ' The stock it added is taken back out.' : ''}`
//       )
//     )
//       return
//     setBusy(true)
//     try {
//       await purchasesApi.deleteBill({ actingUserId: uid, id })
//       if (stockAdded) notifyStockChanged()
//       setOpenBillId(null)
//       await loadRefs()
//       await loadLedger()
//       if (view === 'history') await loadBills()
//       flash(`Bill ${label} deleted.`)
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }
//   const showBill = (id) => setOpenBillId(id)
//   const onBillChanged = async (msg) => {
//     if (msg) flash(msg)
//     await loadRefs()
//     await loadLedger()
//     if (view === 'history') await loadBills()
//   }
//   const removeReturn = async (row) => {
//     if (
//       !window.confirm(
//         `Delete return ${row.returnNo}? Everything it changed is reversed.`
//       )
//     )
//       return
//     setBusy(true)
//     try {
//       await purchasesApi.deleteReturn({ actingUserId: uid, id: row.returnId })
//       await onBillChanged(`Return ${row.returnNo} deleted.`)
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const vendorList = useMemo(() => {
//     const q = vSearch.trim().toLowerCase()
//     return vendors
//       .filter((v) => !owesOnly || Number(v.current_balance) > 0.009)
//       .filter(
//         (v) =>
//           !q ||
//           v.name.toLowerCase().includes(q) ||
//           String(v.code).includes(q) ||
//           String(v.telephone || '').includes(q)
//       )
//       .sort(
//         (a, b) =>
//           Number(b.current_balance) - Number(a.current_balance) ||
//           a.name.localeCompare(b.name)
//       )
//   }, [vendors, vSearch, owesOnly])
//   const totalOwed = vendors.reduce(
//     (s, v) => s + Math.max(0, Number(v.current_balance) || 0),
//     0
//   )

//   useHotkeys(
//     {
//       f9: () => {
//         if (payModal) savePay()
//         else if (vendorModal) saveVendor()
//         else if (!stockPriceModal && view === 'bill') saveBill()
//       },
//       f5: () => {
//         loadRefs()
//         if (view === 'ledger') loadLedger()
//         if (view === 'history') loadBills()
//       },
//       f2: () => {
//         if (view === 'ledger') vSearchRef.current?.focus()
//         else firstLineRef.current?.focus()
//       },
//       f6: () => {
//         if (payModal && ledger)
//           setPayModal((pm) => ({
//             ...pm,
//             amount: String(
//               pm.mode === 'receive'
//                 ? Math.abs(Math.min(0, ledger.vendor.current_balance))
//                 : Math.max(0, ledger.vendor.current_balance)
//             )
//           }))
//       },
//       'alt+1': () => setView('bill'),
//       'alt+2': () => setView('ledger'),
//       'alt+3': () => setView('history'),
//       escape: () => {
//         if (stockPriceModal) setStockPriceModal(false)
//         else if (payModal) setPayModal(null)
//         else if (vendorModal) setVendorModal(null)
//         else if (openBillId) setOpenBillId(null)
//       }
//     },
//     [
//       view,
//       payModal,
//       vendorModal,
//       openBillId,
//       busy,
//       lines,
//       vendorId,
//       billDate,
//       vendorBillNo,
//       mode,
//       billAmount,
//       addToStock,
//       payNow,
//       payVia,
//       remarks,
//       ledger,
//       selVendor,
//       stockPriceModal
//     ]
//   )

//   const vendorField = (label, key, props = {}) => (
//     <label className="field">
//       <span>{label}</span>
//       <input
//         value={vendorModal.form[key]}
//         onChange={(e) => {
//           const val = e.target.value
//           setVendorModal((m) => ({ ...m, form: { ...m.form, [key]: val } }))
//         }}
//         {...props}
//       />
//     </label>
//   )

//   return (
//     <div className="purchase-page">
//       <div className="po-tabs">
//         {[
//           ['bill', 'New Bill', 'plus'],
//           ['ledger', 'Vendors & Ledger', 'book'],
//           ['history', 'Bill History', 'receipt']
//         ].map(([k, label, icon], i) => (
//           <button
//             key={k}
//             type="button"
//             className={'po-tab' + (view === k ? ' active' : '')}
//             onClick={() => setView(k)}
//             title={`Alt+${i + 1}`}
//           >
//             <Icon name={icon} size={15} /> {label}
//           </button>
//         ))}
//         <span className="pv-owed">
//           Owed to all vendors: <strong>{fmt(totalOwed)}</strong>
//         </span>
//         <button
//           type="button"
//           className="btn-sm ghost"
//           onClick={() => setStockPriceModal(true)}
//           title="See one product's full purchase & stock history, and adjust stock / prices"
//         >
//           <Icon name="book" size={14} /> Product Stock &amp; Purchase History
//         </button>
//       </div>

//       {notice && <div className="inv-notice">{notice}</div>}
//       {error && !payModal && (
//         <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
//           {error}
//         </div>
//       )}

//       {/* ═════════════ NEW BILL ═════════════ */}
//       {view === 'bill' && (
//         <div className="panel pv-bill">
//           <div className="pv-row">
//             <label className="field pv-vendor">
//               <span>Vendor</span>
//               <div className="pv-inline">
//                 <select
//                   value={vendorId}
//                   onChange={(e) => setVendorId(e.target.value)}
//                 >
//                   <option value="">— select vendor —</option>
//                   {vendors.map((v) => (
//                     <option key={v.id} value={v.id}>
//                       {v.name} {v.telephone ? `· ${v.telephone}` : ''}
//                     </option>
//                   ))}
//                 </select>
//                 <button
//                   type="button"
//                   className="btn-sm primary"
//                   title="Add a new vendor"
//                   onClick={() =>
//                     setVendorModal({ mode: 'create', form: { ...blankVendor } })
//                   }
//                 >
//                   <Icon name="plus" size={14} /> New vendor
//                 </button>
//               </div>
//             </label>
//             <label className="field">
//               <span>Bill date</span>
//               <input
//                 type="date"
//                 value={billDate}
//                 onChange={(e) => setBillDate(e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>Vendor's bill no. (optional)</span>
//               <input
//                 value={vendorBillNo}
//                 onChange={(e) => setVendorBillNo(e.target.value)}
//                 placeholder="e.g. 4521"
//               />
//             </label>
//           </div>

//           {vendor && (
//             <div className="pv-vcard">
//               <strong>{vendor.name}</strong>
//               {vendor.telephone && <span>☎ {vendor.telephone}</span>}
//               {vendor.address && <span>{vendor.address}</span>}
//               <span className="pv-vbal">
//                 Owed now: <strong>{fmt(owedBefore)}</strong>
//               </span>
//             </div>
//           )}

//           <div className="po-tabs pv-mode">
//             <button
//               type="button"
//               className={'po-tab' + (mode === 'lines' ? ' active' : '')}
//               onClick={() => setMode('lines')}
//             >
//               Product types
//             </button>
//             <button
//               type="button"
//               className={'po-tab' + (mode === 'amount' ? ' active' : '')}
//               onClick={() => setMode('amount')}
//             >
//               Bill amount only
//             </button>
//             {mode === 'lines' && (
//               <label
//                 className="bc-check pv-stock"
//                 title="Also add these quantities to Inventory stock"
//               >
//                 <input
//                   type="checkbox"
//                   checked={addToStock}
//                   onChange={(e) => setAddToStock(e.target.checked)}
//                 />{' '}
//                 Add to Inventory stock
//               </label>
//             )}
//           </div>

//           {mode === 'lines' ? (
//             <div className="pv-lines" style={{ padding: '0 16px' }}>
//               {/* Grid Header */}
//               <div
//                 style={{
//                   display: 'grid',
//                   gridTemplateColumns: `30px minmax(250px, 1fr) 90px 130px 110px ${addToStock ? '140px' : ''} 40px`,
//                   gap: 12,
//                   padding: '10px 0',
//                   borderBottom: '1px solid var(--border)',
//                   fontWeight: 'bold',
//                   fontSize: 13,
//                   color: 'var(--muted)'
//                 }}
//               >
//                 <div>#</div>
//                 <div>Product (Search or Type)</div>
//                 <div style={{ textAlign: 'right' }}>Qty</div>
//                 <div style={{ textAlign: 'right' }}>Total Price</div>
//                 <div style={{ textAlign: 'right' }}>Per piece</div>
//                 {addToStock && <div>Stock Op</div>}
//                 <div></div>
//               </div>

//               {/* Grid Body (Rows) */}
//               <div style={{ display: 'flex', flexDirection: 'column' }}>
//                 {lines.map((l, i) => (
//                   <div
//                     key={l.key}
//                     style={{
//                       display: 'grid',
//                       gridTemplateColumns: `30px minmax(250px, 1fr) 90px 130px 110px ${addToStock ? '140px' : ''} 40px`,
//                       gap: 12,
//                       padding: '12px 0',
//                       alignItems: 'start',
//                       borderBottom: '1px solid var(--border)'
//                     }}
//                   >
//                     <div style={{ paddingTop: 10 }}>{i + 1}</div>

//                     {/* Product Search Column */}
//                     <div style={{ position: 'relative' }}>
//                       <input
//                         ref={i === 0 ? firstLineRef : undefined}
//                         className="pv-in"
//                         style={{ width: '100%', boxSizing: 'border-box' }}
//                         value={l.description}
//                         placeholder="Search item code / name, or type custom..."
//                         onChange={(e) =>
//                           handleItemSearch(l.key, e.target.value)
//                         }
//                       />

//                       {/* Search Results Dropdown */}
//                       {l.searchResults?.length > 0 && (
//                         <div
//                           style={{
//                             position: 'absolute',
//                             top: '100%',
//                             left: 0,
//                             right: 0,
//                             zIndex: 1000,
//                             maxHeight: 200,
//                             overflowY: 'auto',
//                             background: 'var(--surface)',
//                             border: '1px solid var(--border)',
//                             boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
//                             borderRadius: 'var(--radius)',
//                             marginTop: 4
//                           }}
//                         >
//                           {l.searchResults.map((it) => (
//                             <div
//                               key={it.id}
//                               className="sr-row"
//                               style={{
//                                 padding: '8px 12px',
//                                 cursor: 'pointer',
//                                 borderBottom: '1px solid var(--border)'
//                               }}
//                               onClick={() => selectItem(l.key, it)}
//                             >
//                               <div
//                                 style={{
//                                   display: 'flex',
//                                   justifyContent: 'space-between'
//                                 }}
//                               >
//                                 <strong>{it.name}</strong>
//                                 <span className="muted-text">
//                                   {it.item_code}
//                                 </span>
//                               </div>
//                               <div
//                                 style={{
//                                   fontSize: 11,
//                                   color: 'var(--muted)',
//                                   marginTop: 4,
//                                   display: 'flex',
//                                   gap: 12
//                                 }}
//                               >
//                                 <span>Stock: {it.current_stock}</span>
//                                 <span>Cost: Rs. {it.purchase_price}</span>
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                       {/* Selected Item Context & Live Math */}
//                       {l.selectedItem && (
//                         <div
//                           style={{
//                             fontSize: 11,
//                             color: 'var(--muted)',
//                             marginTop: 6,
//                             display: 'flex',
//                             flexDirection: 'column',
//                             gap: 4
//                           }}
//                         >
//                           <div style={{ display: 'flex', gap: 12 }}>
//                             <span>
//                               Stock:{' '}
//                               <strong>{l.selectedItem.current_stock}</strong>
//                             </span>
//                             <span>
//                               Prev Price:{' '}
//                               <strong>
//                                 Rs. {l.selectedItem.purchase_price}
//                               </strong>
//                             </span>
//                             <span>
//                               Avg Cost:{' '}
//                               <strong>Rs. {l.selectedItem.average_cost}</strong>
//                             </span>
//                           </div>

//                           {/* Live New Avg Cost Calculation */}
//                           {Number(l.quantity) > 0 &&
//                             Number(l.lineTotal) > 0 && (
//                               <div
//                                 style={{
//                                   color: 'var(--primary)',
//                                   fontWeight: 'bold'
//                                 }}
//                               >
//                                 New Avg Cost: Rs.{' '}
//                                 {(() => {
//                                   const newRate =
//                                     Number(l.lineTotal) / Number(l.quantity)
//                                   const oldQty = Number(
//                                     l.selectedItem.current_stock
//                                   )
//                                   const oldValue =
//                                     oldQty * Number(l.selectedItem.average_cost)
//                                   const totalQty = oldQty + Number(l.quantity)
//                                   const newAvg =
//                                     totalQty > 0
//                                       ? (oldValue + Number(l.lineTotal)) /
//                                         totalQty
//                                       : newRate
//                                   return newAvg.toFixed(2)
//                                 })()}
//                               </div>
//                             )}
//                         </div>
//                       )}
//                     </div>

//                     {/* Qty */}
//                     <div>
//                       <input
//                         className="pv-in num"
//                         style={{
//                           width: '100%',
//                           boxSizing: 'border-box',
//                           textAlign: 'right'
//                         }}
//                         type="number"
//                         min="0"
//                         value={l.quantity}
//                         onChange={(e) =>
//                           setLine(l.key, 'quantity', e.target.value)
//                         }
//                       />
//                     </div>

//                     {/* Total Price */}
//                     <div>
//                       <input
//                         className="pv-in num"
//                         style={{
//                           width: '100%',
//                           boxSizing: 'border-box',
//                           textAlign: 'right'
//                         }}
//                         type="number"
//                         min="0"
//                         value={l.lineTotal}
//                         onChange={(e) =>
//                           setLine(l.key, 'lineTotal', e.target.value)
//                         }
//                         onKeyDown={(e) => {
//                           if (e.key === 'Enter' && i === lines.length - 1) {
//                             e.preventDefault()
//                             addLine()
//                           }
//                         }}
//                       />
//                     </div>

//                     {/* Per Piece */}
//                     <div
//                       style={{ paddingTop: 10, textAlign: 'right' }}
//                       className="num muted-text"
//                     >
//                       {lineRate(l) ? fmt(lineRate(l)) : '—'}
//                     </div>

//                     {/* Stock Operation */}
//                     {addToStock && (
//                       <div
//                         style={{
//                           display: 'flex',
//                           flexDirection: 'column',
//                           gap: 6
//                         }}
//                       >
//                         {l.selectedItem ? (
//                           <>
//                             <select
//                               className="pv-in"
//                               style={{
//                                 width: '100%',
//                                 boxSizing: 'border-box'
//                               }}
//                               value={l.stockOperation}
//                               onChange={(e) =>
//                                 setLine(l.key, 'stockOperation', e.target.value)
//                               }
//                             >
//                               <option value="add">Add to Stock</option>
//                               <option value="replace">Replace Stock</option>
//                             </select>

//                             {/* Selling price input only when item has none yet */}
//                             {(!l.selectedItem.selling_price ||
//                               Number(l.selectedItem.selling_price) <= 0) && (
//                               <input
//                                 className="pv-in"
//                                 type="number"
//                                 min="0"
//                                 placeholder="Set Selling Price *"
//                                 value={l.sellingPrice}
//                                 onChange={(e) =>
//                                   setLine(l.key, 'sellingPrice', e.target.value)
//                                 }
//                                 style={{
//                                   width: '100%',
//                                   boxSizing: 'border-box',
//                                   borderColor: 'var(--amber)'
//                                 }}
//                               />
//                             )}
//                           </>
//                         ) : (
//                           <div
//                             style={{ paddingTop: 10 }}
//                             className="muted-text"
//                           >
//                             —
//                           </div>
//                         )}
//                       </div>
//                     )}

//                     {/* Remove Button */}
//                     <div style={{ paddingTop: 4 }}>
//                       <button
//                         type="button"
//                         className="btn-icon danger"
//                         title="Remove line"
//                         onClick={() => removeLine(l.key)}
//                       >
//                         <Icon name="x" size={14} />
//                       </button>
//                     </div>
//                   </div>
//                 ))}
//               </div>

//               {/* Add Line Button */}
//               <div style={{ padding: '16px 0' }}>
//                 <button
//                   type="button"
//                   className="btn-sm ghost"
//                   onClick={addLine}
//                 >
//                   <Icon name="plus" size={14} /> Add product line
//                 </button>
//               </div>
//             </div>
//           ) : (
//             <label className="field" style={{ maxWidth: 320 }}>
//               <span>Bill amount</span>
//               <input
//                 type="number"
//                 min="0"
//                 value={billAmount}
//                 onChange={(e) => setBillAmount(e.target.value)}
//                 placeholder="e.g. 200000"
//               />
//             </label>
//           )}

//           <div className="pv-foot">
//             <div className="pv-pay">
//               <span className="field-label">Payment</span>
//               <div
//                 className="pay-type-group"
//                 style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}
//               >
//                 <button
//                   type="button"
//                   className={
//                     'pay-type-btn' +
//                     (payMode === 'none' ? ' active pv-record' : '')
//                   }
//                   onClick={() => setPayMode('none')}
//                 >
//                   Save only — pay later
//                 </button>
//                 <button
//                   type="button"
//                   className={
//                     'pay-type-btn' + (payMode === 'pay' ? ' active online' : '')
//                   }
//                   onClick={() => setPayMode('pay')}
//                 >
//                   Pay now
//                 </button>
//               </div>
//               {payMode === 'none' ? (
//                 <p className="muted-text pv-hint">
//                   Only the bill is recorded — the vendor's balance goes up, no
//                   money leaves Cash in Hand or Online. Pay any time later from{' '}
//                   <strong>Vendors &amp; Ledger → Pay vendor</strong>.
//                 </p>
//               ) : (
//                 <div className="pv-inline">
//                   <div
//                     className="pay-type-group"
//                     style={{
//                       gridTemplateColumns: 'repeat(2, 1fr)',
//                       minWidth: 220
//                     }}
//                   >
//                     <button
//                       type="button"
//                       className={
//                         'pay-type-btn' +
//                         (payVia === 'cash' ? ' active cash' : '')
//                       }
//                       onClick={() => setPayVia('cash')}
//                     >
//                       Cash in Hand
//                     </button>
//                     <button
//                       type="button"
//                       className={
//                         'pay-type-btn' +
//                         (payVia === 'bank' ? ' active online' : '')
//                       }
//                       onClick={() => setPayVia('bank')}
//                     >
//                       Online
//                     </button>
//                   </div>
//                   <input
//                     type="number"
//                     min="0"
//                     autoFocus
//                     value={payNow}
//                     onChange={(e) => setPayNow(e.target.value)}
//                     placeholder="Amount"
//                     className="pv-amount"
//                   />
//                   <button
//                     type="button"
//                     className="btn-sm ghost"
//                     onClick={() => setPayNow(String(billTotal))}
//                     disabled={!billTotal}
//                   >
//                     Pay full
//                   </button>
//                 </div>
//               )}
//               <input
//                 className="pv-remarks"
//                 value={remarks}
//                 onChange={(e) => setRemarks(e.target.value)}
//                 placeholder="Remarks (optional)"
//               />
//             </div>
//             <div className="totals pv-totals">
//               <div className="tot-row">
//                 <span>Bill total</span>
//                 <strong>{fmt(billTotal)}</strong>
//               </div>
//               {vendor && (
//                 <>
//                   <div className="tot-row">
//                     <span>Owed before</span>
//                     <span>{fmt(owedBefore)}</span>
//                   </div>
//                   {payMode === 'pay' && (
//                     <div className="tot-row">
//                       <span>
//                         Paid now (
//                         {payVia === 'bank' ? 'Online' : 'Cash in Hand'})
//                       </span>
//                       <span className="neg">−{fmt(payAmt)}</span>
//                     </div>
//                   )}
//                   <div className="tot-row">
//                     <span>Owed after this bill</span>
//                     <strong className={owedAfter > 0 ? 'neg' : 'pos'}>
//                       {fmt(owedAfter)}
//                     </strong>
//                   </div>
//                 </>
//               )}
//               <button
//                 type="button"
//                 className="btn-primary"
//                 onClick={() => saveBill()}
//                 disabled={busy}
//                 title="Save (F9)"
//               >
//                 {busy
//                   ? 'Saving…'
//                   : payMode === 'pay' && payAmt > 0
//                     ? `Save & pay ${fmt(payAmt)} from ${payVia === 'bank' ? 'Online' : 'Cash in Hand'} (F9)`
//                     : 'Save bill (no payment) (F9)'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ═════════════ VENDORS & LEDGER ═════════════ */}
//       {view === 'ledger' && (
//         <div className="credit-body">
//           <div className="inv-pane">
//             <div className="inv-pane-head">
//               <span>Vendors</span>
//               <label className="bc-check" title="Only vendors we still owe">
//                 <input
//                   type="checkbox"
//                   checked={owesOnly}
//                   onChange={(e) => setOwesOnly(e.target.checked)}
//                 />{' '}
//                 We owe
//               </label>
//             </div>
//             <div className="search-box" style={{ margin: 8 }}>
//               <Icon name="search" size={15} />
//               <input
//                 ref={vSearchRef}
//                 placeholder="Search name / code / phone (F2)"
//                 value={vSearch}
//                 onChange={(e) => setVSearch(e.target.value)}
//               />
//             </div>
//             <button
//               type="button"
//               className="btn-sm ghost"
//               style={{ margin: '0 8px 6px' }}
//               onClick={() =>
//                 setVendorModal({ mode: 'create', form: { ...blankVendor } })
//               }
//             >
//               <Icon name="plus" size={14} /> New vendor
//             </button>
//             <div className="inv-list">
//               {vendorList.length === 0 && (
//                 <div className="inv-empty">No vendors</div>
//               )}
//               {vendorList.map((v) => (
//                 <div
//                   key={v.id}
//                   tabIndex={0}
//                   data-nav-item
//                   className={
//                     'inv-list-item' + (selVendor === v.id ? ' active' : '')
//                   }
//                   onClick={() => setSelVendor(v.id)}
//                   onKeyDown={(e) => e.key === 'Enter' && setSelVendor(v.id)}
//                 >
//                   <div className="ili-text">
//                     <strong>{v.name}</strong>
//                     <span>
//                       {v.code}
//                       {v.telephone ? ` · ${v.telephone}` : ''}
//                     </span>
//                   </div>
//                   <span className="owe-amt">
//                     {Number(v.current_balance) > 0.009
//                       ? fmt(v.current_balance)
//                       : '—'}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           </div>

//           <div className="panel credit-detail" id="vendor-ledger">
//             {!ledger ? (
//               <div className="inv-empty" style={{ margin: 'auto' }}>
//                 Select a vendor to see their bills, payments and balance
//               </div>
//             ) : (
//               <>
//                 <div className="cd-head">
//                   <div>
//                     <h3>
//                       {ledger.vendor.name}{' '}
//                       <span className="muted-text">· {ledger.vendor.code}</span>
//                     </h3>
//                     <div className="cd-balance">
//                       {ledger.vendor.telephone && (
//                         <>☎ {ledger.vendor.telephone} · </>
//                       )}
//                       {ledger.vendor.address || 'no address'}
//                     </div>
//                     <div className="cd-balance">
//                       {Number(ledger.vendor.current_balance) < -0.009 ? (
//                         <>
//                           Vendor owes YOU (advance):{' '}
//                           <strong className="pos">
//                             {fmt(-ledger.vendor.current_balance)}
//                           </strong>
//                         </>
//                       ) : (
//                         <>
//                           Balance we owe:{' '}
//                           <strong>{fmt(ledger.vendor.current_balance)}</strong>
//                         </>
//                       )}
//                     </div>
//                   </div>
//                   <div className="pv-inline">
//                     {Number(ledger.vendor.current_balance) < -0.009 ? (
//                       <button
//                         type="button"
//                         className="btn-sm primary"
//                         onClick={openReceive}
//                         title="The vendor owes you — record the money they pay back"
//                       >
//                         <Icon name="wallet" size={14} /> Receive from vendor
//                       </button>
//                     ) : (
//                       <button
//                         type="button"
//                         className="btn-sm primary"
//                         onClick={openPay}
//                         disabled={Number(ledger.vendor.current_balance) <= 0}
//                       >
//                         <Icon name="wallet" size={14} /> Pay vendor
//                       </button>
//                     )}
//                     <button
//                       type="button"
//                       className="btn-sm ghost"
//                       onClick={() => {
//                         setVendorId(String(ledger.vendor.id))
//                         setView('bill')
//                       }}
//                     >
//                       <Icon name="plus" size={14} /> New bill
//                     </button>
//                     <button
//                       type="button"
//                       className="btn-sm ghost"
//                       onClick={() =>
//                         setVendorModal({
//                           mode: 'edit',
//                           id: ledger.vendor.id,
//                           form: {
//                             name: ledger.vendor.name || '',
//                             telephone: ledger.vendor.telephone || '',
//                             address: ledger.vendor.address || '',
//                             gstRegNo: ledger.vendor.gst_reg_no || '',
//                             ntn: ledger.vendor.ntn || '',
//                             openingBalance: ''
//                           }
//                         })
//                       }
//                     >
//                       Edit
//                     </button>
//                     <button
//                       type="button"
//                       className="btn-sm ghost"
//                       onClick={() => printNow()}
//                       title="Print this ledger"
//                     >
//                       <Icon name="printer" size={14} /> Print
//                     </button>
//                   </div>
//                 </div>

//                 <div className="report-bar" style={{ marginBottom: 8 }}>
//                   <div className="rb-dates">
//                     <label>
//                       From{' '}
//                       <input
//                         type="date"
//                         value={lFrom}
//                         onChange={(e) => setLFrom(e.target.value)}
//                       />
//                     </label>
//                     <label>
//                       To{' '}
//                       <input
//                         type="date"
//                         value={lTo}
//                         onChange={(e) => setLTo(e.target.value)}
//                       />
//                     </label>
//                     <DatePresets
//                       from={lFrom}
//                       to={lTo}
//                       onChange={(r) => {
//                         setLFrom(r.from)
//                         setLTo(r.to)
//                       }}
//                     />
//                   </div>
//                 </div>

//                 <div
//                   className="report-cards"
//                   style={{
//                     gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'
//                   }}
//                 >
//                   <div className="rc-card">
//                     <span>Opening</span>
//                     <strong>{fmt(ledger.opening)}</strong>
//                   </div>
//                   <div className="rc-card">
//                     <span>Bills (+)</span>
//                     <strong>{fmt(ledger.totals.billed)}</strong>
//                   </div>
//                   <div className="rc-card">
//                     <span>Paid (−)</span>
//                     <strong className="pos">{fmt(ledger.totals.paid)}</strong>
//                   </div>
//                   <div className="rc-card amber">
//                     <span>Balance</span>
//                     <strong>{fmt(ledger.totals.closing)}</strong>
//                   </div>
//                 </div>

//                 <div className="table-scroll">
//                   <table className="data-table">
//                     <thead>
//                       <tr>
//                         <th>Date</th>
//                         <th>Ref</th>
//                         <th>Details</th>
//                         <th className="num">Bill (+)</th>
//                         <th className="num">Paid (−)</th>
//                         <th className="num">Balance</th>
//                         <th></th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       <tr className="pv-opening">
//                         <td colSpan="5">Opening balance</td>
//                         <td className="num strong">{fmt(ledger.opening)}</td>
//                         <td></td>
//                       </tr>
//                       {ledger.rows.length === 0 && (
//                         <tr>
//                           <td colSpan="7" className="empty">
//                             No bills or payments in these dates
//                           </td>
//                         </tr>
//                       )}
//                       {ledger.rows.map((r) => (
//                         <FragmentRow key={r.id}>
//                           <tr>
//                             <td>{r.date}</td>
//                             <td>
//                               {r.type === 'bill' ? (
//                                 <button
//                                   type="button"
//                                   className="po-badge ordered pv-badge-btn"
//                                   title="Open bill (edit / return)"
//                                   onClick={() => showBill(r.billId)}
//                                 >
//                                   {r.serial || 'BILL'}
//                                 </button>
//                               ) : r.type === 'payment' ? (
//                                 <span className="po-badge received">
//                                   {r.voucherNo || 'PAID'}
//                                 </span>
//                               ) : r.type === 'return' ? (
//                                 <button
//                                   type="button"
//                                   className="po-badge cancelled pv-badge-btn"
//                                   title="Open the bill"
//                                   onClick={() => showBill(r.returnBillId)}
//                                 >
//                                   {r.returnNo || 'RETURN'}
//                                 </button>
//                               ) : r.type === 'refund' ? (
//                                 <span className="po-badge received">
//                                   {r.voucherNo || 'REFUND'}
//                                 </span>
//                               ) : (
//                                 <span className="po-badge">{r.type}</span>
//                               )}
//                             </td>
//                             <td>
//                               {r.type === 'bill' && r.lines?.length > 0 ? (
//                                 <button
//                                   type="button"
//                                   className="pv-link"
//                                   onClick={() =>
//                                     setOpenBill(openBill === r.id ? null : r.id)
//                                   }
//                                 >
//                                   {openBill === r.id ? '▼' : '▶'}{' '}
//                                   {r.lines.length} product type
//                                   {r.lines.length > 1 ? 's' : ''}
//                                   {r.vendorBillNo
//                                     ? ` · vendor #${r.vendorBillNo}`
//                                     : ''}
//                                   {r.stockAdded ? ' · stock added' : ''}
//                                 </button>
//                               ) : r.type === 'payment' ? (
//                                 <span>
//                                   {r.accountType === 'bank'
//                                     ? 'Online'
//                                     : 'Cash in Hand'}{' '}
//                                   ·{' '}
//                                   {r.description
//                                     ?.split(' · ')
//                                     .slice(1)
//                                     .join(' · ')}
//                                 </span>
//                               ) : r.type === 'return' || r.type === 'refund' ? (
//                                 <span>
//                                   {r.description
//                                     ?.split(' · ')
//                                     .slice(1)
//                                     .join(' · ')}
//                                 </span>
//                               ) : (
//                                 r.description
//                               )}
//                             </td>
//                             <td className="num">{r.bill ? fmt(r.bill) : ''}</td>
//                             <td className="num pos">
//                               {r.paid ? fmt(r.paid) : ''}
//                             </td>
//                             <td className="num strong">{fmt(r.balance)}</td>
//                             <td className="num">
//                               {r.voucherId && (
//                                 <button
//                                   type="button"
//                                   className="btn-icon danger"
//                                   title="Delete this payment"
//                                   onClick={() => removePayment(r)}
//                                 >
//                                   <Icon name="trash" size={14} />
//                                 </button>
//                               )}
//                               {r.billId && (
//                                 <button
//                                   type="button"
//                                   className="btn-icon"
//                                   title="Open bill: edit / return to vendor"
//                                   onClick={() => showBill(r.billId)}
//                                 >
//                                   <Icon name="edit" size={14} />
//                                 </button>
//                               )}
//                               {r.returnId && (
//                                 <button
//                                   type="button"
//                                   className="btn-icon danger"
//                                   title="Delete this return"
//                                   onClick={() => removeReturn(r)}
//                                 >
//                                   <Icon name="trash" size={14} />
//                                 </button>
//                               )}
//                             </td>
//                           </tr>
//                           {openBill === r.id &&
//                             r.lines.map((l, i) => (
//                               <tr key={i} className="pv-subline">
//                                 <td></td>
//                                 <td></td>
//                                 <td>
//                                   {l.description} × {l.quantity} @ {fmt(l.rate)}
//                                   {l.linked ? ' (in stock)' : ''}
//                                 </td>
//                                 <td className="num muted-text">
//                                   {fmt(l.amount)}
//                                 </td>
//                                 <td colSpan="3"></td>
//                               </tr>
//                             ))}
//                         </FragmentRow>
//                       ))}
//                     </tbody>
//                     <tfoot>
//                       <tr>
//                         <td colSpan="3" className="num strong">
//                           Totals
//                         </td>
//                         <td className="num strong">
//                           {fmt(ledger.totals.billed)}
//                         </td>
//                         <td className="num strong pos">
//                           {fmt(ledger.totals.paid)}
//                         </td>
//                         <td className="num strong">
//                           {fmt(ledger.totals.closing)}
//                         </td>
//                         <td></td>
//                       </tr>
//                     </tfoot>
//                   </table>
//                 </div>
//               </>
//             )}
//           </div>
//         </div>
//       )}

//       {/* ═════════════ BILL HISTORY ═════════════ */}
//       {view === 'history' && (
//         <div className="panel report-table-wrap">
//           <div className="report-bar">
//             <div className="rb-dates">
//               <label>
//                 From{' '}
//                 <input
//                   type="date"
//                   value={hFrom}
//                   onChange={(e) => setHFrom(e.target.value)}
//                 />
//               </label>
//               <label>
//                 To{' '}
//                 <input
//                   type="date"
//                   value={hTo}
//                   onChange={(e) => setHTo(e.target.value)}
//                 />
//               </label>
//               <DatePresets
//                 from={hFrom}
//                 to={hTo}
//                 onChange={(r) => {
//                   setHFrom(r.from)
//                   setHTo(r.to)
//                 }}
//               />
//             </div>
//             <div className="search-box">
//               <Icon name="search" size={15} />
//               <input
//                 placeholder="Vendor / bill no."
//                 value={hSearch}
//                 onChange={(e) => setHSearch(e.target.value)}
//               />
//             </div>
//           </div>
//           <p
//             className="muted-text"
//             style={{ fontSize: 12, margin: '4px 0 6px' }}
//           >
//             {bills.rows.length} bill{bills.rows.length === 1 ? '' : 's'} ·{' '}
//             {fmt(bills.total)}
//           </p>
//           <div className="table-scroll">
//             <table className="data-table">
//               <thead>
//                 <tr>
//                   <th>Bill</th>
//                   <th>Date</th>
//                   <th>Vendor</th>
//                   <th>Vendor bill #</th>
//                   <th className="num">Types</th>
//                   <th className="num">Total</th>
//                   <th className="num">Paid with bill</th>
//                   <th className="num">Returned</th>
//                   <th>Stock</th>
//                   <th>Edited</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {bills.rows.length === 0 ? (
//                   <tr>
//                     <td colSpan="10" className="empty">
//                       No bills in these dates
//                     </td>
//                   </tr>
//                 ) : (
//                   bills.rows.map((b) => (
//                     <tr
//                       key={b.id}
//                       className="clickable"
//                       onClick={() => showBill(b.id)}
//                     >
//                       <td className="strong">{b.serial_no}</td>
//                       <td>{b.order_date}</td>
//                       <td>{b.vendor || '—'}</td>
//                       <td>{b.vendor_bill_no || '—'}</td>
//                       <td className="num">{b.line_count || 'amount only'}</td>
//                       <td className="num strong">{fmt(b.total)}</td>
//                       <td className="num">
//                         {Number(b.paid_with_bill) ? fmt(b.paid_with_bill) : '—'}
//                       </td>
//                       <td
//                         className={
//                           'num' + (Number(b.returned_value) ? ' neg' : '')
//                         }
//                       >
//                         {Number(b.return_count)
//                           ? `${fmt(b.returned_value)} (${b.return_count})`
//                           : '—'}
//                       </td>
//                       <td>{b.adds_stock ? 'added' : '—'}</td>
//                       <td>{Number(b.edit_count) ? `${b.edit_count}×` : '—'}</td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}

//       {/* ═════════════ MODALS ═════════════ */}
//       {vendorModal && (
//         <Modal
//           title={vendorModal.mode === 'create' ? 'New vendor' : 'Edit vendor'}
//           onClose={() => setVendorModal(null)}
//           footer={
//             <>
//               <button
//                 className="btn-secondary"
//                 onClick={() => setVendorModal(null)}
//               >
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveVendor}
//                 disabled={busy}
//               >
//                 Save (F9)
//               </button>
//             </>
//           }
//         >
//           {vendorField('Name *', 'name', { autoFocus: true })}
//           <div className="field-row">
//             {vendorField('Contact number', 'telephone')}
//             {vendorField('GST reg. no.', 'gstRegNo')}
//           </div>
//           {vendorField('Address', 'address')}
//           <div className="field-row">
//             {vendorField('NTN', 'ntn')}
//             {vendorModal.mode === 'create' &&
//               vendorField('Old balance we owe (optional)', 'openingBalance', {
//                 type: 'number',
//                 min: 0
//               })}
//           </div>
//         </Modal>
//       )}

//       {payModal && ledger && (
//         <Modal
//           title={
//             payModal.mode === 'receive'
//               ? `Receive money from ${ledger.vendor.name}`
//               : `Pay ${ledger.vendor.name}`
//           }
//           onClose={() => setPayModal(null)}
//           footer={
//             <>
//               <button
//                 className="btn-secondary"
//                 onClick={() => setPayModal(null)}
//               >
//                 Cancel
//               </button>
//               <button className="btn-primary" onClick={savePay} disabled={busy}>
//                 {busy
//                   ? 'Saving…'
//                   : payModal.mode === 'receive'
//                     ? 'Save received money (F9)'
//                     : 'Save payment (F9)'}
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <p className="muted-text" style={{ marginTop: 0 }}>
//             {payModal.mode === 'receive' ? (
//               <>
//                 {ledger.vendor.name} owes you:{' '}
//                 <strong>
//                   {fmt(Math.abs(Number(ledger.vendor.current_balance)))}
//                 </strong>
//               </>
//             ) : (
//               <>
//                 Balance we owe:{' '}
//                 <strong>{fmt(ledger.vendor.current_balance)}</strong>
//               </>
//             )}
//           </p>
//           <div className="field">
//             <span className="field-label">
//               {payModal.mode === 'receive' ? 'Received into' : 'Pay from'}
//             </span>
//             <div
//               className="pay-type-group"
//               style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
//             >
//               <button
//                 type="button"
//                 className={
//                   'pay-type-btn' +
//                   (payModal.via === 'cash' ? ' active cash' : '')
//                 }
//                 onClick={() => setPayModal((pm) => ({ ...pm, via: 'cash' }))}
//               >
//                 Cash in Hand
//               </button>
//               <button
//                 type="button"
//                 className={
//                   'pay-type-btn' +
//                   (payModal.via === 'bank' ? ' active online' : '')
//                 }
//                 onClick={() => setPayModal((pm) => ({ ...pm, via: 'bank' }))}
//               >
//                 Online
//               </button>
//             </div>
//           </div>
//           <div className="field-row">
//             <label className="field">
//               <span>
//                 Amount <em className="hint-em">(F6 = full balance)</em>
//               </span>
//               <input
//                 type="number"
//                 min="0"
//                 autoFocus
//                 value={payModal.amount}
//                 onChange={(e) =>
//                   setPayModal((pm) => ({ ...pm, amount: e.target.value }))
//                 }
//                 onKeyDown={(e) => e.key === 'Enter' && savePay()}
//               />
//             </label>
//             <label className="field">
//               <span>Date</span>
//               <input
//                 type="date"
//                 value={payModal.date}
//                 onChange={(e) =>
//                   setPayModal((pm) => ({ ...pm, date: e.target.value }))
//                 }
//               />
//             </label>
//           </div>
//           <label className="field">
//             <span>Note (optional)</span>
//             <input
//               value={payModal.note}
//               onChange={(e) =>
//                 setPayModal((pm) => ({ ...pm, note: e.target.value }))
//               }
//             />
//           </label>
//           {Number(payModal.amount) > 0 && payModal.mode !== 'receive' && (
//             <p className="muted-text">
//               Balance after payment:{' '}
//               <strong>
//                 {fmt(
//                   r2(
//                     Number(ledger.vendor.current_balance) -
//                       Number(payModal.amount)
//                   )
//                 )}
//               </strong>
//             </p>
//           )}
//           {Number(payModal.amount) > 0 && payModal.mode === 'receive' && (
//             <p className="muted-text">
//               Vendor will still owe you:{' '}
//               <strong>
//                 {fmt(
//                   Math.max(
//                     0,
//                     r2(
//                       Math.abs(Number(ledger.vendor.current_balance)) -
//                         Number(payModal.amount)
//                     )
//                   )
//                 )}
//               </strong>
//             </p>
//           )}
//         </Modal>
//       )}

//       {stockPriceModal && (
//         <ProductHistoryModal
//           onClose={() => setStockPriceModal(false)}
//           onSaved={() => {
//             loadRefs()
//             if (items.length > 0)
//               inventoryApi.items
//                 .list({})
//                 .then(setItems)
//                 .catch(() => {})
//           }}
//         />
//       )}

//       {openBillId && (
//         <PurchaseBillModal
//           billId={openBillId}
//           uid={uid}
//           accounts={accounts}
//           onClose={() => setOpenBillId(null)}
//           onChanged={onBillChanged}
//           onDelete={(b) => {
//             if (b.payments?.length)
//               return `This bill has a payment made with it — delete that payment first (vendor ledger).`
//             if (b.returns?.length)
//               return 'This bill has returns to the vendor — delete those returns first.'
//             removeBill(b.id, b.serial_no, !!b.adds_stock)
//           }}
//         />
//       )}

//       <div className="hotkey-hint">
//         <span>
//           <kbd>Alt</kbd>+<kbd>1/2/3</kbd> Tabs
//         </span>
//         <span>
//           <kbd>F2</kbd> Search / first line
//         </span>
//         <span>
//           <kbd>F9</kbd> Save
//         </span>
//         <span>
//           <kbd>F6</kbd> Full balance (pay)
//         </span>
//         <span>
//           <kbd>F5</kbd> Refresh
//         </span>
//         <span>
//           <kbd>Esc</kbd> Close
//         </span>
//       </div>
//     </div>
//   )
// }

// // Groups a ledger row with its expanded product lines (keys stay on the outer element).
// function FragmentRow({ children }) {
//   return <>{children}</>
// }

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { purchasesApi, inventoryApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import PurchaseBillModal from '../components/PurchaseBillModal.jsx'
import ProductHistoryModal from '../components/ProductHistoryModal.jsx'
import DatePresets from '../components/DatePresets.jsx'
import { localToday } from '../utils/date.js'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'
import { notifyStockChanged } from '../utils/lowStock.js'

// Purchases = the VENDOR ACCOUNT BOOK (client's requirement):
//  • New Bill: pick a vendor, type the product types that came (qty + that type's total) —
//    or just the bill amount — optionally add them to Inventory stock, optionally pay now.
//  • Vendors & Ledger: like credit customers — each vendor's bills (+), payments (−) and
//    balance; pay any amount any time from Cash in Hand or Online (bank).
//  • Bill History: every bill, by date.
// Payments reduce the Dashboard's Cash in Hand / Bank-Online card and the Sales card.

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
let keySeq = 0

const blankLine = () => ({
  key: ++keySeq,
  description: '',
  quantity: '',
  rate: '',
  lineTotal: '',
  itemId: '',
  stockOperation: 'add', // 'add' | 'replace'
  searchResults: [],
  selectedItem: null,
  sellingPrice: ''
})

const blankVendor = {
  name: '',
  telephone: '',
  address: '',
  gstRegNo: '',
  ntn: '',
  openingBalance: ''
}

export default function Purchases() {
  const { session } = useAuth()
  const uid = session?.id
  const [view, setView] = useState('bill') // 'bill' | 'ledger' | 'history'
  const [vendors, setVendors] = useState([])
  const [accounts, setAccounts] = useState([])
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // ── new bill ──
  const [vendorId, setVendorId] = useState('')
  const [billDate, setBillDate] = useState(localToday())
  const [vendorBillNo, setVendorBillNo] = useState('')
  const [mode, setMode] = useState('lines') // 'lines' | 'amount'
  const [lines, setLines] = useState([blankLine()])
  const [billAmount, setBillAmount] = useState('')
  const [addToStock, setAddToStock] = useState(false)
  // Owner's rule: saving a bill only RECORDS it. Money moves only if "Pay now" is chosen
  // on purpose (or later from Vendors & Ledger → Pay vendor). Default is always 'none'.
  const [payMode, setPayMode] = useState('none') // 'none' | 'pay'
  const [payNow, setPayNow] = useState('')
  const [payVia, setPayVia] = useState('cash') // 'cash' | 'bank'
  const [remarks, setRemarks] = useState('')

  // ── vendors & ledger ──
  const [selVendor, setSelVendor] = useState(null)
  const [vSearch, setVSearch] = useState('')
  const [owesOnly, setOwesOnly] = useState(false)
  const [ledger, setLedger] = useState(null)
  const [lFrom, setLFrom] = useState('')
  const [lTo, setLTo] = useState('')
  const [openBill, setOpenBill] = useState(null)

  // ── history ──
  const [hFrom, setHFrom] = useState(localToday().slice(0, 8) + '01')
  const [hTo, setHTo] = useState(localToday())
  const [hSearch, setHSearch] = useState('')
  const [bills, setBills] = useState({ rows: [], total: 0 })
  const [openBillId, setOpenBillId] = useState(null)

  // ── modals ──
  const [vendorModal, setVendorModal] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [stockPriceModal, setStockPriceModal] = useState(false)

  const firstLineRef = useRef(null)
  const vSearchRef = useRef(null)
  const searchTimer = useRef(null)

  const cashAcct = accounts.find((a) => a.type === 'cash')
  const bankAcct = accounts.find((a) => a.type === 'bank')
  const acctFor = (via) => (via === 'bank' ? bankAcct : cashAcct)

  const noticeTimer = useRef(null)
  const confirmFunds = (via, amount) => {
    const acct = acctFor(via)
    const bal = Number(acct?.current_balance) || 0
    if (amount <= bal + 0.009) return true
    return window.confirm(
      `${via === 'bank' ? 'Online (bank)' : 'Cash in Hand'} has only ${fmt(bal)}. ` +
        `Paying ${fmt(amount)} will make it ${fmt(bal - amount)}. Pay anyway?`
    )
  }

  const flash = (msg) => {
    setNotice(msg)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 8000)
  }
  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current)
      clearTimeout(searchTimer.current)
    },
    []
  )

  const loadRefs = useCallback(async () => {
    const [v, a] = await Promise.all([
      purchasesApi.vendors(),
      purchasesApi.accounts()
    ])
    setVendors(v)
    setAccounts(a)
  }, [])
  useEffect(() => {
    loadRefs().catch((e) => setError(e.message))
  }, [loadRefs])

  useEffect(() => {
    if (addToStock && items.length === 0)
      inventoryApi.items
        .list({})
        .then(setItems)
        .catch((e) => setError(e.message))
  }, [addToStock, items.length])

  const loadLedger = useCallback(async () => {
    if (!selVendor) return setLedger(null)
    setLedger(
      await purchasesApi.vendorLedger({
        actingUserId: uid,
        vendorId: selVendor,
        from: lFrom,
        to: lTo
      })
    )
  }, [uid, selVendor, lFrom, lTo])
  useEffect(() => {
    loadLedger().catch((e) => setError(e.message))
  }, [loadLedger])

  const loadBills = useCallback(async () => {
    setBills(
      await purchasesApi.bills({
        actingUserId: uid,
        from: hFrom,
        to: hTo,
        search: hSearch
      })
    )
  }, [uid, hFrom, hTo, hSearch])
  useEffect(() => {
    if (view === 'history') loadBills().catch((e) => setError(e.message))
  }, [view, loadBills])

  // ── bill maths ──
  const billTotal =
    mode === 'lines'
      ? r2(lines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0))
      : r2(Number(billAmount) || 0)
  const vendor = vendors.find((v) => String(v.id) === String(vendorId))
  const owedBefore = Number(vendor?.current_balance) || 0
  const payAmt = payMode === 'pay' ? r2(Number(payNow) || 0) : 0
  const owedAfter = r2(owedBefore + billTotal - payAmt)

  const setLine = (key, field, value) =>
    setLines((p) =>
      p.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    )

  // ── NEW: dedicated updaters that keep qty × rate = total in sync ──
  const updateQty = (key, val) => {
    setLines((p) =>
      p.map((l) => {
        if (l.key !== key) return l
        const numQty = Number(val) || 0
        const rate = Number(l.rate) || 0
        // Recalculate total if rate is set
        const total = rate > 0 ? (numQty * rate).toFixed(2) : l.lineTotal
        return { ...l, quantity: val, lineTotal: total }
      })
    )
  }

  const updateRate = (key, val) => {
    setLines((p) =>
      p.map((l) => {
        if (l.key !== key) return l
        const numRate = Number(val) || 0
        const qty = Number(l.quantity) || 0
        const total = (qty * numRate).toFixed(2)
        return { ...l, rate: val, lineTotal: total }
      })
    )
  }

  const updateTotal = (key, val) => {
    setLines((p) =>
      p.map((l) => {
        if (l.key !== key) return l
        const numTotal = Number(val) || 0
        const qty = Number(l.quantity) || 0
        // Recalculate rate to keep math consistent if user edits total directly
        const rate = qty > 0 ? (numTotal / qty).toFixed(2) : l.rate
        return { ...l, lineTotal: val, rate: rate }
      })
    )
  }

  const handleItemSearch = (key, value) => {
    setLine(key, 'description', value)
    setLine(key, 'selectedItem', null)
    setLine(key, 'itemId', '')

    clearTimeout(searchTimer.current)
    if (!value.trim()) {
      setLine(key, 'searchResults', [])
      return
    }

    searchTimer.current = setTimeout(async () => {
      try {
        const results = await inventoryApi.items.list({ search: value })
        setLine(key, 'searchResults', results.slice(0, 10))
      } catch (e) {
        console.error(e)
      }
    }, 200)
  }

  const selectItem = (key, it) => {
    setLines((p) =>
      p.map((l) => {
        if (l.key !== key) return l
        const qty = l.quantity ? Number(l.quantity) : 1
        const rate = Number(it.purchase_price || 0)
        return {
          ...l,
          itemId: it.id,
          description: it.name,
          quantity: qty,
          rate: rate,
          lineTotal: (qty * rate).toFixed(2),
          selectedItem: it,
          searchResults: [],
          sellingPrice: String(it.selling_price || '') // Pre-fill
        }
      })
    )
  }

  const addLine = () => setLines((p) => [...p, blankLine()])
  const removeLine = (key) =>
    setLines((p) =>
      p.length > 1 ? p.filter((l) => l.key !== key) : [blankLine()]
    )

  const resetBill = () => {
    setLines([blankLine()])
    setBillAmount('')
    setVendorBillNo('')
    setPayNow('')
    setPayMode('none')
    setRemarks('')
    setAddToStock(false)
    setBillDate(localToday())
  }

  const saveBill = async (allowDuplicateBillNo = false) => {
    if (busy) return
    setError('')
    if (!vendorId)
      return setError('Select the vendor first (or add a new one with +).')
    if (billTotal <= 0)
      return setError(
        'Add product types with their total, or enter the bill amount.'
      )
    if (payMode === 'pay' && payAmt <= 0)
      return setError(
        'Enter the amount to pay now — or choose "Save only — pay later".'
      )
    if (payAmt > 0 && !acctFor(payVia))
      return setError('No account found for this payment type.')
    if (!allowDuplicateBillNo && payAmt > 0 && !confirmFunds(payVia, payAmt))
      return
    setBusy(true)
    let askDuplicate = null
    try {
      const res = await purchasesApi.createBill({
        actingUserId: uid,
        vendorId: Number(vendorId),
        billDate,
        vendorBillNo,
        allowDuplicateBillNo,
        lines:
          mode === 'lines'
            ? lines.map((l) => ({
                description: l.description,
                quantity: Number(l.quantity) || 0,
                rate: Number(l.rate) || 0,
                lineTotal: Number(l.lineTotal) || 0,
                itemId: addToStock && l.itemId ? Number(l.itemId) : null,
                stockOperation:
                  addToStock && l.selectedItem ? l.stockOperation : 'add',
                sellingPrice:
                  addToStock && l.selectedItem ? Number(l.sellingPrice) : 0
              }))
            : [],
        billAmount: mode === 'amount' ? billTotal : 0,
        addToStock: mode === 'lines' && addToStock,
        payNow: payAmt,
        accountId: payAmt > 0 ? acctFor(payVia).id : null,
        remarks
      })
      flash(
        `Bill ${res.serial} saved — ${fmt(res.total)} added to ${vendor.name}.` +
          (res.payment
            ? ` Paid ${fmt(res.payment.amount)} from ${res.payment.account}.`
            : '') +
          (res.stockAdded ? ' Stock updated.' : '')
      )
      if (res.stockAdded) notifyStockChanged()
      resetBill()
      await loadRefs()
      if (String(selVendor) === String(vendorId)) loadLedger()
    } catch (e) {
      const m = /^DUPLICATE_VENDOR_BILL:(.*)$/.exec(e.message || '')
      if (m) askDuplicate = m[1]
      else setError(e.message)
    } finally {
      setBusy(false)
    }
    if (
      askDuplicate &&
      window.confirm(
        `Vendor bill # "${vendorBillNo}" is already recorded for this vendor (${askDuplicate}).\n` +
          "Is this really a different bill? OK = save it anyway, Cancel = don't save."
      )
    )
      saveBill(true)
  }

  const saveVendor = async () => {
    const f = vendorModal.form
    if (!f.name.trim()) return setError('Vendor name is required.')
    setBusy(true)
    setError('')
    try {
      if (vendorModal.mode === 'create') {
        const r = await purchasesApi.createVendor({
          ...f,
          openingBalance: Number(f.openingBalance) || 0
        })
        await loadRefs()
        setVendorId(String(r.id))
        if (view === 'ledger') setSelVendor(r.id)
        flash(`Vendor "${f.name.trim()}" added.`)
      } else {
        await purchasesApi.updateVendor({
          actingUserId: uid,
          id: vendorModal.id,
          ...f
        })
        await loadRefs()
        loadLedger()
        flash('Vendor details saved.')
      }
      setVendorModal(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openPay = () => {
    setError('')
    setPayModal({
      mode: 'pay',
      amount: '',
      via: 'cash',
      date: localToday(),
      note: ''
    })
  }
  const openReceive = () => {
    setError('')
    setPayModal({
      mode: 'receive',
      amount: '',
      via: 'cash',
      date: localToday(),
      note: ''
    })
  }
  const savePay = async () => {
    const amt = r2(Number(payModal.amount) || 0)
    if (amt <= 0) return setError('Enter the amount paid.')
    const acct = acctFor(payModal.via)
    if (!acct) return setError('No account found for this payment type.')
    if (payModal.mode === 'receive') {
      setBusy(true)
      setError('')
      try {
        const r = await purchasesApi.receiveFromVendor({
          actingUserId: uid,
          vendorId: selVendor,
          amount: amt,
          accountId: acct.id,
          date: payModal.date,
          note: payModal.note
        })
        flash(
          `${r.voucherNo}: received ${fmt(r.amount)} from ${ledger.vendor.name} into ${r.account}.`
        )
        setPayModal(null)
        await loadRefs()
        await loadLedger()
      } catch (e) {
        setError(e.message)
      } finally {
        setBusy(false)
      }
      return
    }
    const owed = Number(ledger?.vendor?.current_balance) || 0
    if (amt > owed + 0.009)
      return setError(
        `Payment is more than the balance owed to ${ledger.vendor.name} (${fmt(owed)}).`
      )
    if (!confirmFunds(payModal.via, amt)) return
    setBusy(true)
    setError('')
    try {
      const r = await purchasesApi.payVendor({
        actingUserId: uid,
        vendorId: selVendor,
        amount: amt,
        accountId: acct.id,
        date: payModal.date,
        note: payModal.note
      })
      flash(
        `${r.voucherNo}: paid ${fmt(r.amount)} to ${ledger.vendor.name} from ${r.account}.`
      )
      setPayModal(null)
      await loadRefs()
      await loadLedger()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removePayment = async (row) => {
    const msg =
      row.type === 'refund'
        ? `Delete ${row.voucherNo} — ${fmt(row.bill)} received from the vendor? The money leaves ${row.account} again and the vendor owes you again.`
        : `Delete payment ${row.voucherNo} of ${fmt(row.paid)}? The money goes back to ${row.account} and the vendor balance goes up again.`
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      await purchasesApi.deleteVendorPayment({
        actingUserId: uid,
        voucherId: row.voucherId
      })
      await loadRefs()
      await loadLedger()
      flash('Payment deleted.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const removeBill = async (id, label, stockAdded) => {
    if (
      !window.confirm(
        `Delete bill ${label}? The vendor balance goes down by its amount.${stockAdded ? ' The stock it added is taken back out.' : ''}`
      )
    )
      return
    setBusy(true)
    try {
      await purchasesApi.deleteBill({ actingUserId: uid, id })
      if (stockAdded) notifyStockChanged()
      setOpenBillId(null)
      await loadRefs()
      await loadLedger()
      if (view === 'history') await loadBills()
      flash(`Bill ${label} deleted.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const showBill = (id) => setOpenBillId(id)
  const onBillChanged = async (msg) => {
    if (msg) flash(msg)
    await loadRefs()
    await loadLedger()
    if (view === 'history') await loadBills()
  }
  const removeReturn = async (row) => {
    if (
      !window.confirm(
        `Delete return ${row.returnNo}? Everything it changed is reversed.`
      )
    )
      return
    setBusy(true)
    try {
      await purchasesApi.deleteReturn({ actingUserId: uid, id: row.returnId })
      await onBillChanged(`Return ${row.returnNo} deleted.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const vendorList = useMemo(() => {
    const q = vSearch.trim().toLowerCase()
    return vendors
      .filter((v) => !owesOnly || Number(v.current_balance) > 0.009)
      .filter(
        (v) =>
          !q ||
          v.name.toLowerCase().includes(q) ||
          String(v.code).includes(q) ||
          String(v.telephone || '').includes(q)
      )
      .sort(
        (a, b) =>
          Number(b.current_balance) - Number(a.current_balance) ||
          a.name.localeCompare(b.name)
      )
  }, [vendors, vSearch, owesOnly])
  const totalOwed = vendors.reduce(
    (s, v) => s + Math.max(0, Number(v.current_balance) || 0),
    0
  )

  useHotkeys(
    {
      f9: () => {
        if (payModal) savePay()
        else if (vendorModal) saveVendor()
        else if (!stockPriceModal && view === 'bill') saveBill()
      },
      f5: () => {
        loadRefs()
        if (view === 'ledger') loadLedger()
        if (view === 'history') loadBills()
      },
      f2: () => {
        if (view === 'ledger') vSearchRef.current?.focus()
        else firstLineRef.current?.focus()
      },
      f6: () => {
        if (payModal && ledger)
          setPayModal((pm) => ({
            ...pm,
            amount: String(
              pm.mode === 'receive'
                ? Math.abs(Math.min(0, ledger.vendor.current_balance))
                : Math.max(0, ledger.vendor.current_balance)
            )
          }))
      },
      'alt+1': () => setView('bill'),
      'alt+2': () => setView('ledger'),
      'alt+3': () => setView('history'),
      escape: () => {
        if (stockPriceModal) setStockPriceModal(false)
        else if (payModal) setPayModal(null)
        else if (vendorModal) setVendorModal(null)
        else if (openBillId) setOpenBillId(null)
      }
    },
    [
      view,
      payModal,
      vendorModal,
      openBillId,
      busy,
      lines,
      vendorId,
      billDate,
      vendorBillNo,
      mode,
      billAmount,
      addToStock,
      payNow,
      payVia,
      remarks,
      ledger,
      selVendor,
      stockPriceModal
    ]
  )

  const vendorField = (label, key, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input
        value={vendorModal.form[key]}
        onChange={(e) => {
          const val = e.target.value
          setVendorModal((m) => ({ ...m, form: { ...m.form, [key]: val } }))
        }}
        {...props}
      />
    </label>
  )

  return (
    <div className="purchase-page">
      <div className="po-tabs">
        {[
          ['bill', 'New Bill', 'plus'],
          ['ledger', 'Vendors & Ledger', 'book'],
          ['history', 'Bill History', 'receipt']
        ].map(([k, label, icon], i) => (
          <button
            key={k}
            type="button"
            className={'po-tab' + (view === k ? ' active' : '')}
            onClick={() => setView(k)}
            title={`Alt+${i + 1}`}
          >
            <Icon name={icon} size={15} /> {label}
          </button>
        ))}
        <span className="pv-owed">
          Owed to all vendors: <strong>{fmt(totalOwed)}</strong>
        </span>
        <button
          type="button"
          className="btn-sm ghost"
          onClick={() => setStockPriceModal(true)}
          title="See one product's full purchase & stock history, and adjust stock / prices"
        >
          <Icon name="book" size={14} /> Product Stock &amp; Purchase History
        </button>
      </div>

      {notice && <div className="inv-notice">{notice}</div>}
      {error && !payModal && (
        <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {/* ═════════════ NEW BILL ═════════════ */}
      {view === 'bill' && (
        <div className="panel pv-bill">
          <div className="pv-row">
            <label className="field pv-vendor">
              <span>Vendor</span>
              <div className="pv-inline">
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">— select vendor —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.telephone ? `· ${v.telephone}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-sm primary"
                  title="Add a new vendor"
                  onClick={() =>
                    setVendorModal({ mode: 'create', form: { ...blankVendor } })
                  }
                >
                  <Icon name="plus" size={14} /> New vendor
                </button>
              </div>
            </label>
            <label className="field">
              <span>Bill date</span>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Vendor's bill no. (optional)</span>
              <input
                value={vendorBillNo}
                onChange={(e) => setVendorBillNo(e.target.value)}
                placeholder="e.g. 4521"
              />
            </label>
          </div>

          {vendor && (
            <div className="pv-vcard">
              <strong>{vendor.name}</strong>
              {vendor.telephone && <span>☎ {vendor.telephone}</span>}
              {vendor.address && <span>{vendor.address}</span>}
              <span className="pv-vbal">
                Owed now: <strong>{fmt(owedBefore)}</strong>
              </span>
            </div>
          )}

          <div className="po-tabs pv-mode">
            <button
              type="button"
              className={'po-tab' + (mode === 'lines' ? ' active' : '')}
              onClick={() => setMode('lines')}
            >
              Product types
            </button>
            <button
              type="button"
              className={'po-tab' + (mode === 'amount' ? ' active' : '')}
              onClick={() => setMode('amount')}
            >
              Bill amount only
            </button>
            {mode === 'lines' && (
              <label
                className="bc-check pv-stock"
                title="Also add these quantities to Inventory stock"
              >
                <input
                  type="checkbox"
                  checked={addToStock}
                  onChange={(e) => setAddToStock(e.target.checked)}
                />{' '}
                Add to Inventory stock
              </label>
            )}
          </div>

          {mode === 'lines' ? (
            <div className="pv-lines" style={{ padding: '0 16px' }}>
              {/* Grid Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `30px minmax(250px, 1fr) 80px 110px 130px ${addToStock ? '140px' : ''} 40px`,
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  fontWeight: 'bold',
                  fontSize: 13,
                  color: 'var(--muted)'
                }}
              >
                <div>#</div>
                <div>Product (Search or Type)</div>
                <div style={{ textAlign: 'right' }}>Qty</div>
                <div style={{ textAlign: 'right' }}>Purchase Price</div>
                <div style={{ textAlign: 'right' }}>Total Price</div>
                {addToStock && <div>Stock Op</div>}
                <div></div>
              </div>

              {/* Grid Body (Rows) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {lines.map((l, i) => (
                  <div
                    key={l.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `30px minmax(250px, 1fr) 80px 110px 130px ${addToStock ? '140px' : ''} 40px`,
                      gap: 12,
                      padding: '12px 0',
                      alignItems: 'start',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ paddingTop: 10 }}>{i + 1}</div>

                    {/* Product Search Column */}
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={i === 0 ? firstLineRef : undefined}
                        className="pv-in"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={l.description}
                        placeholder="Search item code / name, or type custom..."
                        onChange={(e) =>
                          handleItemSearch(l.key, e.target.value)
                        }
                      />

                      {/* Search Results Dropdown */}
                      {l.searchResults?.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 1000,
                            maxHeight: 200,
                            overflowY: 'auto',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            borderRadius: 'var(--radius)',
                            marginTop: 4
                          }}
                        >
                          {l.searchResults.map((it) => (
                            <div
                              key={it.id}
                              className="sr-row"
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border)'
                              }}
                              onClick={() => selectItem(l.key, it)}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <strong>{it.name}</strong>
                                <span className="muted-text">
                                  {it.item_code}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: 'var(--muted)',
                                  marginTop: 4,
                                  display: 'flex',
                                  gap: 12
                                }}
                              >
                                <span>Stock: {it.current_stock}</span>
                                <span>Cost: Rs. {it.purchase_price}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Selected Item Context & Live Math */}
                      {l.selectedItem && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--muted)',
                            marginTop: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4
                          }}
                        >
                          <div style={{ display: 'flex', gap: 12 }}>
                            <span>
                              Stock:{' '}
                              <strong>{l.selectedItem.current_stock}</strong>
                            </span>
                            <span>
                              Prev Price:{' '}
                              <strong>
                                Rs. {l.selectedItem.purchase_price}
                              </strong>
                            </span>
                            <span>
                              Avg Cost:{' '}
                              <strong>Rs. {l.selectedItem.average_cost}</strong>
                            </span>
                          </div>

                          {/* Live New Avg Cost Calculation */}
                          {Number(l.quantity) > 0 &&
                            Number(l.lineTotal) > 0 && (
                              <div
                                style={{
                                  color: 'var(--primary)',
                                  fontWeight: 'bold'
                                }}
                              >
                                New Avg Cost: Rs.{' '}
                                {(() => {
                                  const newRate =
                                    Number(l.lineTotal) / Number(l.quantity)
                                  const oldQty = Number(
                                    l.selectedItem.current_stock
                                  )
                                  const oldValue =
                                    oldQty * Number(l.selectedItem.average_cost)
                                  const totalQty = oldQty + Number(l.quantity)
                                  const newAvg =
                                    totalQty > 0
                                      ? (oldValue + Number(l.lineTotal)) /
                                        totalQty
                                      : newRate
                                  return newAvg.toFixed(2)
                                })()}
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    {/* Qty */}
                    <div>
                      <input
                        className="pv-in num"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          textAlign: 'right'
                        }}
                        type="number"
                        min="0"
                        value={l.quantity}
                        onChange={(e) => updateQty(l.key, e.target.value)}
                      />
                    </div>

                    {/* Purchase Price (Rate) */}
                    <div>
                      <input
                        className="pv-in num"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          textAlign: 'right'
                        }}
                        type="number"
                        min="0"
                        value={l.rate}
                        onChange={(e) => updateRate(l.key, e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Total Price */}
                    <div>
                      <input
                        className="pv-in num"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          textAlign: 'right'
                        }}
                        type="number"
                        min="0"
                        value={l.lineTotal}
                        onChange={(e) => updateTotal(l.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && i === lines.length - 1) {
                            e.preventDefault()
                            addLine()
                          }
                        }}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Stock Operation & Selling Price */}
                    {addToStock && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        {l.selectedItem ? (
                          <>
                            <select
                              className="pv-in"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                              value={l.stockOperation}
                              onChange={(e) =>
                                setLine(l.key, 'stockOperation', e.target.value)
                              }
                            >
                              <option value="add">Add to Stock</option>
                              <option value="replace">Replace Stock</option>
                            </select>

                            <input
                              className="pv-in"
                              type="number"
                              min="0"
                              placeholder="Selling Price *"
                              value={l.sellingPrice}
                              onChange={(e) =>
                                setLine(l.key, 'sellingPrice', e.target.value)
                              }
                              style={{
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                              title="Update the selling price for this item"
                            />
                          </>
                        ) : (
                          <div
                            style={{ paddingTop: 10 }}
                            className="muted-text"
                          >
                            —
                          </div>
                        )}
                      </div>
                    )}

                    {/* Remove Button */}
                    <div style={{ paddingTop: 4 }}>
                      <button
                        type="button"
                        className="btn-icon danger"
                        title="Remove line"
                        onClick={() => removeLine(l.key)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Line Button */}
              <div style={{ padding: '16px 0' }}>
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={addLine}
                >
                  <Icon name="plus" size={14} /> Add product line
                </button>
              </div>
            </div>
          ) : (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Bill amount</span>
              <input
                type="number"
                min="0"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="e.g. 200000"
              />
            </label>
          )}

          <div className="pv-foot">
            <div className="pv-pay">
              <span className="field-label">Payment</span>
              <div
                className="pay-type-group"
                style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420 }}
              >
                <button
                  type="button"
                  className={
                    'pay-type-btn' +
                    (payMode === 'none' ? ' active pv-record' : '')
                  }
                  onClick={() => setPayMode('none')}
                >
                  Save only — pay later
                </button>
                <button
                  type="button"
                  className={
                    'pay-type-btn' + (payMode === 'pay' ? ' active online' : '')
                  }
                  onClick={() => setPayMode('pay')}
                >
                  Pay now
                </button>
              </div>
              {payMode === 'none' ? (
                <p className="muted-text pv-hint">
                  Only the bill is recorded — the vendor's balance goes up, no
                  money leaves Cash in Hand or Online. Pay any time later from{' '}
                  <strong>Vendors &amp; Ledger → Pay vendor</strong>.
                </p>
              ) : (
                <div className="pv-inline">
                  <div
                    className="pay-type-group"
                    style={{
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      minWidth: 220
                    }}
                  >
                    <button
                      type="button"
                      className={
                        'pay-type-btn' +
                        (payVia === 'cash' ? ' active cash' : '')
                      }
                      onClick={() => setPayVia('cash')}
                    >
                      Cash in Hand
                    </button>
                    <button
                      type="button"
                      className={
                        'pay-type-btn' +
                        (payVia === 'bank' ? ' active online' : '')
                      }
                      onClick={() => setPayVia('bank')}
                    >
                      Online
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    autoFocus
                    value={payNow}
                    onChange={(e) => setPayNow(e.target.value)}
                    placeholder="Amount"
                    className="pv-amount"
                  />
                  <button
                    type="button"
                    className="btn-sm ghost"
                    onClick={() => setPayNow(String(billTotal))}
                    disabled={!billTotal}
                  >
                    Pay full
                  </button>
                </div>
              )}
              <input
                className="pv-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks (optional)"
              />
            </div>
            <div className="totals pv-totals">
              <div className="tot-row">
                <span>Bill total</span>
                <strong>{fmt(billTotal)}</strong>
              </div>
              {vendor && (
                <>
                  <div className="tot-row">
                    <span>Owed before</span>
                    <span>{fmt(owedBefore)}</span>
                  </div>
                  {payMode === 'pay' && (
                    <div className="tot-row">
                      <span>
                        Paid now (
                        {payVia === 'bank' ? 'Online' : 'Cash in Hand'})
                      </span>
                      <span className="neg">−{fmt(payAmt)}</span>
                    </div>
                  )}
                  <div className="tot-row">
                    <span>Owed after this bill</span>
                    <strong className={owedAfter > 0 ? 'neg' : 'pos'}>
                      {fmt(owedAfter)}
                    </strong>
                  </div>
                </>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => saveBill()}
                disabled={busy}
                title="Save (F9)"
              >
                {busy
                  ? 'Saving…'
                  : payMode === 'pay' && payAmt > 0
                    ? `Save & pay ${fmt(payAmt)} from ${payVia === 'bank' ? 'Online' : 'Cash in Hand'} (F9)`
                    : 'Save bill (no payment) (F9)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════ VENDORS & LEDGER ═════════════ */}
      {view === 'ledger' && (
        <div className="credit-body">
          <div className="inv-pane">
            <div className="inv-pane-head">
              <span>Vendors</span>
              <label className="bc-check" title="Only vendors we still owe">
                <input
                  type="checkbox"
                  checked={owesOnly}
                  onChange={(e) => setOwesOnly(e.target.checked)}
                />{' '}
                We owe
              </label>
            </div>
            <div className="search-box" style={{ margin: 8 }}>
              <Icon name="search" size={15} />
              <input
                ref={vSearchRef}
                placeholder="Search name / code / phone (F2)"
                value={vSearch}
                onChange={(e) => setVSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-sm ghost"
              style={{ margin: '0 8px 6px' }}
              onClick={() =>
                setVendorModal({ mode: 'create', form: { ...blankVendor } })
              }
            >
              <Icon name="plus" size={14} /> New vendor
            </button>
            <div className="inv-list">
              {vendorList.length === 0 && (
                <div className="inv-empty">No vendors</div>
              )}
              {vendorList.map((v) => (
                <div
                  key={v.id}
                  tabIndex={0}
                  data-nav-item
                  className={
                    'inv-list-item' + (selVendor === v.id ? ' active' : '')
                  }
                  onClick={() => setSelVendor(v.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelVendor(v.id)}
                >
                  <div className="ili-text">
                    <strong>{v.name}</strong>
                    <span>
                      {v.code}
                      {v.telephone ? ` · ${v.telephone}` : ''}
                    </span>
                  </div>
                  <span className="owe-amt">
                    {Number(v.current_balance) > 0.009
                      ? fmt(v.current_balance)
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel credit-detail" id="vendor-ledger">
            {!ledger ? (
              <div className="inv-empty" style={{ margin: 'auto' }}>
                Select a vendor to see their bills, payments and balance
              </div>
            ) : (
              <>
                <div className="cd-head">
                  <div>
                    <h3>
                      {ledger.vendor.name}{' '}
                      <span className="muted-text">· {ledger.vendor.code}</span>
                    </h3>
                    <div className="cd-balance">
                      {ledger.vendor.telephone && (
                        <>☎ {ledger.vendor.telephone} · </>
                      )}
                      {ledger.vendor.address || 'no address'}
                    </div>
                    <div className="cd-balance">
                      {Number(ledger.vendor.current_balance) < -0.009 ? (
                        <>
                          Vendor owes YOU (advance):{' '}
                          <strong className="pos">
                            {fmt(-ledger.vendor.current_balance)}
                          </strong>
                        </>
                      ) : (
                        <>
                          Balance we owe:{' '}
                          <strong>{fmt(ledger.vendor.current_balance)}</strong>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="pv-inline">
                    {Number(ledger.vendor.current_balance) < -0.009 ? (
                      <button
                        type="button"
                        className="btn-sm primary"
                        onClick={openReceive}
                        title="The vendor owes you — record the money they pay back"
                      >
                        <Icon name="wallet" size={14} /> Receive from vendor
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-sm primary"
                        onClick={openPay}
                        disabled={Number(ledger.vendor.current_balance) <= 0}
                      >
                        <Icon name="wallet" size={14} /> Pay vendor
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-sm ghost"
                      onClick={() => {
                        setVendorId(String(ledger.vendor.id))
                        setView('bill')
                      }}
                    >
                      <Icon name="plus" size={14} /> New bill
                    </button>
                    <button
                      type="button"
                      className="btn-sm ghost"
                      onClick={() =>
                        setVendorModal({
                          mode: 'edit',
                          id: ledger.vendor.id,
                          form: {
                            name: ledger.vendor.name || '',
                            telephone: ledger.vendor.telephone || '',
                            address: ledger.vendor.address || '',
                            gstRegNo: ledger.vendor.gst_reg_no || '',
                            ntn: ledger.vendor.ntn || '',
                            openingBalance: ''
                          }
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-sm ghost"
                      onClick={() => printNow()}
                      title="Print this ledger"
                    >
                      <Icon name="printer" size={14} /> Print
                    </button>
                  </div>
                </div>

                <div className="report-bar" style={{ marginBottom: 8 }}>
                  <div className="rb-dates">
                    <label>
                      From{' '}
                      <input
                        type="date"
                        value={lFrom}
                        onChange={(e) => setLFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      To{' '}
                      <input
                        type="date"
                        value={lTo}
                        onChange={(e) => setLTo(e.target.value)}
                      />
                    </label>
                    <DatePresets
                      from={lFrom}
                      to={lTo}
                      onChange={(r) => {
                        setLFrom(r.from)
                        setLTo(r.to)
                      }}
                    />
                  </div>
                </div>

                <div
                  className="report-cards"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'
                  }}
                >
                  <div className="rc-card">
                    <span>Opening</span>
                    <strong>{fmt(ledger.opening)}</strong>
                  </div>
                  <div className="rc-card">
                    <span>Bills (+)</span>
                    <strong>{fmt(ledger.totals.billed)}</strong>
                  </div>
                  <div className="rc-card">
                    <span>Paid (−)</span>
                    <strong className="pos">{fmt(ledger.totals.paid)}</strong>
                  </div>
                  <div className="rc-card amber">
                    <span>Balance</span>
                    <strong>{fmt(ledger.totals.closing)}</strong>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Ref</th>
                        <th>Details</th>
                        <th className="num">Bill (+)</th>
                        <th className="num">Paid (−)</th>
                        <th className="num">Balance</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="pv-opening">
                        <td colSpan="5">Opening balance</td>
                        <td className="num strong">{fmt(ledger.opening)}</td>
                        <td></td>
                      </tr>
                      {ledger.rows.length === 0 && (
                        <tr>
                          <td colSpan="7" className="empty">
                            No bills or payments in these dates
                          </td>
                        </tr>
                      )}
                      {ledger.rows.map((r) => (
                        <FragmentRow key={r.id}>
                          <tr>
                            <td>{r.date}</td>
                            <td>
                              {r.type === 'bill' ? (
                                <button
                                  type="button"
                                  className="po-badge ordered pv-badge-btn"
                                  title="Open bill (edit / return)"
                                  onClick={() => showBill(r.billId)}
                                >
                                  {r.serial || 'BILL'}
                                </button>
                              ) : r.type === 'payment' ? (
                                <span className="po-badge received">
                                  {r.voucherNo || 'PAID'}
                                </span>
                              ) : r.type === 'return' ? (
                                <button
                                  type="button"
                                  className="po-badge cancelled pv-badge-btn"
                                  title="Open the bill"
                                  onClick={() => showBill(r.returnBillId)}
                                >
                                  {r.returnNo || 'RETURN'}
                                </button>
                              ) : r.type === 'refund' ? (
                                <span className="po-badge received">
                                  {r.voucherNo || 'REFUND'}
                                </span>
                              ) : (
                                <span className="po-badge">{r.type}</span>
                              )}
                            </td>
                            <td>
                              {r.type === 'bill' && r.lines?.length > 0 ? (
                                <button
                                  type="button"
                                  className="pv-link"
                                  onClick={() =>
                                    setOpenBill(openBill === r.id ? null : r.id)
                                  }
                                >
                                  {openBill === r.id ? '▼' : '▶'}{' '}
                                  {r.lines.length} product type
                                  {r.lines.length > 1 ? 's' : ''}
                                  {r.vendorBillNo
                                    ? ` · vendor #${r.vendorBillNo}`
                                    : ''}
                                  {r.stockAdded ? ' · stock added' : ''}
                                </button>
                              ) : r.type === 'payment' ? (
                                <span>
                                  {r.accountType === 'bank'
                                    ? 'Online'
                                    : 'Cash in Hand'}{' '}
                                  ·{' '}
                                  {r.description
                                    ?.split(' · ')
                                    .slice(1)
                                    .join(' · ')}
                                </span>
                              ) : r.type === 'return' || r.type === 'refund' ? (
                                <span>
                                  {r.description
                                    ?.split(' · ')
                                    .slice(1)
                                    .join(' · ')}
                                </span>
                              ) : (
                                r.description
                              )}
                            </td>
                            <td className="num">{r.bill ? fmt(r.bill) : ''}</td>
                            <td className="num pos">
                              {r.paid ? fmt(r.paid) : ''}
                            </td>
                            <td className="num strong">{fmt(r.balance)}</td>
                            <td className="num">
                              {r.voucherId && (
                                <button
                                  type="button"
                                  className="btn-icon danger"
                                  title="Delete this payment"
                                  onClick={() => removePayment(r)}
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              )}
                              {r.billId && (
                                <button
                                  type="button"
                                  className="btn-icon"
                                  title="Open bill: edit / return to vendor"
                                  onClick={() => showBill(r.billId)}
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                              )}
                              {r.returnId && (
                                <button
                                  type="button"
                                  className="btn-icon danger"
                                  title="Delete this return"
                                  onClick={() => removeReturn(r)}
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                          {openBill === r.id &&
                            r.lines.map((l, i) => (
                              <tr key={i} className="pv-subline">
                                <td></td>
                                <td></td>
                                <td>
                                  {l.description} × {l.quantity} @ {fmt(l.rate)}
                                  {l.linked ? ' (in stock)' : ''}
                                </td>
                                <td className="num muted-text">
                                  {fmt(l.amount)}
                                </td>
                                <td colSpan="3"></td>
                              </tr>
                            ))}
                        </FragmentRow>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" className="num strong">
                          Totals
                        </td>
                        <td className="num strong">
                          {fmt(ledger.totals.billed)}
                        </td>
                        <td className="num strong pos">
                          {fmt(ledger.totals.paid)}
                        </td>
                        <td className="num strong">
                          {fmt(ledger.totals.closing)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═════════════ BILL HISTORY ═════════════ */}
      {view === 'history' && (
        <div className="panel report-table-wrap">
          <div className="report-bar">
            <div className="rb-dates">
              <label>
                From{' '}
                <input
                  type="date"
                  value={hFrom}
                  onChange={(e) => setHFrom(e.target.value)}
                />
              </label>
              <label>
                To{' '}
                <input
                  type="date"
                  value={hTo}
                  onChange={(e) => setHTo(e.target.value)}
                />
              </label>
              <DatePresets
                from={hFrom}
                to={hTo}
                onChange={(r) => {
                  setHFrom(r.from)
                  setHTo(r.to)
                }}
              />
            </div>
            <div className="search-box">
              <Icon name="search" size={15} />
              <input
                placeholder="Vendor / bill no."
                value={hSearch}
                onChange={(e) => setHSearch(e.target.value)}
              />
            </div>
          </div>
          <p
            className="muted-text"
            style={{ fontSize: 12, margin: '4px 0 6px' }}
          >
            {bills.rows.length} bill{bills.rows.length === 1 ? '' : 's'} ·{' '}
            {fmt(bills.total)}
          </p>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Vendor bill #</th>
                  <th className="num">Types</th>
                  <th className="num">Total</th>
                  <th className="num">Paid with bill</th>
                  <th className="num">Returned</th>
                  <th>Stock</th>
                  <th>Edited</th>
                </tr>
              </thead>
              <tbody>
                {bills.rows.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="empty">
                      No bills in these dates
                    </td>
                  </tr>
                ) : (
                  bills.rows.map((b) => (
                    <tr
                      key={b.id}
                      className="clickable"
                      onClick={() => showBill(b.id)}
                    >
                      <td className="strong">{b.serial_no}</td>
                      <td>{b.order_date}</td>
                      <td>{b.vendor || '—'}</td>
                      <td>{b.vendor_bill_no || '—'}</td>
                      <td className="num">{b.line_count || 'amount only'}</td>
                      <td className="num strong">{fmt(b.total)}</td>
                      <td className="num">
                        {Number(b.paid_with_bill) ? fmt(b.paid_with_bill) : '—'}
                      </td>
                      <td
                        className={
                          'num' + (Number(b.returned_value) ? ' neg' : '')
                        }
                      >
                        {Number(b.return_count)
                          ? `${fmt(b.returned_value)} (${b.return_count})`
                          : '—'}
                      </td>
                      <td>{b.adds_stock ? 'added' : '—'}</td>
                      <td>{Number(b.edit_count) ? `${b.edit_count}×` : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═════════════ MODALS ═════════════ */}
      {vendorModal && (
        <Modal
          title={vendorModal.mode === 'create' ? 'New vendor' : 'Edit vendor'}
          onClose={() => setVendorModal(null)}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => setVendorModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveVendor}
                disabled={busy}
              >
                Save (F9)
              </button>
            </>
          }
        >
          {vendorField('Name *', 'name', { autoFocus: true })}
          <div className="field-row">
            {vendorField('Contact number', 'telephone')}
            {vendorField('GST reg. no.', 'gstRegNo')}
          </div>
          {vendorField('Address', 'address')}
          <div className="field-row">
            {vendorField('NTN', 'ntn')}
            {vendorModal.mode === 'create' &&
              vendorField('Old balance we owe (optional)', 'openingBalance', {
                type: 'number',
                min: 0
              })}
          </div>
        </Modal>
      )}

      {payModal && ledger && (
        <Modal
          title={
            payModal.mode === 'receive'
              ? `Receive money from ${ledger.vendor.name}`
              : `Pay ${ledger.vendor.name}`
          }
          onClose={() => setPayModal(null)}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => setPayModal(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={savePay} disabled={busy}>
                {busy
                  ? 'Saving…'
                  : payModal.mode === 'receive'
                    ? 'Save received money (F9)'
                    : 'Save payment (F9)'}
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <p className="muted-text" style={{ marginTop: 0 }}>
            {payModal.mode === 'receive' ? (
              <>
                {ledger.vendor.name} owes you:{' '}
                <strong>
                  {fmt(Math.abs(Number(ledger.vendor.current_balance)))}
                </strong>
              </>
            ) : (
              <>
                Balance we owe:{' '}
                <strong>{fmt(ledger.vendor.current_balance)}</strong>
              </>
            )}
          </p>
          <div className="field">
            <span className="field-label">
              {payModal.mode === 'receive' ? 'Received into' : 'Pay from'}
            </span>
            <div
              className="pay-type-group"
              style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
            >
              <button
                type="button"
                className={
                  'pay-type-btn' +
                  (payModal.via === 'cash' ? ' active cash' : '')
                }
                onClick={() => setPayModal((pm) => ({ ...pm, via: 'cash' }))}
              >
                Cash in Hand
              </button>
              <button
                type="button"
                className={
                  'pay-type-btn' +
                  (payModal.via === 'bank' ? ' active online' : '')
                }
                onClick={() => setPayModal((pm) => ({ ...pm, via: 'bank' }))}
              >
                Online
              </button>
            </div>
          </div>
          <div className="field-row">
            <label className="field">
              <span>
                Amount <em className="hint-em">(F6 = full balance)</em>
              </span>
              <input
                type="number"
                min="0"
                autoFocus
                value={payModal.amount}
                onChange={(e) =>
                  setPayModal((pm) => ({ ...pm, amount: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && savePay()}
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={payModal.date}
                onChange={(e) =>
                  setPayModal((pm) => ({ ...pm, date: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Note (optional)</span>
            <input
              value={payModal.note}
              onChange={(e) =>
                setPayModal((pm) => ({ ...pm, note: e.target.value }))
              }
            />
          </label>
          {Number(payModal.amount) > 0 && payModal.mode !== 'receive' && (
            <p className="muted-text">
              Balance after payment:{' '}
              <strong>
                {fmt(
                  r2(
                    Number(ledger.vendor.current_balance) -
                      Number(payModal.amount)
                  )
                )}
              </strong>
            </p>
          )}
          {Number(payModal.amount) > 0 && payModal.mode === 'receive' && (
            <p className="muted-text">
              Vendor will still owe you:{' '}
              <strong>
                {fmt(
                  Math.max(
                    0,
                    r2(
                      Math.abs(Number(ledger.vendor.current_balance)) -
                        Number(payModal.amount)
                    )
                  )
                )}
              </strong>
            </p>
          )}
        </Modal>
      )}

      {stockPriceModal && (
        <ProductHistoryModal
          onClose={() => setStockPriceModal(false)}
          onSaved={() => {
            loadRefs()
            if (items.length > 0)
              inventoryApi.items
                .list({})
                .then(setItems)
                .catch(() => {})
          }}
        />
      )}

      {openBillId && (
        <PurchaseBillModal
          billId={openBillId}
          uid={uid}
          accounts={accounts}
          onClose={() => setOpenBillId(null)}
          onChanged={onBillChanged}
          onDelete={(b) => {
            if (b.payments?.length)
              return `This bill has a payment made with it — delete that payment first (vendor ledger).`
            if (b.returns?.length)
              return 'This bill has returns to the vendor — delete those returns first.'
            removeBill(b.id, b.serial_no, !!b.adds_stock)
          }}
        />
      )}

      <div className="hotkey-hint">
        <span>
          <kbd>Alt</kbd>+<kbd>1/2/3</kbd> Tabs
        </span>
        <span>
          <kbd>F2</kbd> Search / first line
        </span>
        <span>
          <kbd>F9</kbd> Save
        </span>
        <span>
          <kbd>F6</kbd> Full balance (pay)
        </span>
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>
    </div>
  )
}

// Groups a ledger row with its expanded product lines (keys stay on the outer element).
function FragmentRow({ children }) {
  return <>{children}</>
}
