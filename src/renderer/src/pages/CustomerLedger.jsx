import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi, salesApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { useArrowListNav } from '../hooks/useArrowListNav.js'
import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { printNow } from '../utils/print.js' // 📍 PIN #1 — print helper import

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export default function CustomerLedger() {
  const { session } = useAuth()
  const uid = session.id

  const monthStart = new Date()
  monthStart.setDate(1)

  const [mode, setMode] = useState('ledger') // 'ledger' | 'balances'
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [from, setFrom] = useState(toLocalDateStr(monthStart))
  const [to, setTo] = useState(localToday())
  const [search, setSearch] = useState('')
  const [data, setData] = useState(null)
  const [balData, setBalData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const searchRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)
  const custListRef = useRef(null)
  useArrowListNav(custListRef)

  useEffect(() => {
    ;(async () => {
      try {
        setCustomers(await salesApi.customers())
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  const loadLedger = useCallback(async () => {
    if (!customerId) {
      setData(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      setData(
        await reportsApi.customerLedger({
          actingUserId: uid,
          customerId: Number(customerId),
          from,
          to
        })
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [uid, customerId, from, to])

  const loadBalances = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      setBalData(
        await reportsApi.customerBalances({
          actingUserId: uid,
          from,
          to,
          search
        })
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [uid, from, to, search])

  useEffect(() => {
    if (mode === 'ledger') loadLedger()
    else loadBalances()
  }, [mode, loadLedger, loadBalances])

  // 📍 PIN #2 — printIt ko replace kiya: manual body-class + window.print() hata ke
  // ek hi line mein printNow('print-ledger') — class lagana/hatana andar handle hota hai.
  const printIt = () => printNow('print-ledger')

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

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f5: () => {
        if (busy) return
        mode === 'ledger' ? loadLedger() : loadBalances()
      },
      // 📍 PIN #3 — F9: window.print() → printNow('print-ledger')
      f9: () => printNow('print-ledger'),
      // 📍 PIN #4 — Ctrl+P: window.print() → printNow('print-ledger')
      p: () => printNow('print-ledger'),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus()
    },
    [busy, mode, customerId, from, to, search]
  )

  const filteredCustomers = customers.filter((c) => {
    const t = search.trim().toLowerCase()
    if (!t) return true
    return (
      String(c.name).toLowerCase().includes(t) ||
      String(c.code).toLowerCase().includes(t)
    )
  })

  const renderLedger = () => {
    if (!data)
      return (
        <div className="inv-empty" style={{ margin: 'auto' }}>
          Pick a customer from the left
        </div>
      )
    return (
      <>
        <div className="ledger-meta">
          <div>
            <span className="lm-label">Account</span>
            <strong>
              {data.customer.code} · {data.customer.name}
            </strong>
          </div>
          <div>
            <span className="lm-label">Period</span>
            <strong>
              {from || 'beginning'} → {to || 'today'}
            </strong>
          </div>
          {data.customer.telephone && (
            <div>
              <span className="lm-label">Phone</span>
              <strong>{data.customer.telephone}</strong>
            </div>
          )}
          {/* Total Sales = this customer's invoices only; recoveries are a separate figure
              (the rows below show both, but they are never added together). */}
          {data.totals.totalSales !== undefined && (
            <div>
              <span className="lm-label">Total Sales</span>
              <strong>
                {fmt(data.totals.grossSales ?? data.totals.totalSales)}{' '}
                <span className="muted-text" style={{ fontSize: 11 }}>
                  ({data.totals.salesBills} bills
                  {data.totals.salesReturns > 0
                    ? ` · returns ${fmt(data.totals.salesReturns)} · net ${fmt(data.totals.totalSales)}`
                    : ''}
                  )
                </span>
              </strong>
            </div>
          )}
          {data.totals.totalRecovery !== undefined && (
            <div>
              <span className="lm-label">Total Recovery</span>
              <strong className="pos">{fmt(data.totals.totalRecovery)}</strong>
            </div>
          )}
          <div>
            <span className="lm-label">Closing Balance</span>
            <strong className={data.totals.closing > 0 ? 'neg' : 'pos'}>
              {fmt(Math.abs(data.totals.closing))}{' '}
              {data.totals.closing > 0.009
                ? 'Dr'
                : data.totals.closing < -0.009
                  ? 'Cr'
                  : ''}
            </strong>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tran No</th>
                <th>Reference No</th>
                <th>Description</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th className="num">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.date || '—'}</td>
                  <td>{r.tran_no || '—'}</td>
                  <td>{r.ref_no || '—'}</td>
                  <td>{r.description}</td>
                  <td className="num">{r.debit > 0 ? fmt(r.debit) : ''}</td>
                  <td className="num">{r.credit > 0 ? fmt(r.credit) : ''}</td>
                  <td className="num strong">{fmt(Math.abs(r.balance))}</td>
                  <td>
                    <span
                      className={
                        'ledger-status ' +
                        (r.status === 'Dr'
                          ? 'dr'
                          : r.status === 'Cr'
                            ? 'cr'
                            : '')
                      }
                    >
                      {r.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="ledger-totals">
                <td colSpan="4" className="strong">
                  Totals
                </td>
                <td className="num strong">{fmt(data.totals.debit)}</td>
                <td className="num strong">{fmt(data.totals.credit)}</td>
                <td className="num strong">
                  {fmt(Math.abs(data.totals.closing))}
                </td>
                <td>
                  {data.totals.closing > 0.009
                    ? 'Dr'
                    : data.totals.closing < -0.009
                      ? 'Cr'
                      : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    )
  }

  const renderBalances = () => {
    if (!balData)
      return (
        <div className="inv-empty" style={{ margin: 'auto' }}>
          Loading…
        </div>
      )
    return (
      <>
        <div className="ledger-meta">
          <div>
            <span className="lm-label">Report</span>
            <strong>Customers' Balances</strong>
          </div>
          <div>
            <span className="lm-label">Period</span>
            <strong>
              {from || 'beginning'} → {to || 'today'}
            </strong>
          </div>
          <div>
            <span className="lm-label">Customers</span>
            <strong>{balData.rows.length}</strong>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table ledger-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer</th>
                <th className="num">Opening</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th className="num">Closing</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {balData.rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty">
                    No customers
                  </td>
                </tr>
              ) : (
                balData.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => {
                      setCustomerId(String(r.id))
                      setMode('ledger')
                    }}
                  >
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td className="num">{fmt(Math.abs(r.opening))}</td>
                    <td className="num">{r.debit > 0 ? fmt(r.debit) : ''}</td>
                    <td className="num">{r.credit > 0 ? fmt(r.credit) : ''}</td>
                    <td className="num strong">{fmt(Math.abs(r.closing))}</td>
                    <td>
                      <span
                        className={
                          'ledger-status ' +
                          (r.status === 'Dr'
                            ? 'dr'
                            : r.status === 'Cr'
                              ? 'cr'
                              : '')
                        }
                      >
                        {r.status || '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="ledger-totals">
                <td colSpan="2" className="strong">
                  Totals ({balData.rows.length})
                </td>
                <td className="num strong">
                  {fmt(Math.abs(balData.totals.opening))}
                </td>
                <td className="num strong">{fmt(balData.totals.debit)}</td>
                <td className="num strong">{fmt(balData.totals.credit)}</td>
                <td className="num strong">
                  {fmt(Math.abs(balData.totals.closing))}
                </td>
                <td>
                  {balData.totals.closing > 0.009
                    ? 'Dr'
                    : balData.totals.closing < -0.009
                      ? 'Cr'
                      : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    )
  }

  return (
    <div className="report-page ledger-page">
      <div className="report-bar ledger-bar noprint">
        <div className="rb-dates">
          <div className="ledger-modetabs">
            <button
              className={'btn-sm ' + (mode === 'ledger' ? 'primary' : 'ghost')}
              onClick={() => setMode('ledger')}
            >
              Ledger
            </button>
            <button
              className={
                'btn-sm ' + (mode === 'balances' ? 'primary' : 'ghost')
              }
              onClick={() => setMode('balances')}
            >
              Balances
            </button>
          </div>
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
              placeholder="Find customer name / code  (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn-sm primary"
            onClick={printIt}
            disabled={busy || (mode === 'ledger' && !data)}
          >
            <Icon name="printer" size={15} /> Print
          </button>
        </div>
      </div>

      {error && <div className="login-error noprint">{error}</div>}

      <div className="ledger-body">
        {mode === 'ledger' && (
          <div className="ledger-custlist panel noprint">
            <h4 className="cd-sub">Select Account</h4>
            <div className="ledger-custscroll" ref={custListRef}>
              {filteredCustomers.length === 0 && (
                <div className="inv-empty">No customers</div>
              )}
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  data-nav-item
                  tabIndex={0}
                  className={
                    'ledger-custrow' +
                    (String(c.id) === String(customerId) ? ' active' : '')
                  }
                  onClick={() => setCustomerId(String(c.id))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setCustomerId(String(c.id))
                    }
                  }}
                >
                  <div className="lcr-code">{c.code}</div>
                  <div className="lcr-name">{c.name}</div>
                  <div className="lcr-bal">
                    {Number(c.current_balance || 0).toLocaleString('en-PK', {
                      maximumFractionDigits: 2
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ledger-main panel">
          <div className="ledger-print-head">
            <h2>Brand Lover Family Store</h2>
            <h3>
              {mode === 'ledger' ? 'Account Ledger' : "Customers' Balances"}
            </h3>
          </div>
          {mode === 'ledger' ? renderLedger() : renderBalances()}
        </div>
      </div>

      <div className="hotkey-hint noprint">
        <span>
          <kbd>F2</kbd> Search
        </span>
        <span>
          <kbd>↓</kbd>
          <kbd>↑</kbd> Move · <kbd>Enter</kbd> Select
        </span>
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>F9</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1/2</kbd> Date
        </span>
      </div>
    </div>
  )
}
