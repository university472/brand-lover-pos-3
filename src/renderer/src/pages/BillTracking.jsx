import { useEffect, useState, useCallback, useRef } from 'react'
import { salesApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import InvoiceReceipt from '../components/InvoiceReceipt.jsx'
import SaleEditor from '../components/SaleEditor.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { presetRange } from '../utils/dateRanges.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const PT = { cash: 'Cash', online: 'Online', credit: 'Credit' }

export default function BillTracking() {
  const { session } = useAuth()
  const uid = session.id
  const ms = new Date()
  ms.setDate(1)

  const [from, setFrom] = useState(toLocalDateStr(ms))
  const [to, setTo] = useState(localToday())
  const [search, setSearch] = useState('')
  const [ptFilter, setPtFilter] = useState('')
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  // Bill open in the shared editor (edit · save & print · cancel · ← → previous / next)
  const [editId, setEditId] = useState(null)
  const [reprintId, setReprintId] = useState(null)

  const searchRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(
        await salesApi.track({
          actingUserId: uid,
          from,
          to,
          search,
          paymentType: ptFilter,
          includeCancelled
        })
      )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to, search, ptFilter, includeCancelled])
  useEffect(() => {
    load()
  }, [load])

  const openBill = (id) => setEditId(id)

  // While the editor is open its own keys apply (useKeyLayer) — these are the list's keys.
  useHotkeys(
    {
      t: () => {
        const r = presetRange('today')
        setFrom(r.from)
        setTo(r.to)
      },
      w: () => {
        const r = presetRange('week') // Ctrl+W — This Week (same as the button)
        setFrom(r.from)
        setTo(r.to)
      },
      m: () => {
        const r = presetRange('month')
        setFrom(r.from)
        setTo(r.to)
      },
      l: () => {
        setFrom('')
        setTo('')
      },
      f2: () => searchRef.current?.focus(),
      f5: () => load(),
      p: () => printNow(),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus()
    },
    [from, to, search, ptFilter, includeCancelled]
  )

  return (
    <div className="report-page">
      <div className="report-bar">
        <div className="rb-dates">
          <label>
            From{' '}
            <input
              ref={fromRef}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              title="Alt+1"
            />
          </label>
          <label>
            To{' '}
            <input
              ref={toRef}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              title="Alt+2"
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
          <label className="bc-check">
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(e) => setIncludeCancelled(e.target.checked)}
            />{' '}
            Show cancelled
          </label>
        </div>
        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            placeholder="Invoice / customer / code  (F2)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {/* How many bills the filters matched. The list is capped at the latest 300 (backend
          LIMIT) — say so instead of silently hiding older bills when "All Time" is picked. */}
      <p className="muted-text" style={{ fontSize: 12, margin: '0 0 6px' }}>
        {rows.length} bill{rows.length === 1 ? '' : 's'}
        {rows.length >= 300 && (
          <strong className="neg">
            {' '}
            — showing the latest 300 only. Narrow the dates or search to see older bills.
          </strong>
        )}
      </p>
      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Time</th>
                <th>Customer</th>
                <th>Salesman</th>
                <th>Type</th>
                <th>Due Date</th>
                <th className="num">Total</th>
                <th className="num">Received</th>
                <th className="num">Cashback</th>
                <th className="num">Due</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="12" className="empty">
                    No bills in this range
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      'clickable' + (r.is_cancelled ? ' row-inactive' : '')
                    }
                    onClick={() => openBill(r.id)}
                  >
                    <td>
                      #{r.invoice_no}
                      {r.is_cancelled ? ' ✕' : ''}
                      {Number(r.return_count) > 0 && (
                        <span className="low-tag">returned</span>
                      )}
                    </td>
                    <td>{r.invoice_date}</td>
                    {/* Bill time (same as the Dashboard's Sales Invoices list) */}
                    <td>{r.invoice_time ? String(r.invoice_time).slice(0, 5) : '—'}</td>
                    <td>
                      {r.customer}{' '}
                      <span className="muted-text">· {r.customer_code}</span>
                    </td>
                    <td>{r.salesman || '—'}</td>
                    <td>
                      <span
                        className={
                          'po-badge ' +
                          (r.payment_type === 'credit' ? 'ordered' : 'received')
                        }
                      >
                        {PT[r.payment_type]}
                      </span>
                    </td>
                    <td>
                      {r.due_date ? (
                        <span className={r.is_overdue ? 'due-overdue' : ''}>
                          {r.due_date}
                          {r.is_overdue ? ' ⚠' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num strong">{fmt(r.net_total)}</td>
                    <td className="num">{fmt(r.amount_received)}</td>
                    <td className="num">{fmt(r.cash_back)}</td>
                    {(() => {
                      // credit bills: what is REALLY still unpaid after repayments and returns
                      const due =
                        r.payment_type === 'credit'
                          ? Number(r.remaining_due) || 0
                          : Math.max(0, Number(r.outstanding) || 0)
                      return (
                        <td className={'num strong ' + (due > 0 ? 'neg' : '')}>
                          {fmt(due)}
                        </td>
                      )
                    })()}
                    <td className="num">
                      <div className="table-actions">
                        <button
                          className="btn-icon"
                          title="Print receipt"
                          onClick={(e) => {
                            e.stopPropagation()
                            setReprintId(r.id)
                          }}
                        >
                          <Icon name="printer" size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit bill"
                          onClick={(e) => {
                            e.stopPropagation()
                            openBill(r.id)
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
      </div>

      <div className="hotkey-hint">
        <span>
          <kbd>F2</kbd> Search
        </span>
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1/2</kbd> Date
        </span>
        <span>
          In a bill: <kbd>←</kbd>
          <kbd>→</kbd> Prev / Next
        </span>
        <span>
          <kbd>F8</kbd> Add item
        </span>
        <span>
          <kbd>F9</kbd> Save &amp; Print
        </span>
        <span>
          <kbd>Del</kbd> Undo line
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>

      {editId && (
        <SaleEditor saleId={editId} onClose={() => setEditId(null)} onSaved={load} />
      )}

      {reprintId && (
        <InvoiceReceipt saleId={reprintId} onClose={() => setReprintId(null)} autoPrint />
      )}
    </div>
  )
}
