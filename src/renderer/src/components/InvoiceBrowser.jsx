import { useEffect, useState, useCallback, useRef } from 'react'
import { salesApi } from '../api/ipc.js'
import Modal from './Modal.jsx'
import Icon from './Icons.jsx'
import DatePresets from './DatePresets.jsx'
import SaleEditor from './SaleEditor.jsx'
import InvoiceReceipt from './InvoiceReceipt.jsx'
import useKeyLayer, { isEditableTarget } from '../hooks/useKeyLayer.js'
import { presetRange } from '../utils/dateRanges.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const PT = { cash: 'Cash', online: 'Online', credit: 'Credit' }

/**
 * "Previous Invoices" — opened on top of a page (Counter Sale) so the cart there is kept.
 * Search / filter saved bills, type an invoice number to open it straight away, ↑ ↓ + Enter
 * to open the highlighted one. The bill opens in SaleEditor (edit · save · print · ← →).
 *
 * Props: onClose(), onChanged() — called after a bill was edited/cancelled so the caller can
 * refresh balances, stock, etc. `openId` opens that bill directly (e.g. "Last Bill").
 */
export default function InvoiceBrowser({ onClose, onChanged, openId = null }) {
  const today = presetRange('today')
  const [from, setFrom] = useState(today.from)
  const [to, setTo] = useState(today.to)
  const [search, setSearch] = useState('')
  const [ptFilter, setPtFilter] = useState('')
  const [rows, setRows] = useState([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const [gotoNo, setGotoNo] = useState('')
  const [editId, setEditId] = useState(openId)
  const [printId, setPrintId] = useState(null)

  const searchRef = useRef(null)
  const gotoRef = useRef(null)
  const rowRefs = useRef([])

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await salesApi.track({
        from,
        to,
        search,
        paymentType: ptFilter,
        includeCancelled: true
      })
      setRows(r)
      setActive(0)
    } catch (e) {
      setError(e.message)
    }
  }, [from, to, search, ptFilter])

  useEffect(() => {
    const t = setTimeout(load, 150) // typing in the search box → one query, not one per key
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    rowRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  // An invoice number typed in "Open invoice #" can be from any date — not only the list.
  const openByNo = async () => {
    const no = gotoNo.trim()
    if (!no) return
    setError('')
    try {
      const r = await salesApi.findByNo({ invoiceNo: no })
      setGotoNo('')
      setEditId(r.id)
    } catch (e) {
      setError(e.message)
    }
  }

  const closePrint = useCallback(() => setPrintId(null), [])

  useKeyLayer((e) => {
    const k = e.key
    if (k === 'Escape') {
      e.preventDefault()
      onClose?.()
      return
    }
    if (k === 'F2') {
      e.preventDefault()
      searchRef.current?.focus()
      return
    }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'g') {
      e.preventDefault()
      gotoRef.current?.focus()
      return
    }
    // ↑ ↓ move through the list (also while typing in the search box), Enter opens it
    if ((k === 'ArrowDown' || k === 'ArrowUp') && rows.length) {
      if (e.target === gotoRef.current) return
      e.preventDefault()
      setActive((i) =>
        k === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)
      )
      return
    }
    if (k === 'Enter' && rows[active]) {
      if (e.target === gotoRef.current) return // handled by the input itself
      if (isEditableTarget(e.target) && e.target !== searchRef.current) return
      if (e.target?.tagName === 'BUTTON') return // Enter on a focused button clicks it
      e.preventDefault()
      setEditId(rows[active].id)
    }
  })

  return (
    <Modal title="Previous Invoices" width={900} onClose={onClose}>
      <div className="inv-browser-bar">
        <div className="search-box grow">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            autoFocus
            placeholder="Search invoice # / customer / code  (F2)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="search-box inv-nav-goto">
          <Icon name="receipt" size={14} />
          <input
            ref={gotoRef}
            placeholder="Open invoice #  (Ctrl+G)"
            value={gotoNo}
            onChange={(e) => setGotoNo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                openByNo()
              }
            }}
          />
        </div>
      </div>
      <div className="inv-browser-bar">
        <DatePresets
          from={from}
          to={to}
          onChange={(r) => {
            setFrom(r.from)
            setTo(r.to)
          }}
        />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select
          className="role-select"
          value={ptFilter}
          onChange={(e) => setPtFilter(e.target.value)}
        >
          <option value="">All types</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
          <option value="credit">Credit</option>
        </select>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="table-scroll inv-browser-list">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Time</th>
              <th>Customer</th>
              <th>Type</th>
              <th className="num">Total</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty">
                  No invoices for these filters — try &quot;All Time&quot; or type the invoice
                  number above
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.id}
                  ref={(el) => (rowRefs.current[i] = el)}
                  className={
                    'clickable' +
                    (i === active ? ' row-selected' : '') +
                    (r.is_cancelled ? ' row-inactive' : '')
                  }
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setEditId(r.id)}
                >
                  <td className="strong">
                    #{r.invoice_no}
                    {r.is_cancelled ? ' ✕' : ''}
                    {Number(r.return_count) > 0 && <span className="low-tag">returned</span>}
                  </td>
                  <td>{r.invoice_date}</td>
                  <td>{r.invoice_time ? String(r.invoice_time).slice(0, 5) : '—'}</td>
                  <td>
                    {r.customer} <span className="muted-text">· {r.customer_code}</span>
                  </td>
                  <td>{PT[r.payment_type] || r.payment_type}</td>
                  <td className="num strong">{fmt(r.net_total)}</td>
                  <td className="num">
                    <div className="table-actions">
                      <button
                        className="btn-icon"
                        title="Print"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPrintId(r.id)
                        }}
                      >
                        <Icon name="printer" size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Open / edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditId(r.id)
                        }}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="muted-text inv-nav-hint" style={{ marginTop: 8 }}>
        <kbd>↑</kbd>
        <kbd>↓</kbd> select · <kbd>Enter</kbd> open · inside a bill <kbd>←</kbd>
        <kbd>→</kbd> previous / next · <kbd>Esc</kbd> close
      </p>

      {editId && (
        <SaleEditor
          saleId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            load()
            onChanged?.()
          }}
        />
      )}
      {printId && <InvoiceReceipt saleId={printId} onClose={closePrint} autoPrint />}
    </Modal>
  )
}
