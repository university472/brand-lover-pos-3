import { useEffect, useState, useCallback, useRef } from 'react'
import { salesApi, salesmenApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icons.jsx'
import Modal from './Modal.jsx'
import InvoiceReceipt from './InvoiceReceipt.jsx'
import useKeyLayer, { isEditableTarget } from '../hooks/useKeyLayer.js'
import { notifyStockChanged } from '../utils/lowStock.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const ADMIN = ['administrator', 'manager']

// Snapshot of the editable form — compared with the loaded bill to know if it was changed.
const signature = (f) => JSON.stringify(f)

/**
 * One invoice, opened from anywhere (Counter Sale, Dashboard cards, Bill Tracking, reports…):
 * view → edit → Save & Print, Print as-is, and move to the previous / next invoice
 * (◀ ▶ buttons, ← → keys) or jump straight to an invoice number — without leaving the page.
 *
 * Saving goes through sales:update, which re-posts stock, cash/bank, receipt voucher and the
 * customer's credit/ledger in one transaction, so every report sees the edited bill.
 *
 * Props: saleId (bill to open first), onClose(), onSaved(saleId) — the caller refreshes its
 * own list / totals.
 */
export default function SaleEditor({ saleId, onClose, onSaved }) {
  const { session } = useAuth()
  const uid = session?.id
  const canEdit = ADMIN.includes(session?.role)

  const [id, setId] = useState(saleId)
  const [bill, setBill] = useState(null)
  const [lines, setLines] = useState([])
  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [salesmen, setSalesmen] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [salesmanId, setSalesmanId] = useState('')
  const [paymentType, setPaymentType] = useState('cash')
  const [dueDate, setDueDate] = useState('')
  const [overallDiscount, setOverallDiscount] = useState('')
  const [deliveryCharges, setDeliveryCharges] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [remarks, setRemarks] = useState('')
  const [loadedSig, setLoadedSig] = useState('')

  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [gotoNo, setGotoNo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [cancelAsk, setCancelAsk] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  // { id, n } — n forces a fresh InvoiceReceipt when the same bill is printed twice
  const [printJob, setPrintJob] = useState(null)

  const timer = useRef(null)
  const addItemRef = useRef(null)
  const gotoRef = useRef(null)

  // Reference lists once; the bill itself on every navigation.
  useEffect(() => {
    Promise.all([salesApi.customers(), salesApi.accounts(), salesmenApi.list()])
      .then(([cs, ac, sm]) => {
        setCustomers(cs)
        setAccounts(ac)
        setSalesmen(sm)
      })
      .catch((e) => setError(e.message))
  }, [])

  const formOf = (b) => ({
    customerId: String(b.customer_id),
    accountId: b.payment_account_id ? String(b.payment_account_id) : '',
    salesmanId: b.salesman_id ? String(b.salesman_id) : '',
    paymentType: b.payment_type,
    dueDate: b.due_date || '',
    overallDiscount: Number(b.discount) ? String(b.discount) : '',
    deliveryCharges: Number(b.delivery_charges) ? String(b.delivery_charges) : '',
    amountReceived: String(b.amount_received),
    remarks: b.remarks || '',
    lines: b.items.map((it) => ({
      itemId: it.item_id,
      code: it.item_code,
      name: it.description,
      unit: it.unit,
      qty: Number(it.quantity),
      rate: Number(it.rate),
      discountMode: Number(it.discount_amount) > 0 ? 'amount' : 'percent',
      discountValue:
        Number(it.discount_amount) > 0
          ? Number(it.discount_amount)
          : Number(it.discount_percent)
    }))
  })

  const load = useCallback(async (saleIdToLoad) => {
    setError('')
    setCancelAsk(false)
    setCancelReason('')
    setTerm('')
    setResults([])
    try {
      const b = await salesApi.get({ id: saleIdToLoad })
      const f = formOf(b)
      setBill(b)
      setId(b.id)
      setCustomerId(f.customerId)
      setAccountId(f.accountId)
      setSalesmanId(f.salesmanId)
      setPaymentType(f.paymentType)
      setDueDate(f.dueDate)
      setOverallDiscount(f.overallDiscount)
      setDeliveryCharges(f.deliveryCharges)
      setAmountReceived(f.amountReceived)
      setRemarks(f.remarks)
      setLines(f.lines)
      setLoadedSig(signature(f))
    } catch (e) {
      setError(e.message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load(saleId)
  }, [saleId, load])

  // Bill has no account (old data) → default to the first one so Save has something valid.
  useEffect(() => {
    if (bill && !accountId && accounts[0]) setAccountId(String(accounts[0].id))
  }, [bill, accountId, accounts])

  const readOnly = !bill || !canEdit || !!bill.is_cancelled || !!bill.has_returns
  const dirty =
    !!bill &&
    !readOnly &&
    signature({
      customerId,
      accountId: bill.payment_account_id ? accountId : '',
      salesmanId,
      paymentType,
      dueDate,
      overallDiscount,
      deliveryCharges,
      amountReceived,
      remarks,
      lines
    }) !== loadedSig

  const lineDiscAmt = (l) => {
    const gross = l.qty * l.rate
    if (l.discountMode === 'amount')
      return round2(Math.min(Number(l.discountValue) || 0, gross))
    return round2((gross * (Number(l.discountValue) || 0)) / 100)
  }
  const lineNet = (l) => round2(l.qty * l.rate - lineDiscAmt(l))
  const subTotal = round2(lines.reduce((s, l) => s + lineNet(l), 0))
  const disc = Number(overallDiscount) || 0
  const delivery = Number(deliveryCharges) || 0
  const netTotal = round2(subTotal - disc + delivery)
  const tendered = Number(amountReceived) || 0
  const change = round2(Math.max(0, tendered - netTotal))
  const outstanding = round2(Math.max(0, netTotal - tendered))
  const selCust = customers.find((c) => String(c.id) === String(customerId))
  const isWalkIn = selCust?.is_walk_in
  const isCredit = paymentType === 'credit'

  // Live credit-limit check — the SAME rule the backend applies on save: balance without
  // this bill's OLD credit + this bill's NEW credit must stay within the limit.
  const creditLimit = Number(selCust?.credit_limit) || 0
  const oldBillCredit =
    bill && !bill.is_walk_in && String(bill.customer_id) === String(customerId)
      ? Math.max(0, Number(bill.net_total) - Number(bill.amount_received))
      : 0
  const balanceWithoutBill = round2((Number(selCust?.current_balance) || 0) - oldBillCredit)
  const balanceAfterEdit = round2(balanceWithoutBill + (isCredit ? outstanding : 0))
  const overLimit =
    isCredit && !isWalkIn && creditLimit > 0 && balanceAfterEdit > creditLimit + 0.009
  // Same rules as Counter Sale: credit needs a named customer and something left unpaid.
  const creditProblem = !isCredit
    ? ''
    : isWalkIn
      ? 'Credit needs a named customer, not Walk-In.'
      : outstanding <= 0.009 && netTotal > 0
        ? 'The whole bill is paid — choose Cash or Online, or lower "Paid at counter".'
        : ''
  const saveBlocked = overLimit || !!creditProblem || lines.length === 0

  const setLine = (itemId, f, v) =>
    setLines((p) => p.map((l) => (l.itemId === itemId ? { ...l, [f]: v } : l)))
  const removeLine = (itemId) => setLines((p) => p.filter((l) => l.itemId !== itemId))
  const removeLastLine = () => setLines((p) => (p.length ? p.slice(0, -1) : p))

  const runSearch = (v) => {
    setTerm(v)
    clearTimeout(timer.current)
    if (!v.trim()) {
      setResults([])
      return
    }
    timer.current = setTimeout(async () => {
      try {
        setResults(await salesApi.searchItems({ term: v }))
      } catch {
        /* ignore */
      }
    }, 180)
  }
  const addItem = (it) => {
    setLines((p) => {
      const i = p.findIndex((l) => l.itemId === it.id)
      if (i >= 0) {
        const c = [...p]
        c[i] = { ...c[i], qty: c[i].qty + 1 }
        return c
      }
      return [
        ...p,
        {
          itemId: it.id,
          code: it.item_code,
          name: it.name,
          unit: it.unit,
          qty: 1,
          rate: Number(it.selling_price),
          discountMode: 'percent',
          discountValue: Number(it.discount_percent) || 0
        }
      ]
    })
    setTerm('')
    setResults([])
  }

  const confirmLeave = () =>
    !dirty || window.confirm('This invoice has unsaved changes. Discard them?')

  const requestClose = () => {
    if (confirmLeave()) onClose?.()
  }

  const go = async (direction) => {
    if (busy || !confirmLeave()) return
    setInfo('')
    try {
      const r = await salesApi.neighbor({ fromId: id, direction })
      if (!r.id) {
        setInfo(direction === 'prev' ? 'This is the first invoice.' : 'This is the latest invoice.')
        return
      }
      await load(r.id)
    } catch (e) {
      setError(e.message)
    }
  }

  const gotoInvoice = async () => {
    const no = gotoNo.trim()
    if (!no || busy || !confirmLeave()) return
    setInfo('')
    try {
      const r = await salesApi.findByNo({ invoiceNo: no })
      setGotoNo('')
      await load(r.id)
    } catch (e) {
      setError(e.message)
    }
  }

  const print = () => {
    if (!bill) return
    if (dirty) setInfo('Printing the SAVED bill — your unsaved changes are not on it.')
    setPrintJob((p) => ({ id: bill.id, n: (p?.n || 0) + 1 }))
  }
  const closePrint = useCallback(() => setPrintJob(null), [])

  const save = async () => {
    if (busy || readOnly || saveBlocked || !dirty) return
    setBusy(true)
    setError('')
    setInfo('')
    try {
      // Cash/Online bills are always fully paid — Amount Received follows the new total
      // (otherwise the backend refuses a cash bill whose total went up).
      const finalAmountReceived =
        paymentType === 'cash' || paymentType === 'online' ? netTotal : tendered
      await salesApi.update({
        actingUserId: uid,
        saleId: bill.id,
        customerId: Number(customerId),
        accountId: Number(accountId),
        paymentType,
        salesmanId: salesmanId ? Number(salesmanId) : null,
        dueDate: paymentType === 'credit' ? dueDate || null : null,
        overallDiscount: disc,
        deliveryCharges: delivery,
        amountReceived: finalAmountReceived,
        remarks,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.qty),
          rate: Number(l.rate),
          discountMode: l.discountMode,
          discountValue: Number(l.discountValue) || 0,
          unit: l.unit,
          description: l.name
        }))
      })
      notifyStockChanged() // stock moved → low-stock badge + Dashboard refresh
      // Customer balances changed too (credit edits)
      salesApi.customers().then(setCustomers).catch(() => {})
      await load(bill.id)
      setPrintJob((p) => ({ id: bill.id, n: (p?.n || 0) + 1 }))
      setInfo(`Invoice #${bill.invoice_no} saved — printing the updated bill.`)
      onSaved?.(bill.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelBill = async () => {
    const reason = cancelReason.trim()
    if (!reason) {
      setError('Please type a reason for cancelling this bill.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await salesApi.cancel({ actingUserId: uid, saleId: bill.id, reason })
      notifyStockChanged()
      await load(bill.id) // stays open, now marked cancelled (view-only)
      setInfo(`Invoice #${bill.invoice_no} cancelled.`)
      onSaved?.(bill.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Keys while the editor is open (page hotkeys underneath are paused by useKeyLayer):
  //   ← / →           previous / next invoice (outside a text box)
  //   Alt+← / Alt+→   previous / next invoice (anywhere)
  //   Ctrl+G          jump to an invoice number
  //   F8 add item · F9 save & print · Ctrl+P print · Del undo last line · Esc close
  useKeyLayer((e) => {
    const key = e.key
    const ctrl = e.ctrlKey || e.metaKey
    const inInput = isEditableTarget(e.target)
    const handle = (fn) => {
      e.preventDefault()
      fn()
    }
    if (key === 'Escape') {
      if (cancelAsk) {
        setCancelAsk(false)
        setCancelReason('')
        e.preventDefault()
      } else handle(requestClose)
      return
    }
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && (e.altKey || (!inInput && !ctrl))) {
      handle(() => go(key === 'ArrowLeft' ? 'prev' : 'next'))
      return
    }
    if (ctrl && key.toLowerCase() === 'g') return handle(() => gotoRef.current?.focus())
    if (ctrl && key.toLowerCase() === 'p') return handle(print)
    if (key === 'F9' || (ctrl && key.toLowerCase() === 's')) return handle(save)
    if (key === 'F8' && !readOnly) return handle(() => addItemRef.current?.focus())
    if (key === 'Delete' && !inInput && !readOnly) return handle(removeLastLine)
  })

  const title = bill
    ? `Invoice #${bill.invoice_no}${bill.is_cancelled ? ' (Cancelled)' : ''}${dirty ? ' •' : ''}`
    : 'Invoice'

  return (
    <Modal
      title={title}
      width={780}
      onClose={requestClose}
      footer={
        cancelAsk ? (
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setCancelAsk(false)
                setCancelReason('')
                setError('')
              }}
              disabled={busy}
            >
              Back
            </button>
            <button
              className="btn-danger"
              onClick={cancelBill}
              disabled={busy || !cancelReason.trim()}
            >
              {busy ? 'Cancelling…' : 'Confirm Cancel'}
            </button>
          </>
        ) : (
          <>
            {!readOnly && (
              <button
                className="btn-danger"
                onClick={() => {
                  setError('')
                  setCancelAsk(true)
                }}
                disabled={busy}
                style={{ marginRight: 'auto' }}
              >
                Cancel Bill
              </button>
            )}
            <button className="btn-secondary" onClick={requestClose}>
              Close
            </button>
            <button
              className="btn-secondary"
              onClick={print}
              disabled={!bill}
              title="Print this invoice as saved (Ctrl+P)"
            >
              <Icon name="printer" size={16} /> Print
            </button>
            {!readOnly && (
              <button
                className="btn-primary"
                onClick={save}
                disabled={busy || saveBlocked || !dirty}
                title={
                  overLimit
                    ? 'Credit limit exceeded — reduce the bill or take payment'
                    : creditProblem
                      ? creditProblem
                    : !dirty
                      ? 'Nothing changed yet'
                      : 'Save & Print (F9)'
                }
              >
                <Icon name="check" size={16} />
                {busy ? ' Saving…' : ' Save & Print'}
              </button>
            )}
          </>
        )
      }
    >
      <div className="inv-nav">
        <button
          type="button"
          className="btn-sm ghost"
          onClick={() => go('prev')}
          disabled={busy || !bill}
          title="Previous invoice (← or Alt+←)"
        >
          ◀ Prev
        </button>
        <button
          type="button"
          className="btn-sm ghost"
          onClick={() => go('next')}
          disabled={busy || !bill}
          title="Next invoice (→ or Alt+→)"
        >
          Next ▶
        </button>
        <div className="search-box inv-nav-goto">
          <Icon name="search" size={14} />
          <input
            ref={gotoRef}
            placeholder="Go to invoice #  (Ctrl+G)"
            value={gotoNo}
            onChange={(e) => setGotoNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                gotoInvoice()
              }
            }}
          />
        </div>
        <span className="inv-nav-hint">
          <kbd>←</kbd>
          <kbd>→</kbd> move · <kbd>F9</kbd> save &amp; print
        </span>
      </div>

      {info && <div className="inv-notice">{info}</div>}
      {!bill && !error && <p className="muted-text">Loading…</p>}

      {bill && (
        <>
          {!canEdit && (
            <div className="cust-card">
              View only — ask an Administrator or Manager to edit a saved bill.
            </div>
          )}
          {/* !! — these come from MySQL as 0/1; `0 && …` would print a stray "0" */}
          {!!bill.has_returns && (
            <div className="cust-card bad">
              <p style={{ margin: 0 }}>
                This bill has returns recorded — it&apos;s view-only. Handle the return module
                instead.
              </p>
              {bill.returns?.map((r) => (
                <div key={r.id} style={{ marginTop: 10, fontSize: 13 }}>
                  <div className="cc-row">
                    <span>
                      {r.return_no} · {r.return_date}
                    </span>
                    <strong>{fmt(r.total_amount)}</strong>
                  </div>
                  <div className="cc-row">
                    <span>Refund</span>
                    <span>
                      {r.refund_mode === 'credit_adjust'
                        ? 'Credit reduced'
                        : `${r.account_name || '—'}`}
                    </span>
                  </div>
                  {r.items?.length > 0 && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {r.items.map((it, i) => (
                        <li key={i}>
                          {it.itemCode ? `${it.itemCode} · ` : ''}
                          {it.name} × {it.quantity} — {fmt(it.amount)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
          {!!bill.is_cancelled && (
            <div className="cust-card bad">This bill is cancelled (view-only).</div>
          )}

          <div className="bt-meta">
            <div>
              <span>Date</span>
              <strong>
                {bill.invoice_date} {bill.invoice_time ? String(bill.invoice_time).slice(0, 5) : ''}
              </strong>
            </div>
            <div>
              <span>Operator</span>
              <strong>{bill.operator || '—'}</strong>
            </div>
            <div>
              <span>Saved Total → New Total</span>
              <strong>
                {fmt(bill.net_total)}
                {round2(netTotal) !== round2(bill.net_total) && (
                  <span className="pos"> → {fmt(netTotal)}</span>
                )}
              </strong>
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Customer</span>
              <select
                value={customerId}
                disabled={readOnly}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Payment</span>
              <select
                value={paymentType}
                disabled={readOnly}
                onChange={(e) => {
                  // Turning a paid bill into Credit: start "Paid at counter" at 0, otherwise
                  // the old full payment stays and nothing actually goes on credit.
                  if (e.target.value === 'credit' && !isCredit) setAmountReceived('0')
                  setPaymentType(e.target.value)
                }}
              >
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="credit">Credit</option>
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Salesman</span>
              <select
                value={salesmanId}
                disabled={readOnly}
                onChange={(e) => setSalesmanId(e.target.value)}
              >
                <option value="">— None —</option>
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {isCredit && !isWalkIn && (
              <label className="field">
                <span>Promise to pay by</span>
                <input
                  type="date"
                  value={dueDate}
                  disabled={readOnly}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            )}
          </div>

          {!readOnly && (
            <div className="bt-add">
              <div className="search-box grow">
                <Icon name="search" size={15} />
                <input
                  ref={addItemRef}
                  placeholder="Add item by name / code / barcode  (F8)"
                  value={term}
                  onChange={(e) => runSearch(e.target.value)}
                  onKeyDown={async (e) => {
                    // Enter adds the item — exact code/barcode first, else the first match
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    const code = term.trim()
                    if (!code) return
                    try {
                      const exact = await salesApi.itemByCode({ code })
                      if (exact) return addItem(exact)
                    } catch {
                      /* not an exact code — fall back to the search list */
                    }
                    if (results.length) addItem(results[0])
                    else setError(`No item matches "${code}".`)
                  }}
                />
              </div>
              {results.length > 0 && (
                <div className="search-results bt-results">
                  {results.map((r) => (
                    <div key={r.id} className="sr-row" onClick={() => addItem(r)}>
                      <span className="sr-code">{r.item_code}</span>
                      <span className="sr-name">{r.name}</span>
                      <span className="sr-stock">
                        {Number(r.current_stock)} {r.unit}
                      </span>
                      <span className="sr-price">{fmt(r.selling_price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bt-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Disc</th>
                  <th className="num">Net</th>
                  {!readOnly && <th></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.itemId}>
                    <td>{l.code}</td>
                    <td>{l.name}</td>
                    <td className="num">
                      <input
                        className="cell-input sm"
                        type="number"
                        min="1"
                        value={l.qty}
                        disabled={readOnly}
                        onChange={(e) => setLine(l.itemId, 'qty', Number(e.target.value))}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="cell-input"
                        type="number"
                        min="0"
                        value={l.rate}
                        disabled={readOnly}
                        onChange={(e) => setLine(l.itemId, 'rate', Number(e.target.value))}
                      />
                    </td>
                    <td className="num">
                      <div className="disc-cell">
                        <input
                          className="cell-input sm"
                          type="number"
                          min="0"
                          value={l.discountValue}
                          disabled={readOnly}
                          onChange={(e) =>
                            setLine(l.itemId, 'discountValue', Number(e.target.value))
                          }
                        />
                        <button
                          type="button"
                          className="disc-mode"
                          disabled={readOnly}
                          onClick={() =>
                            setLine(
                              l.itemId,
                              'discountMode',
                              l.discountMode === 'amount' ? 'percent' : 'amount'
                            )
                          }
                        >
                          {l.discountMode === 'amount' ? 'Rs' : '%'}
                        </button>
                      </div>
                    </td>
                    <td className="num strong">{fmt(lineNet(l))}</td>
                    {!readOnly && (
                      <td className="num">
                        <button className="btn-icon danger" onClick={() => removeLine(l.itemId)}>
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Extra Discount</span>
              <input
                type="number"
                min="0"
                value={overallDiscount}
                disabled={readOnly}
                onChange={(e) => setOverallDiscount(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Delivery</span>
              <input
                type="number"
                min="0"
                value={deliveryCharges}
                disabled={readOnly}
                onChange={(e) => setDeliveryCharges(e.target.value)}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>{isCredit ? 'Paid at counter' : 'Amount Received (full)'}</span>
              {/* Cash/Online bills are always saved fully paid → shows the net total */}
              <input
                type="number"
                min="0"
                value={isCredit ? amountReceived : netTotal}
                disabled={readOnly || !isCredit}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Account</span>
              <select
                value={accountId}
                disabled={readOnly}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Remarks</span>
            <input
              value={remarks}
              disabled={readOnly}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>

          <div className="totals">
            <div className="tot-row">
              <span>Net Total</span>
              <strong>{fmt(netTotal)}</strong>
            </div>
            {/* Cash/Online bills are saved as fully paid, so no Due/Cashback line for them */}
            {isCredit && (
              <div className="tot-row">
                <span>{tendered >= netTotal ? 'Cashback' : 'Due'}</span>
                <strong className={outstanding > 0 ? 'neg' : 'pos'}>
                  {tendered >= netTotal ? fmt(change) : fmt(outstanding)}
                </strong>
              </div>
            )}
          </div>
          {creditProblem && !readOnly && <div className="cust-card bad">{creditProblem}</div>}
          {isCredit && !isWalkIn && creditLimit > 0 && !readOnly && (
            <div className={'cust-card' + (overLimit ? ' bad' : '')}>
              Credit limit {fmt(creditLimit)} · balance without this bill{' '}
              {fmt(balanceWithoutBill)} · after edit <strong>{fmt(balanceAfterEdit)}</strong>
              {overLimit
                ? ` — ⚠ exceeds limit by ${fmt(balanceAfterEdit - creditLimit)}. Save is blocked.`
                : ` — available ${fmt(creditLimit - balanceAfterEdit)}`}
            </div>
          )}
          {cancelAsk && (
            <div className="cust-card bad">
              <p style={{ margin: '0 0 8px' }}>
                Cancel bill #{bill.invoice_no}? Stock will go back to inventory and the money
                will be reversed.
              </p>
              <label className="field" style={{ marginBottom: 0 }}>
                <span>Reason (required)</span>
                <input
                  autoFocus
                  value={cancelReason}
                  placeholder="e.g. Customer changed mind / wrong bill"
                  onChange={(e) => setCancelReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && cancelReason.trim() && !busy) cancelBill()
                  }}
                />
              </label>
            </div>
          )}
        </>
      )}

      {/* Errors right above the buttons, where they can't be missed */}
      {error && (
        <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {printJob && (
        <InvoiceReceipt
          key={printJob.n}
          saleId={printJob.id}
          onClose={closePrint}
          autoPrint
        />
      )}
    </Modal>
  )
}
