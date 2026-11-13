import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import AccountLedger from '../components/AccountLedger.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { presetRange } from '../utils/dateRanges.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

// Credit Recovery report — money received from customers against earlier udhaar.
// Deliberately separate from the Sales report: a recovery is NOT a sale.
export default function CreditRecoveryReport() {
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
  const [ledgerCustomerId, setLedgerCustomerId] = useState(null)

  const fromRef = useRef(null)
  const toRef = useRef(null)
  const searchRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setData(
        await reportsApi.creditRecovery({ actingUserId: uid, from, to, search })
      )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to, search])
  useEffect(() => {
    load()
  }, [load])

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await reportsApi.exportReport({
        actingUserId: uid,
        reportType: 'creditRecovery',
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
  const t = data.totals

  const thisMonth = () => {
    const m = new Date()
    m.setDate(1)
    setFrom(toLocalDateStr(m))
    setTo(localToday())
  }
  const today = () => {
    const d = localToday()
    setFrom(d)
    setTo(d)
  }
  const allTime = () => {
    setFrom('')
    setTo('')
  }

  useHotkeys(
    {
      f5: () => {
        if (!busy) load()
      },
      f9: () => printNow(),
      f2: () => searchRef.current?.focus(),
      e: () => {
        if (!busy) exportXlsx()
      },
      p: () => printNow(),
      t: () => today(),
      w: () => {
        const r = presetRange('week') // Ctrl+W — This Week (same as the button)
        setFrom(r.from)
        setTo(r.to)
      },
      m: () => thisMonth(),
      l: () => allTime(),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus(),
      escape: () => setLedgerCustomerId(null)
    },
    [busy, from, to, search]
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
        </div>
        <div className="rb-actions">
          <div className="search-box">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder="Customer / code / voucher…  (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn-icon"
                title="Clear"
                onClick={() => setSearch('')}
                style={{ padding: 2 }}
              >
                ✕
              </button>
            )}
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
      </div>
      {notice && <div className="inv-notice">{notice}</div>}
      {error && <div className="login-error">{error}</div>}
      <p className="muted-text" style={{ fontSize: 12, margin: '0 0 8px' }}>
        Money received against earlier udhaar. These amounts are NOT sales and are
        not included in any Sales figure.
      </p>
      <div className="report-cards">
        <div className="rc-card">
          <span>Total Recovered</span>
          <strong className="pos">{fmt(t?.total)}</strong>
        </div>
        <div className="rc-card">
          <span>Into Cash</span>
          <strong>{fmt(t?.cash)}</strong>
        </div>
        <div className="rc-card">
          <span>Into Bank</span>
          <strong>{fmt(t?.bank)}</strong>
        </div>
        <div className="rc-card">
          <span>Receipts</span>
          <strong>{t?.count || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Customers</span>
          <strong>{t?.customers || 0}</strong>
        </div>
      </div>
      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Date</th>
                <th>Time</th>
                <th>Customer</th>
                <th>Account</th>
                <th>Note</th>
                <th className="num">Amount</th>
                <th className="num">Balance Now</th>
                <th className="num">Ledger</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty">
                    No recoveries in this period
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.voucher_no}</td>
                    <td>{r.voucher_date}</td>
                    <td>{r.voucher_time || '—'}</td>
                    <td>
                      {r.customer}{' '}
                      <span className="muted-text" style={{ fontSize: 11 }}>
                        {r.customer_code}
                      </span>
                    </td>
                    <td>{r.account_name || '—'}</td>
                    <td>{r.description || '—'}</td>
                    <td className="num strong pos">{fmt(r.amount)}</td>
                    <td className="num">{fmt(r.balance_now)}</td>
                    <td className="num">
                      <button
                        className="icon-btn"
                        title="Open customer ledger"
                        onClick={() => setLedgerCustomerId(r.customer_id)}
                      >
                        <Icon name="book" size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="6" className="num strong">
                    Total
                  </td>
                  <td className="num strong">{fmt(t?.total)}</td>
                  <td colSpan="2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {ledgerCustomerId && (
        <AccountLedger
          customerId={ledgerCustomerId}
          uid={uid}
          onClose={() => setLedgerCustomerId(null)}
        />
      )}

      <div className="hotkey-hint">
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>F2</kbd> Search
        </span>
        <span>
          <kbd>F9</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>E</kbd> Export
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>T/M/L</kbd> Today / Month / All
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1/2</kbd> Date focus
        </span>
      </div>
    </div>
  )
}
