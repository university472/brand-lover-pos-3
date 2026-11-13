import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import { localToday } from '../utils/date.js'
import { useHotkeys } from '../hooks/useHotkeys.js' // 📍 PIN
import { printNow } from '../utils/print.js' // 📍 PIN — print helper import

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

export default function DayBook() {
  const { session } = useAuth()
  const uid = session.id
  const [date, setDate] = useState(localToday())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const dateRef = useRef(null) // 📍

  const load = useCallback(async () => {
    setError('')
    try {
      setData(await reportsApi.dayBook({ actingUserId: uid, date }))
    } catch (e) {
      setError(e.message)
    }
  }, [uid, date])
  useEffect(() => {
    load()
  }, [load])

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await reportsApi.exportReport({
        actingUserId: uid,
        reportType: 'daybook',
        date
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

  const today = () => setDate(localToday())

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
      t: () => today(),
      'alt+1': () => dateRef.current?.focus()
    },
    [busy, date]
  )

  return (
    <div className="report-page">
      <ReportTabs />
      <div className="report-bar">
        <div className="rb-dates">
          <label>
            Date{' '}
            <input
              ref={dateRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              title="Alt+1"
            />
          </label>
          <button
            className="btn-sm ghost"
            onClick={today}
            title="Today (Ctrl+T)"
          >
            Today
          </button>
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
      {/* Sales (sales table only) and Recovery (repayments) are separate cards —
          a recovery is money for an OLD sale and is never part of today's Sales. */}
      <div
        className="report-cards"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        <div className="rc-card">
          <span>Sales{data?.salesReturns > 0 ? ' (net of returns)' : ''}</span>
          <strong>{fmt(data?.netSales ?? data?.salesTotal)}</strong>
          <em style={{ fontSize: 11, color: 'var(--muted)' }}>
            {data?.salesBills || 0} bills · Cash {fmt(data?.salesCash)} · Online{' '}
            {fmt(data?.salesOnline)} · Credit {fmt(data?.salesCredit)}
            {data?.salesReturns > 0
              ? ` · Gross ${fmt(data?.salesTotal)} − Returns ${fmt(data?.salesReturns)}`
              : ''}
          </em>
        </div>
        <div className="rc-card">
          <span>Credit Recovery</span>
          <strong className="pos">{fmt(data?.recoveryTotal)}</strong>
          <em style={{ fontSize: 11, color: 'var(--muted)' }}>
            not included in Sales
          </em>
        </div>
        <div className="rc-card">
          <span>Receipts (in)</span>
          <strong className="pos">{fmt(data?.receipts)}</strong>
        </div>
        <div className="rc-card">
          <span>Payments (out)</span>
          <strong className="neg">{fmt(data?.payments)}</strong>
        </div>
        <div className="rc-card">
          <span>Net Movement</span>
          <strong>{fmt(data?.net)}</strong>
        </div>
        <div className="rc-card">
          <span>Purchases</span>
          <strong>{fmt(data?.purchaseTotal)}</strong>
          <em style={{ fontSize: 11, color: 'var(--muted)' }}>
            {data?.purchaseOrders || 0} recv
          </em>
        </div>
      </div>
      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Kind</th>
                <th>Party</th>
                <th>Method</th>
                <th>Account</th>
                <th>Reference</th>
                <th>Description</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {!data || data.vouchers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    No cash/bank movement on this day
                  </td>
                </tr>
              ) : (
                data.vouchers.map((v, i) => (
                  <tr key={i}>
                    <td>{v.voucher_no}</td>
                    <td>
                      {/* SALE vs RECOVERY (etc.) — distinct labels, green = in, red = out */}
                      <span
                        className={
                          'po-badge ' +
                          (v.voucher_type === 'receipt'
                            ? 'received'
                            : 'cancelled')
                        }
                        title={v.voucher_type}
                      >
                        {v.kind || v.voucher_type}
                      </span>
                    </td>
                    <td>{v.party || '—'}</td>
                    <td>{v.payment_method}</td>
                    <td>{v.account_name || '—'}</td>
                    <td>{v.reference || '—'}</td>
                    <td>{v.description || '—'}</td>
                    <td
                      className={
                        'num strong ' +
                        (v.voucher_type === 'receipt' ? 'pos' : 'neg')
                      }
                    >
                      {fmt(v.amount)}
                    </td>
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
          <kbd>Ctrl</kbd>+<kbd>T</kbd> Today
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1</kbd> Date
        </span>
      </div>
    </div>
  )
}
