import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import InvoiceReceipt from '../components/InvoiceReceipt.jsx'
import SaleEditor from '../components/SaleEditor.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js' // 📍 PIN
import { printNow } from '../utils/print.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import {
  sortInvoices,
  paginate,
  summarize,
  groupStats,
  buildPageGroups,
  newestGroupKey,
  pageButtons
} from '../utils/invoiceView.js'
import DatePresets from '../components/DatePresets.jsx'
import { presetRange } from '../utils/dateRanges.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })

const TYPES = [
  ['', 'All'],
  ['cash', 'Cash'],
  ['online', 'Online'],
  ['credit', 'Credit']
]

export default function SalesReport() {
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
  // Monthly / yearly sales = the same sales-only data grouped by period.
  const [groupBy, setGroupBy] = useState('day') // 'day' | 'month' | 'year'
  // 'summary' = totals per day/month/year; 'invoices' = every single bill in the period,
  // so the owner can see how many were cash / online / credit and open any of them.
  const [view, setView] = useState('summary')
  const [payType, setPayType] = useState('')
  const [search, setSearch] = useState('')
  const [inv, setInv] = useState({ rows: [], totals: null })
  const [reprintId, setReprintId] = useState(null)
  const [editId, setEditId] = useState(null) // invoice open in the editor
  // Large-list controls for "All Invoices" (all client-side: the backend returns every
  // invoice in the range, and Excel export still fetches ALL of them itself).
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' })
  const [pageSize, setPageSize] = useState(20) // 0 = All
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(() => new Set())

  const fromRef = useRef(null) // 📍
  const toRef = useRef(null) // 📍
  const searchRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      if (view === 'invoices')
        setInv(
          await reportsApi.salesInvoices({
            actingUserId: uid,
            from,
            to,
            paymentType: payType,
            search
          })
        )
      else
        setData(
          await reportsApi.salesSummary({ actingUserId: uid, from, to, groupBy })
        )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to, groupBy, view, payType, search])
  useEffect(() => {
    load()
  }, [load])

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await reportsApi.exportReport(
        view === 'invoices'
          ? {
              actingUserId: uid,
              reportType: 'salesInvoices',
              from,
              to,
              paymentType: payType,
              search
            }
          : { actingUserId: uid, reportType: 'sales', from, to, groupBy }
      )
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
  const it = inv.totals

  // "All Time" → group by month, otherwise by day
  const byMonth = !from && !to
  const sorted = useMemo(() => sortInvoices(inv.rows, sort, byMonth), [inv.rows, sort, byMonth])
  const pg = paginate(sorted, pageSize, page)
  const stats = useMemo(() => groupStats(inv.rows, byMonth), [inv.rows, byMonth])
  const pageGroups = buildPageGroups(pg.pageRows, stats, byMonth)
  const allTotals = useMemo(() => summarize(inv.rows), [inv.rows])
  const pageTotals = summarize(pg.pageRows)

  // New data / filters / sort / page size → back to page 1
  useEffect(() => {
    setPage(1)
  }, [from, to, payType, search, sort, pageSize])
  // New data → only the newest group starts open (older ones collapsed)
  useEffect(() => {
    const k = newestGroupKey(inv.rows, byMonth)
    setExpanded(new Set(k ? [k] : []))
  }, [inv.rows, byMonth])

  const toggleGroup = (k) =>
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const expandAll = () => setExpanded(new Set(stats.keys()))
  const collapseAll = () => setExpanded(new Set())
  const allOpen = stats.size > 0 && expanded.size >= stats.size

  const sortBy = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'invoice' ? 'asc' : 'desc' }
    )
  const sortHead = (key, label, cls = '') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        className={'sr-sort' + (sort.key === key ? ' active' : '')}
        onClick={() => sortBy(key)}
        title={`Sort by ${label}`}
      >
        {label}
        <span className="sr-arrow">{sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  )
  const goPage = (n) => setPage(Math.min(Math.max(1, n), pg.pageCount))
  // Print only this report (the app's global print CSS hides everything else otherwise,
  // which made F9 print a blank page here).
  const printReport = () => printNow('print-sales')
  const rangeLabel = !from && !to ? 'All Time' : `${from || '…'} → ${to || '…'}`

  const thisMonth = () => {
    const m = new Date()
    m.setDate(1)
    setFrom(toLocalDateStr(m))
    setTo(localToday())
  }
  const today = () => {
    setFrom(localToday())
    setTo(localToday())
  }
  const allTime = () => {
    setFrom('')
    setTo('')
  }

  // 📍 PIN — hotkeys
  useHotkeys(
    {
      f5: () => {
        if (!busy) load()
      },
      f9: () => printReport(),
      f2: () => {
        setView('invoices')
        setTimeout(() => searchRef.current?.focus(), 0)
      },
      e: () => {
        if (!busy) exportXlsx()
      },
      p: () => printReport(),
      t: () => today(),
      w: () => {
        const r = presetRange('week') // Ctrl+W — This Week (same as the button)
        setFrom(r.from)
        setTo(r.to)
      },
      m: () => thisMonth(),
      l: () => allTime(),
      i: () => setView((v) => (v === 'invoices' ? 'summary' : 'invoices')),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus(),
      escape: () => setReprintId(null),
      // previous / next page of the invoice list
      'alt+arrowleft': () => view === 'invoices' && goPage(pg.page - 1),
      'alt+arrowright': () => view === 'invoices' && goPage(pg.page + 1)
    },
    [busy, from, to, groupBy, view, payType, search, pg.page, pg.pageCount]
  )

  // "Rs. X · N bills" card used by both views
  const typeCard = (label, amount, count, key, extraClass = '') => (
    <div
      className={
        'rc-card' +
        extraClass +
        (view === 'invoices' ? ' clickable' : '') +
        (view === 'invoices' && payType === key ? ' rc-active' : '')
      }
      onClick={
        view === 'invoices' ? () => setPayType(payType === key ? '' : key) : undefined
      }
      title={view === 'invoices' ? `Show only ${label} invoices` : undefined}
    >
      <span>{label}</span>
      <strong>{fmt(amount)}</strong>
      <em style={{ fontSize: 11, color: 'var(--muted)' }}>{count || 0} bills</em>
    </div>
  )

  return (
    <div
      className={'report-page' + (view === 'invoices' ? ' sr-invoices' : '')}
      id="sales-report-print"
    >
      {/* Only visible on paper */}
      <div className="sr-print-head">
        <h2>Brand Lover Family Store</h2>
        <p>
          Sales Report — {view === 'invoices' ? 'All Invoices' : 'Summary'} · {rangeLabel}
          {view === 'invoices' && payType ? ` · ${payType}` : ''}
          {view === 'invoices' && search ? ` · search "${search}"` : ''}
        </p>
      </div>
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
          <div className="po-tabs" style={{ marginLeft: 8 }}>
            <button
              type="button"
              className={'po-tab' + (view === 'summary' ? ' active' : '')}
              onClick={() => setView('summary')}
            >
              Summary
            </button>
            <button
              type="button"
              className={'po-tab' + (view === 'invoices' ? ' active' : '')}
              onClick={() => setView('invoices')}
              title="Every invoice in the period (Ctrl+I)"
            >
              All Invoices
            </button>
          </div>
          {view === 'summary' && (
            <div className="po-tabs" style={{ marginLeft: 8 }}>
              {[
                ['day', 'Daily'],
                ['month', 'Monthly'],
                ['year', 'Yearly']
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={'po-tab' + (groupBy === k ? ' active' : '')}
                  onClick={() => setGroupBy(k)}
                >
                  {label}
                </button>
              ))}
            </div>
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
      {notice && <div className="inv-notice">{notice}</div>}
      {error && <div className="login-error">{error}</div>}
      <p className="muted-text" style={{ fontSize: 12, margin: '0 0 8px' }}>
        Sales invoices only — credit recoveries are in the Credit Recovery report.
      </p>

      {view === 'summary' ? (
        <>
          <div
            className="report-cards"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}
          >
            <div className="rc-card">
              <span>Bills</span>
              <strong>{t?.bills || 0}</strong>
            </div>
            <div className="rc-card">
              <span>Sales (gross)</span>
              <strong>{fmt(t?.sales)}</strong>
            </div>
            {/* Returns are subtracted on the date they happen → Net Sales */}
            <div className="rc-card">
              <span>Returns</span>
              <strong className={t?.returns > 0 ? 'neg' : ''}>{fmt(t?.returns)}</strong>
            </div>
            <div className="rc-card">
              <span>Net Sales</span>
              <strong>{fmt(t?.net_sales)}</strong>
            </div>
            {typeCard('Cash', t?.cash, t?.cash_bills, 'cash')}
            {typeCard('Online', t?.online, t?.online_bills, 'online')}
            {typeCard('Credit', t?.credit, t?.credit_bills, 'credit', ' amber')}
          </div>
          <div className="panel report-table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      {groupBy === 'month' ? 'Month' : groupBy === 'year' ? 'Year' : 'Date'}
                    </th>
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
                      <td colSpan="10" className="empty">
                        No sales in this period
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((r) => (
                      <tr key={r.invoice_date}>
                        <td>{r.invoice_date}</td>
                        <td className="num">{r.bills}</td>
                        <td className="num">{fmt(r.sales)}</td>
                        <td className={'num' + (r.returns > 0 ? ' neg' : '')}>
                          {r.returns > 0 ? `(${fmt(r.returns)})` : '—'}
                        </td>
                        <td className="num strong">{fmt(r.net_sales)}</td>
                        <td className="num">{fmt(r.discount)}</td>
                        <td className="num">{fmt(r.received)}</td>
                        {/* amount + how many bills of that type */}
                        <td className="num">
                          {fmt(r.cash)} <span className="muted-text">({r.cash_bills || 0})</span>
                        </td>
                        <td className="num">
                          {fmt(r.online)}{' '}
                          <span className="muted-text">({r.online_bills || 0})</span>
                        </td>
                        <td className="num">
                          {fmt(r.credit)}{' '}
                          <span className="muted-text">({r.credit_bills || 0})</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="report-cards"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
          >
            {typeCard(
              payType ? `Invoices (${payType})` : 'All Invoices',
              it?.amount,
              it?.count,
              ''
            )}
            {typeCard('Cash', it?.cash?.amount, it?.cash?.count, 'cash')}
            {typeCard('Online', it?.online?.amount, it?.online?.count, 'online')}
            {typeCard('Credit', it?.credit?.amount, it?.credit?.count, 'credit', ' amber')}
          </div>
          <div className="report-bar" style={{ marginTop: 0 }}>
            <div className="po-tabs">
              {TYPES.map(([k, label]) => (
                <button
                  key={k || 'all'}
                  type="button"
                  className={'po-tab' + (payType === k ? ' active' : '')}
                  onClick={() => setPayType(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="search-box">
              <Icon name="search" size={15} />
              <input
                ref={searchRef}
                placeholder="Invoice # / customer / code / >1000 / 500-2000  (F2)"
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
          </div>
          <div className="panel report-table-wrap sr-wrap">
            {/* Row count + group controls */}
            <div className="sr-count">
              <span>
                Showing <strong>{pg.from}–{pg.to}</strong> of <strong>{pg.total}</strong>{' '}
                invoices · <strong>{fmt(allTotals.amount)}</strong>
              </span>
              {stats.size > 0 && (
                <button
                  type="button"
                  className="btn-sm ghost sr-noprint"
                  onClick={allOpen ? collapseAll : expandAll}
                >
                  {allOpen ? 'Collapse All' : 'Expand All'}
                </button>
              )}
            </div>
            <div className="table-scroll">
              <table className="data-table sr-table">
                <thead>
                  <tr>
                    {sortHead('invoice', 'Invoice')}
                    {sortHead('date', 'Date')}
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Salesman</th>
                    <th>Type</th>
                    {sortHead('amount', 'Amount', 'num')}
                    <th className="num">Received</th>
                    {sortHead('due', 'Due', 'num')}
                    <th className="num">Returned</th>
                    <th className="num sr-noprint">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.rows.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="empty">
                        No invoices in this period
                      </td>
                    </tr>
                  ) : (
                    pageGroups.map((g) => {
                      const open = expanded.has(g.key)
                      return [
                        // Day (or month) header: whole-group count + total; click to open/close
                        <tr key={'g-' + g.key} className="sr-group">
                          <td colSpan="11">
                            <button
                              type="button"
                              className="sr-group-btn"
                              onClick={() => toggleGroup(g.key)}
                              aria-expanded={open}
                            >
                              <span className="sr-caret">{open ? '▼' : '▶'}</span>
                              <strong>{g.label}</strong>
                              <span>· {g.count} invoices</span>
                              <span>· {fmt(g.amount)}</span>
                              {g.rows.length < g.count && (
                                <em>({g.rows.length} on this page)</em>
                              )}
                            </button>
                          </td>
                        </tr>,
                        ...(open
                          ? g.rows.map((r) => (
                              <tr key={r.id}>
                                <td className="strong">#{r.invoice_no}</td>
                                <td>{r.invoice_date}</td>
                                <td>
                                  {r.invoice_time ? String(r.invoice_time).slice(0, 5) : '—'}
                                </td>
                                <td>
                                  {r.customer}{' '}
                                  <span className="muted-text" style={{ fontSize: 11 }}>
                                    {r.customer_code}
                                  </span>
                                </td>
                                <td>{r.salesman || '—'}</td>
                                <td>
                                  <span
                                    className="po-badge received"
                                    style={{ textTransform: 'capitalize' }}
                                  >
                                    {r.payment_type}
                                  </span>
                                </td>
                                <td className="num strong">{fmt(r.net_total)}</td>
                                <td className="num">{fmt(r.amount_received)}</td>
                                <td className={'num' + (r.outstanding > 0 ? ' neg' : '')}>
                                  {r.outstanding > 0 ? fmt(r.outstanding) : '—'}
                                </td>
                                <td className={'num' + (r.returned > 0 ? ' neg' : '')}>
                                  {r.returned > 0 ? `(${fmt(r.returned)})` : '—'}
                                </td>
                                <td className="num sr-noprint">
                                  <div className="table-actions">
                                    <button
                                      className="icon-btn"
                                      title="Print this invoice"
                                      onClick={() => setReprintId(r.id)}
                                    >
                                      <Icon name="printer" size={16} />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      title="Open / edit this invoice"
                                      onClick={() => setEditId(r.id)}
                                    >
                                      <Icon name="edit" size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          : [])
                      ]
                    })
                  )}
                </tbody>
                {inv.rows.length > 0 && (
                  // Pinned to the bottom of the table area while the rows scroll
                  <tfoot className="sr-foot">
                    <tr className="sr-foot-page">
                      <td colSpan="6" className="num">
                        Page total ({pg.pageRows.length})
                      </td>
                      <td className="num strong">{fmt(pageTotals.amount)}</td>
                      <td className="num">{fmt(pageTotals.received)}</td>
                      <td className="num">{fmt(pageTotals.due)}</td>
                      <td colSpan="2" />
                    </tr>
                    <tr className="sr-foot-all">
                      <td colSpan="6" className="num strong">
                        All {allTotals.count} invoices
                      </td>
                      <td className="num strong">{fmt(allTotals.amount)}</td>
                      <td className="num strong">{fmt(allTotals.received)}</td>
                      <td className="num strong">{fmt(allTotals.due)}</td>
                      <td colSpan="2" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination — stays under the table (bottom of the screen) */}
            <div className="sr-pager sr-noprint">
              <label className="sr-size">
                Rows per page{' '}
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
              </label>
              <div className="sr-pages">
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => goPage(pg.page - 1)}
                  disabled={pg.page <= 1}
                  title="Previous page (Alt+←)"
                >
                  ‹ Prev
                </button>
                {pageButtons(pg.page, pg.pageCount).map((n, i) =>
                  n === '…' ? (
                    <span key={'e' + i} className="sr-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      className={'btn-sm ' + (n === pg.page ? 'primary' : 'ghost')}
                      onClick={() => goPage(n)}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => goPage(pg.page + 1)}
                  disabled={pg.page >= pg.pageCount}
                  title="Next page (Alt+→)"
                >
                  Next ›
                </button>
              </div>
              <span className="sr-pageof">
                Page {pg.page} of {pg.pageCount}
              </span>
            </div>
          </div>
        </>
      )}

      {reprintId && (
        <InvoiceReceipt saleId={reprintId} onClose={() => setReprintId(null)} autoPrint />
      )}
      {editId && (
        <SaleEditor saleId={editId} onClose={() => setEditId(null)} onSaved={() => load()} />
      )}

      {/* 📍 PIN — hint strip */}
      <div className="hotkey-hint">
        <span>
          <kbd>F5</kbd> Refresh
        </span>
        <span>
          <kbd>F2</kbd> Search invoices
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>I</kbd> Summary / Invoices
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
