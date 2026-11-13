import { useEffect, useState, useCallback, useRef } from 'react'
import { returnsApi, salesApi, companyApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Receipt from '../components/Receipt.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { useArrowListNav } from '../hooks/useArrowListNav.js'
import { printReceiptElement } from '../utils/printReceipt.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const PT = { cash: 'Cash', online: 'Online', credit: 'Credit' }
const PT_BADGE = { cash: 'received', online: 'ordered', credit: 'draft' }

export default function Returns() {
  const { session } = useAuth()
  const uid = session.id
  const [view, setView] = useState('new')

  const [invoiceNo, setInvoiceNo] = useState('')
  const [findMode, setFindMode] = useState('invoice')
  const [candidates, setCandidates] = useState([])
  const [creditSearch, setCreditSearch] = useState('')
  const [sale, setSale] = useState(null)
  const [lines, setLines] = useState([])
  const [qty, setQty] = useState({})
  const [refundMode, setRefundMode] = useState('cash')
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState([])
  const [reason, setReason] = useState('')

  // ✅ Filter state for "By Product Code" mode
  const [fPayment, setFPayment] = useState('') // '' | cash | online | credit
  const [fAmountMin, setFAmountMin] = useState('')
  const [fAmountMax, setFAmountMax] = useState('')
  const [fDateFrom, setFDateFrom] = useState('')
  const [fDateTo, setFDateTo] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [candidateItemName, setCandidateItemName] = useState('')

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [history, setHistory] = useState([])
  const [profile, setProfile] = useState(null)

  // 📍 PIN — refs
  const inputRef = useRef(null)
  const accountRef = useRef(null)
  const candidatesRef = useRef(null)
  useArrowListNav(candidatesRef)

  useEffect(() => {
    salesApi
      .accounts()
      .then((ac) => {
        setAccounts(ac)
        const cash = ac.find((a) => a.type === 'cash') || ac[0]
        if (cash) setAccountId(String(cash.id))
      })
      .catch((e) => setError(e.message))
    companyApi
      .getProfile()
      .then(setProfile)
      .catch(() => {})
  }, [])

  // Return History date filter (blank = latest returns)
  const [histFrom, setHistFrom] = useState('')
  const [histTo, setHistTo] = useState('')
  const loadHistory = useCallback(async () => {
    setHistory(
      await returnsApi.list({ actingUserId: uid, from: histFrom || undefined, to: histTo || undefined })
    )
  }, [uid, histFrom, histTo])
  useEffect(() => {
    if (view === 'history') loadHistory().catch((e) => setError(e.message))
  }, [view, loadHistory])

  useEffect(() => {
    if (!receipt) return
    const t = setTimeout(async () => {
      await printReceiptElement('receipt', {
        printerName: localStorage.getItem('receiptPrinter') || undefined
      })
      setReceipt(null)
    }, 300)
    return () => clearTimeout(t)
  }, [receipt])

  const lookup = async () => {
    setError('')
    setSale(null)
    setLines([])
    setQty({})
    try {
      const d = await returnsApi.lookupSale({ actingUserId: uid, invoiceNo })
      setSale(d.sale)
      setLines(d.lines)
      if (
        d.sale.payment_type === 'credit' &&
        Number(d.sale.outstanding) > 0 &&
        !d.sale.is_walk_in
      ) {
        setRefundMode('credit_adjust')
      } else setRefundMode('cash')
    } catch (e) {
      setError(e.message)
    }
  }

  // ✅ Updated — accepts filters
  const findByCode = async (overrideFilters = null) => {
    setError('')
    setSale(null)
    setLines([])
    setQty({})
    setCandidates([])
    try {
      const filters = overrideFilters || {
        paymentType: fPayment || undefined,
        amountMin: fAmountMin === '' ? undefined : Number(fAmountMin),
        amountMax: fAmountMax === '' ? undefined : Number(fAmountMax),
        dateFrom: fDateFrom || undefined,
        dateTo: fDateTo || undefined
      }
      const d = await returnsApi.findBillsByItem({
        actingUserId: uid,
        code: invoiceNo,
        ...filters
      })
      setCandidates(d.bills)
      setCandidateItemName(d.item.name)
      if (d.bills.length === 0)
        setError(
          `"${d.item.name}" ke liye koi bill nahi mila — filters change karo.`
        )
    } catch (e) {
      setError(e.message)
    }
  }

  const clearFilters = () => {
    setFPayment('')
    setFAmountMin('')
    setFAmountMax('')
    setFDateFrom('')
    setFDateTo('')
    // Re-run search with empty filters
    if (findMode === 'code' && invoiceNo.trim()) {
      findByCode({
        paymentType: undefined,
        amountMin: undefined,
        amountMax: undefined,
        dateFrom: undefined,
        dateTo: undefined
      })
    }
  }

  const findCredit = async () => {
    setError('')
    setSale(null)
    setLines([])
    setQty({})
    try {
      setCandidates(
        await returnsApi.creditBills({
          actingUserId: uid,
          search: creditSearch
        })
      )
      setCandidateItemName('')
    } catch (e) {
      setError(e.message)
    }
  }

  const openBill = async (invNo) => {
    setError('')
    setSale(null)
    setLines([])
    setQty({})
    try {
      const d = await returnsApi.lookupSale({
        actingUserId: uid,
        invoiceNo: invNo
      })
      setSale(d.sale)
      setLines(d.lines)
      setCandidates([])
      if (
        d.sale.payment_type === 'credit' &&
        Number(d.sale.outstanding) > 0 &&
        !d.sale.is_walk_in
      )
        setRefundMode('credit_adjust')
      else setRefundMode('cash')
    } catch (e) {
      setError(e.message)
    }
  }

  const setLineQty = (id, v, max) => {
    const n = Math.max(0, Math.min(Number(v) || 0, max))
    setQty((q) => ({ ...q, [id]: n }))
  }
  const returnAll = () => {
    const q = {}
    lines.forEach((l) => {
      if (l.remaining > 0) q[l.sale_item_id] = l.remaining
    })
    setQty(q)
  }

  const total = lines.reduce(
    (s, l) => s + (Number(qty[l.sale_item_id]) || 0) * l.per_unit,
    0
  )

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const payloadLines = lines
        .filter((l) => Number(qty[l.sale_item_id]) > 0)
        .map((l) => ({
          saleItemId: l.sale_item_id,
          quantity: Number(qty[l.sale_item_id])
        }))
      const res = await returnsApi.create({
        actingUserId: uid,
        saleId: sale.id,
        lines: payloadLines,
        refundMode,
        accountId: refundMode === 'credit_adjust' ? null : Number(accountId),
        reason,
        createdBy: uid
      })
      const now = new Date()
      setReceipt({
        ...res,
        // the bill's real salesman (billing staff); the logged-in user is the operator
        salesman: res.salesman || '—',
        operator: session?.fullName || session?.username || '—',
        dateOnly: now.toLocaleDateString('en-GB'),
        timeOnly: now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        })
      })
      setSale(null)
      setLines([])
      setQty({})
      setInvoiceNo('')
      setReason('')
      setCandidates([])
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const refundLabel = (mode) => {
    if (mode === 'credit_adjust') return 'Credit Reduced'
    if (mode === 'bank') return 'Bank Transfer'
    return 'Cash Refund'
  }

  // 📍 PIN — hotkeys
  useHotkeys(
    {
      f2: () => inputRef.current?.focus(),
      f5: () => {
        if (busy) return
        if (view === 'history') loadHistory().catch((e) => setError(e.message))
        else if (findMode === 'credit') findCredit()
        else if (findMode === 'code' && invoiceNo.trim()) findByCode()
      },
      f9: () => {
        if (busy || !sale || total <= 0) return
        submit()
      },
      'alt+1': () => {
        setFindMode('invoice')
        setCandidates([])
        setSale(null)
      },
      'alt+2': () => {
        setFindMode('code')
        setCandidates([])
        setSale(null)
      },
      'alt+3': () => {
        setFindMode('credit')
        setCandidates([])
        setSale(null)
        findCredit()
      },
      'alt+4': () => accountRef.current?.focus()
    },
    [
      busy,
      view,
      findMode,
      sale,
      total,
      invoiceNo,
      creditSearch,
      accountId,
      refundMode,
      fPayment,
      fAmountMin,
      fAmountMax,
      fDateFrom,
      fDateTo
    ]
  )

  return (
    <div className="returns-page">
      <div className="po-tabs no-print">
        <button
          className={'po-tab' + (view === 'new' ? ' active' : '')}
          onClick={() => setView('new')}
        >
          <Icon name="return" size={16} /> New Return
        </button>
        <button
          className={'po-tab' + (view === 'history' ? ' active' : '')}
          onClick={() => setView('history')}
        >
          <Icon name="book" size={16} /> Return History
        </button>
      </div>

      {view === 'new' ? (
        <div className="ret-body">
          <div className="panel ret-lookup">
            <h3 className="sale-title">
              <Icon name="return" size={18} /> Return / Refund
            </h3>

            <div className="ret-mode-tabs">
              <button
                className={
                  'ret-mode' + (findMode === 'invoice' ? ' active' : '')
                }
                onClick={() => {
                  setFindMode('invoice')
                  setCandidates([])
                  setSale(null)
                }}
                title="Alt+1"
              >
                By Invoice
              </button>
              <button
                className={'ret-mode' + (findMode === 'code' ? ' active' : '')}
                onClick={() => {
                  setFindMode('code')
                  setCandidates([])
                  setSale(null)
                }}
                title="Alt+2"
              >
                By Product Code
              </button>
              <button
                className={
                  'ret-mode' + (findMode === 'credit' ? ' active' : '')
                }
                onClick={() => {
                  setFindMode('credit')
                  setCandidates([])
                  setSale(null)
                  findCredit()
                }}
                title="Alt+3"
              >
                Credit Bills
              </button>
            </div>

            {findMode === 'invoice' && (
              <div className="ret-find">
                <input
                  ref={inputRef}
                  placeholder="Enter invoice number  (F2)"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup()}
                />
                <button className="btn-sm primary" onClick={lookup}>
                  <Icon name="search" size={15} /> Find Bill
                </button>
              </div>
            )}

            {findMode === 'code' && (
              <>
                <div className="ret-find">
                  <input
                    ref={inputRef}
                    placeholder="Scan / enter product code  (F2)"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && findByCode()}
                  />
                  <button
                    className="btn-sm primary"
                    onClick={() => findByCode()}
                  >
                    <Icon name="search" size={15} /> Find Bills
                  </button>
                  <button
                    type="button"
                    className={'btn-sm ghost' + (filtersOpen ? ' active' : '')}
                    onClick={() => setFiltersOpen((v) => !v)}
                    title="Show / hide filters"
                  >
                    <Icon name="adjust" size={15} /> Filters
                    {(fPayment ||
                      fAmountMin ||
                      fAmountMax ||
                      fDateFrom ||
                      fDateTo) && <span className="filter-dot">●</span>}
                  </button>
                </div>

                {filtersOpen && (
                  <div className="ret-filters">
                    {/* Payment type buttons */}
                    <div className="rf-group">
                      <span className="rf-label">Payment</span>
                      <div className="rf-pay-group">
                        <button
                          type="button"
                          className={
                            'rf-pay-btn' + (fPayment === '' ? ' active' : '')
                          }
                          onClick={() => setFPayment('')}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className={
                            'rf-pay-btn' +
                            (fPayment === 'cash' ? ' active cash' : '')
                          }
                          onClick={() => setFPayment('cash')}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          className={
                            'rf-pay-btn' +
                            (fPayment === 'online' ? ' active online' : '')
                          }
                          onClick={() => setFPayment('online')}
                        >
                          Online
                        </button>
                        <button
                          type="button"
                          className={
                            'rf-pay-btn' +
                            (fPayment === 'credit' ? ' active credit' : '')
                          }
                          onClick={() => setFPayment('credit')}
                        >
                          Credit
                        </button>
                      </div>
                    </div>

                    {/* Amount range */}
                    <div className="rf-group rf-inline">
                      <span className="rf-label">Amount</span>
                      <input
                        type="number"
                        className="rf-input"
                        placeholder="Min"
                        value={fAmountMin}
                        onChange={(e) => setFAmountMin(e.target.value)}
                      />
                      <span className="rf-sep">—</span>
                      <input
                        type="number"
                        className="rf-input"
                        placeholder="Max"
                        value={fAmountMax}
                        onChange={(e) => setFAmountMax(e.target.value)}
                      />
                    </div>

                    {/* Date range */}
                    <div className="rf-group rf-inline">
                      <span className="rf-label">Date</span>
                      <input
                        type="date"
                        className="rf-input"
                        value={fDateFrom}
                        onChange={(e) => setFDateFrom(e.target.value)}
                      />
                      <span className="rf-sep">—</span>
                      <input
                        type="date"
                        className="rf-input"
                        value={fDateTo}
                        onChange={(e) => setFDateTo(e.target.value)}
                      />
                    </div>

                    {/* Actions */}
                    <div className="rf-actions">
                      <button
                        type="button"
                        className="btn-sm ghost"
                        onClick={clearFilters}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="btn-sm primary"
                        onClick={() => findByCode()}
                      >
                        <Icon name="search" size={14} /> Apply
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {findMode === 'credit' && (
              <div className="ret-find">
                <input
                  ref={inputRef}
                  placeholder="Filter by customer name / code (optional)"
                  value={creditSearch}
                  onChange={(e) => setCreditSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && findCredit()}
                />
                <button className="btn-sm primary" onClick={findCredit}>
                  <Icon name="search" size={15} /> Show
                </button>
              </div>
            )}

            {candidates.length > 0 && (
              <>
                {candidateItemName && (
                  <div className="ret-cand-head">
                    <span>
                      <strong>{candidates.length}</strong> bill
                      {candidates.length !== 1 ? 's' : ''} found for{' '}
                      <strong>{candidateItemName}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setCandidates([])}
                      title="Close list"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                )}
                <div className="ret-candidates" ref={candidatesRef}>
                  {candidates.map((b) => (
                    <div
                      key={b.id}
                      data-nav-item
                      tabIndex={0}
                      className="cand-row"
                      onClick={() => openBill(b.invoice_no)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openBill(b.invoice_no)
                        }
                      }}
                    >
                      <div className="cand-main">
                        <div className="cand-line1">
                          <strong>#{b.invoice_no}</strong>
                          {b.invoice_time && (
                            <em className="cand-time">
                              {b.invoice_time.slice(0, 5)}
                            </em>
                          )}
                          {b.payment_type && (
                            <span
                              className={'cand-pay cand-pay-' + b.payment_type}
                            >
                              {PT[b.payment_type]}
                            </span>
                          )}
                        </div>
                        <span className="cand-sub">
                          {b.customer} · {b.invoice_date}
                        </span>
                      </div>
                      <div className="cand-right">
                        <span className="cand-amt">{fmt(b.net_total)}</span>
                        {b.quantity !== undefined && (
                          <em className="cand-qty">
                            {Number(b.quantity)} pc
                            {Number(b.quantity) !== 1 ? 's' : ''}
                          </em>
                        )}
                        {b.remaining !== undefined && (
                          <em className="cand-rem">{b.remaining} returnable</em>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && (
              <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
                {error}
              </div>
            )}

            {sale && (
              <div className="ret-sale-meta">
                <div>
                  <span>Invoice</span>
                  <strong>#{sale.invoice_no}</strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>{sale.invoice_date}</strong>
                </div>
                <div>
                  <span>Customer</span>
                  <strong>
                    {sale.customer} ({sale.customer_code})
                  </strong>
                </div>
                <div>
                  <span>Salesman</span>
                  <strong>{sale.salesman || '—'}</strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>{PT[sale.payment_type]}</strong>
                </div>
                <div>
                  <span>Bill Total</span>
                  <strong>{fmt(sale.net_total)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="panel ret-detail">
            {!sale ? (
              <div className="inv-empty" style={{ margin: 'auto' }}>
                Find a bill to start a return
              </div>
            ) : (
              <>
                <div className="panel-head">
                  <h3>Items on Bill #{sale.invoice_no}</h3>
                  <button className="btn-sm ghost" onClick={returnAll}>
                    Return all remaining
                  </button>
                </div>
                <div className="table-scroll ret-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Item</th>
                        <th className="num">Sold</th>
                        <th className="num">Returned</th>
                        <th className="num">Remaining</th>
                        <th className="num">Unit Price</th>
                        <th className="num">Return Qty</th>
                        <th className="num">Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr
                          key={l.sale_item_id}
                          className={l.remaining <= 0 ? 'row-inactive' : ''}
                        >
                          <td>{l.item_code}</td>
                          <td>{l.description}</td>
                          <td className="num">{Number(l.quantity)}</td>
                          <td className="num">{Number(l.returned_qty)}</td>
                          <td className="num">{l.remaining}</td>
                          <td className="num">{fmt(l.per_unit)}</td>
                          <td className="num">
                            <input
                              className="cell-input sm"
                              type="number"
                              min="0"
                              max={l.remaining}
                              value={qty[l.sale_item_id] || ''}
                              disabled={l.remaining <= 0}
                              onChange={(e) =>
                                setLineQty(
                                  l.sale_item_id,
                                  e.target.value,
                                  l.remaining
                                )
                              }
                            />
                          </td>
                          <td className="num strong">
                            {fmt(
                              (Number(qty[l.sale_item_id]) || 0) * l.per_unit
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ret-refund">
                  <div className="ret-refund-left">
                    <span className="field-label">Refund Method</span>
                    <div className="pay-type-group">
                      <button
                        type="button"
                        className={
                          'pay-type-btn' +
                          (refundMode === 'cash' ? ' active cash' : '')
                        }
                        onClick={() => setRefundMode('cash')}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        className={
                          'pay-type-btn' +
                          (refundMode === 'bank' ? ' active online' : '')
                        }
                        onClick={() => setRefundMode('bank')}
                      >
                        Bank
                      </button>
                      <button
                        type="button"
                        className={
                          'pay-type-btn' +
                          (refundMode === 'credit_adjust'
                            ? ' active credit'
                            : '')
                        }
                        disabled={sale.is_walk_in}
                        onClick={() => setRefundMode('credit_adjust')}
                      >
                        Reduce Credit
                      </button>
                    </div>
                    {refundMode !== 'credit_adjust' ? (
                      <label className="field" style={{ marginTop: 10 }}>
                        <span>From account</span>
                        <select
                          ref={accountRef}
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                          title="Alt+4"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="muted-text" style={{ marginTop: 10 }}>
                        {(() => {
                          // say plainly when the return is MORE than the customer owes
                          const owes = Math.max(0, Number(sale.customer_balance) || 0)
                          if (sale.customer_balance == null || total <= owes + 0.009)
                            return `${fmt(total)} will be deducted from ${sale.customer}'s outstanding balance.`
                          return (
                            `${sale.customer} owes ${fmt(owes)} — that is cleared, and the extra ` +
                            `${fmt(total - owes)} is money you now owe the customer (shown as "payable"; ` +
                            'pay it from Credit/Receipt → Refund to customer).'
                          )
                        })()}
                      </p>
                    )}
                    <input
                      className="remark-input"
                      placeholder="Reason (optional)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                  <div className="ret-refund-right">
                    <div className="ret-total-box">
                      <span>Total Refund</span>
                      <strong>{fmt(total)}</strong>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={submit}
                      disabled={busy || total <= 0}
                      title="Process Return (F9)"
                    >
                      <Icon name="return" size={16} />{' '}
                      {busy ? 'Processing…' : 'Process Return'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="panel ret-history">
          {error && <div className="login-error">{error}</div>}
          <div className="rb-dates" style={{ marginBottom: 10 }}>
            <label>
              From{' '}
              <input type="date" value={histFrom} onChange={(e) => setHistFrom(e.target.value)} />
            </label>
            <label>
              To{' '}
              <input type="date" value={histTo} onChange={(e) => setHistTo(e.target.value)} />
            </label>
            {(histFrom || histTo) && (
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() => {
                  setHistFrom('')
                  setHistTo('')
                }}
              >
                Clear dates
              </button>
            )}
            <span className="muted-text" style={{ margin: 0 }}>
              {history.length} return{history.length === 1 ? '' : 's'} ·{' '}
              {history.reduce((s, r) => s + Number(r.total_qty || 0), 0)} pieces ·{' '}
              {fmt(history.reduce((s, r) => s + Number(r.total_amount || 0), 0))}
            </span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items returned</th>
                  <th className="num">Qty</th>
                  <th>Refund</th>
                  <th className="num">Amount</th>
                  <th>By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="empty">
                      No returns recorded
                    </td>
                  </tr>
                ) : (
                  history.map((r) => (
                    <tr key={r.id}>
                      <td>{r.return_no}</td>
                      <td>#{r.invoice_no}</td>
                      <td>{r.return_date}</td>
                      <td>{r.customer}</td>
                      <td>{r.items || '—'}</td>
                      <td className="num">{Number(r.total_qty || 0)}</td>
                      <td>
                        {r.refund_mode === 'credit_adjust'
                          ? 'Credit reduced'
                          : `${r.account_name || '—'}`}
                      </td>
                      <td className="num strong">{fmt(r.total_amount)}</td>
                      <td>{r.by_user || '—'}</td>
                      <td>{r.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 📍 PIN — hint strip */}
      <div className="hotkey-hint no-print">
        <span>
          <kbd>F2</kbd> Input
        </span>
        <span>
          <kbd>↓</kbd>
          <kbd>↑</kbd> Move · <kbd>Enter</kbd> Open bill
        </span>
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>F9</kbd> Process
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1/2/3</kbd> Mode
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>4</kbd> Account
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>

      {receipt && (
        <div style={{ position: 'fixed', left: '-99999px', top: 0 }} aria-hidden="true">
          <Receipt
            data={receipt}
            profile={profile}
            title="Return Receipt"
            variant="return"
          />
        </div>
      )}
    </div>
  )
}
