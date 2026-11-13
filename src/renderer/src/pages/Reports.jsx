import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
// 📍 PIN #1 — hotkeys hook
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { presetRange } from '../utils/dateRanges.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
const PT = { cash: 'Cash', online: 'Online', credit: 'Credit' }

export default function Reports() {
  const { session } = useAuth()
  const uid = session.id
  const monthStart = new Date()
  monthStart.setDate(1)

  const [from, setFrom] = useState(toLocalDateStr(monthStart))
  const [to, setTo] = useState(localToday())
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [totals, setTotals] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState(null)

  // 📍 PIN #2 — refs for focus shortcuts
  const searchRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const d = await reportsApi.customerSummary({
        actingUserId: uid,
        from,
        to,
        search
      })
      setRows(d.rows)
      setTotals(d.totals)
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to, search])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (c) => {
    setError('')
    try {
      setDetail(
        await reportsApi.customerDetail({
          actingUserId: uid,
          customerId: c.id,
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
      const r = await reportsApi.exportCustomerSummary({
        actingUserId: uid,
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

  const thisMonth = () => {
    const m = new Date()
    m.setDate(1)
    setFrom(toLocalDateStr(m))
    setTo(localToday())
  }
  const allTime = () => {
    setFrom('')
    setTo('')
  }

  // 📍 PIN #3 — hotkeys registration
  useHotkeys(
    {
      // F2 → focus search box
      f2: () => searchRef.current?.focus(),
      // F5 → reload data
      f5: () => {
        if (!busy) load()
      },
      // F9 → print the reports page
      f9: () => printNow(),
      // Ctrl+E → Export Excel
      e: () => {
        if (busy) return
        exportXlsx()
      },
      // Ctrl+P → print page
      p: () => printNow(),
      // Ctrl+M → This Month
      w: () => {
        const r = presetRange('week') // Ctrl+W — This Week (same as the button)
        setFrom(r.from)
        setTo(r.to)
      },
      m: () => thisMonth(),
      // Ctrl+L → All Time
      l: () => allTime(),
      // Alt+1 / Alt+2 → focus date fields
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus(),
      // Escape → close detail modal
      escape: () => {
        if (detail) setDetail(null)
      }
    },
    [busy, detail, from, to, search]
  )

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
        <div className="rb-actions">
          <div className="search-box">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder="Search name / code  (F2)"
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
          <span>Bills</span>
          <strong>{totals?.bills || 0}</strong>
        </div>
        <div className="rc-card">
          {/* This is BILLED (sales), not payments — label fixed; net of returns shown below */}
          <span>Total Billed</span>
          <strong>{fmt(totals?.billed)}</strong>
          {totals?.returns > 0 && (
            <em style={{ fontSize: 11, color: 'var(--muted)' }}>
              Returns {fmt(totals?.returns)} · Net {fmt(totals?.net_sales)}
            </em>
          )}
        </div>
        <div className="rc-card">
          <span>Received</span>
          <strong>{fmt(totals?.received)}</strong>
        </div>
        <div className="rc-card amber">
          <span>Outstanding Credit</span>
          <strong>{fmt(totals?.outstanding)}</strong>
        </div>
      </div>

      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer</th>
                <th className="num">Bills</th>
                <th className="num">Billed</th>
                <th className="num">Returns</th>
                <th className="num">Received</th>
                <th className="num">Change</th>
                <th className="num">Cash</th>
                <th className="num">Online</th>
                <th className="num">Credit</th>
                <th className="num">Outstanding</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="12" className="empty">
                    No activity in this period
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => openDetail(r)}
                  >
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td className="num">{r.bills}</td>
                    <td className="num">{fmt(r.billed)}</td>
                    <td className={'num' + (r.returns > 0 ? ' neg' : '')}>
                      {r.returns > 0 ? `(${fmt(r.returns)})` : '—'}
                    </td>
                    <td className="num">{fmt(r.received)}</td>
                    <td className="num">{fmt(r.change_given)}</td>
                    <td className="num">{fmt(r.cash_total)}</td>
                    <td className="num">{fmt(r.online_total)}</td>
                    <td className="num">{fmt(r.credit_total)}</td>
                    <td
                      className={
                        'num strong ' + (Number(r.outstanding) > 0 ? 'neg' : '')
                      }
                    >
                      {fmt(r.outstanding)}
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

      {/* 📍 PIN #4 — shortcut hint strip */}
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
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>M</kbd> This month
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>L</kbd> All time
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
          title={`${detail.customer.name} · ${detail.customer.code}`}
          width={720}
          onClose={() => setDetail(null)}
          footer={
            <button className="btn-primary" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          <div className="rd-balance">
            Current outstanding:{' '}
            <strong
              className={
                Number(detail.customer.current_balance) > 0 ? 'neg' : 'pos'
              }
            >
              {fmt(detail.customer.current_balance)}
            </strong>
          </div>

          <h4 className="cd-sub">Bills</h4>
          <div className="rd-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Salesman</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Change</th>
                  <th className="num">Due</th>
                </tr>
              </thead>
              <tbody>
                {detail.sales.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty">
                      No bills in range
                    </td>
                  </tr>
                ) : (
                  detail.sales.map((s) => (
                    <tr key={s.id}>
                      <td>#{s.invoice_no}</td>
                      <td>{s.invoice_date}</td>
                      <td>
                        <span
                          className={
                            'po-badge ' +
                            (s.payment_type === 'credit'
                              ? 'ordered'
                              : 'received')
                          }
                        >
                          {PT[s.payment_type]}
                        </span>
                      </td>
                      <td>{s.salesman || '—'}</td>
                      <td className="num">{fmt(s.net_total)}</td>
                      <td className="num">{fmt(s.amount_received)}</td>
                      <td className="num">{fmt(s.change_given)}</td>
                      <td
                        className={
                          'num strong ' +
                          (Number(s.outstanding) > 0 ? 'neg' : '')
                        }
                      >
                        {fmt(s.outstanding)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h4 className="cd-sub">Repayments</h4>
          <div className="rd-scroll short">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Note</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.repayments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty">
                      No repayments in range
                    </td>
                  </tr>
                ) : (
                  detail.repayments.map((r) => (
                    <tr key={r.id}>
                      <td>{r.voucher_no}</td>
                      <td>{r.voucher_date}</td>
                      <td>{r.account_name || '—'}</td>
                      <td>{r.description}</td>
                      <td className="num strong pos">{fmt(r.amount)}</td>
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
