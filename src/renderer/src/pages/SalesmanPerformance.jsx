import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { presetRange } from '../utils/dateRanges.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

export default function SalesmanPerformance() {
  const { session } = useAuth()
  const uid = session.id
  const ms = new Date()
  ms.setDate(1)
  const [from, setFrom] = useState(toLocalDateStr(ms))
  const [to, setTo] = useState(localToday())
  const [search, setSearch] = useState('') // ✅ NEW — salesman name filter
  const [data, setData] = useState({ rows: [], totals: null })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const fromRef = useRef(null)
  const toRef = useRef(null)
  const searchRef = useRef(null) // ✅ NEW

  const load = useCallback(async () => {
    setError('')
    try {
      setData(
        await reportsApi.salesmanPerformance({
          actingUserId: uid,
          from,
          to,
          search // ✅ NEW
        })
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
        reportType: 'salesman',
        from,
        to,
        search // ✅ NEW
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
  const allTime = () => {
    setFrom('')
    setTo('')
  }
  const clearSearch = () => setSearch('')

  useHotkeys(
    {
      // ✅ NEW — F2 focuses salesman search
      f2: () => searchRef.current?.focus(),
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
      'alt+2': () => toRef.current?.focus(),
      escape: () => {
        if (search) setSearch('')
      }
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
          {/* ✅ NEW — Salesman name search box */}
          <div className="search-box">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder="Search salesman name…  (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn-icon"
                title="Clear"
                onClick={clearSearch}
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

      <div className="report-cards">
        <div className="rc-card">
          <span>Salesmen</span>
          <strong>{data.rows.length}</strong>
        </div>
        <div className="rc-card">
          <span>Bills</span>
          <strong>{t?.bills || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Net Sales</span>
          <strong>{fmt(t?.net_sales ?? t?.sales)}</strong>
          {t?.returns > 0 && (
            <em style={{ fontSize: 11, color: 'var(--muted)' }}>
              Gross {fmt(t?.sales)} − Returns {fmt(t?.returns)}
            </em>
          )}
        </div>
        <div className="rc-card">
          <span>Received</span>
          <strong>{fmt(t?.received)}</strong>
        </div>
        <div className="rc-card amber">
          <span>Credit</span>
          <strong>{fmt(t?.credit)}</strong>
        </div>
      </div>

      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Salesman</th>
                <th>Phone</th>
                <th className="num">Bills</th>
                <th className="num">Sales</th>
                <th className="num">Returns</th>
                <th className="num">Net Sales</th>
                <th className="num">Discount</th>
                <th className="num">Received</th>
                <th className="num">Cash</th>
                <th className="num">Online</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="11" className="empty">
                    {search.trim()
                      ? `No salesman matches "${search.trim()}".`
                      : 'No sales in this period'}
                  </td>
                </tr>
              ) : (
                data.rows.map((r, i) => (
                  <tr key={r.id ?? `unassigned-${i}`}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.phone || '—'}</td>
                    <td className="num">{r.bills}</td>
                    <td className="num">{fmt(r.sales)}</td>
                    <td className={'num' + (r.returns > 0 ? ' neg' : '')}>
                      {r.returns > 0 ? `(${fmt(r.returns)})` : '—'}
                    </td>
                    <td className="num strong">{fmt(r.net_sales)}</td>
                    <td className="num">{fmt(r.discount)}</td>
                    <td className="num">{fmt(r.received)}</td>
                    <td className="num">{fmt(r.cash)}</td>
                    <td className="num">{fmt(r.online)}</td>
                    <td className="num">{fmt(r.credit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hotkey-hint">
        <span>
          <kbd>F2</kbd> Search salesman
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
          <kbd>Esc</kbd> Clear search
        </span>
      </div>
    </div>
  )
}
