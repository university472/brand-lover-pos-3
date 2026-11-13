import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js' // 📍 PIN
import { printNow } from '../utils/print.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { presetRange } from '../utils/dateRanges.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

export default function PurchasePaymentsReport() {
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

  const fromRef = useRef(null) // 📍
  const toRef = useRef(null) // 📍

  const load = useCallback(async () => {
    setError('')
    try {
      setData(
        await reportsApi.purchasePayments({ actingUserId: uid, from, to })
      )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to])
  useEffect(() => {
    load()
  }, [load])

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await reportsApi.exportReport({
        actingUserId: uid,
        reportType: 'purchasePayments',
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

  const t = data.totals

  // 📍 PIN — hotkeys
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
      w: () => {
        const r = presetRange('week') // Ctrl+W — This Week (same as the button)
        setFrom(r.from)
        setTo(r.to)
      },
      m: () => thisMonth(),
      l: () => allTime(),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus()
    },
    [busy, from, to]
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
      {error && <div className="login-error">{error}</div>}
      <div className="report-cards">
        <div className="rc-card">
          <span>Total Paid</span>
          <strong>{fmt(t?.total)}</strong>
        </div>
        <div className="rc-card">
          <span>Cash</span>
          <strong>{fmt(t?.cash)}</strong>
        </div>
        <div className="rc-card">
          <span>Online / Bank</span>
          <strong>{fmt(t?.bank)}</strong>
        </div>
      </div>
      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Date</th>
                <th>PO</th>
                <th>Vendor</th>
                <th>Method</th>
                <th>Account</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty">
                    No purchase payments in this range
                  </td>
                </tr>
              ) : (
                data.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.voucher_no}</td>
                    <td>{r.voucher_date}</td>
                    <td>{r.serial_no || '—'}</td>
                    <td>{r.vendor || '—'}</td>
                    <td>
                      <span
                        className={
                          'po-badge ' +
                          (r.payment_method === 'bank' ? 'ordered' : 'received')
                        }
                      >
                        {r.payment_method === 'bank' ? 'Online' : 'Cash'}
                      </span>
                    </td>
                    <td>{r.account_name || '—'}</td>
                    <td className="num strong neg">{fmt(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📍 PIN — hint strip */}
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
      </div>
    </div>
  )
}
