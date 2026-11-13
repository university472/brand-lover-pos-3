import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
import DatePresets from '../components/DatePresets.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'
import { localToday, toLocalDateStr } from '../utils/date.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
const fmt2 = (n) =>
  'Rs. ' +
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
const num = (n) => Number(n || 0).toLocaleString('en-PK')

export default function PurchasesByProductReport() {
  const { session } = useAuth()
  const uid = session.id
  const ms = new Date()
  ms.setDate(1)

  const [from, setFrom] = useState(toLocalDateStr(ms))
  const [to, setTo] = useState(localToday())
  const [search, setSearch] = useState('')
  const [data, setData] = useState({ rows: [], totals: null })
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const searchRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  const load = useCallback(async () => {
    setError('')
    try {
      setData(
        await reportsApi.purchasesByProduct({
          actingUserId: uid,
          from,
          to,
          search
        })
      )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to, search])
  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (row) => {
    setError('')
    try {
      setDetail(
        await reportsApi.purchasesByProductDetail({
          actingUserId: uid,
          itemId: row.item_id,
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
      const r = await reportsApi.exportReport({
        actingUserId: uid,
        reportType: 'purchasesByProduct',
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

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f5: () => {
        if (!busy) load()
      },
      f9: () => printNow(),
      e: () => {
        if (!busy) exportXlsx()
      },
      p: () => printNow(),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus(),
      escape: () => {
        if (detail) setDetail(null)
      }
    },
    [busy, from, to, search, detail]
  )

  const t = data.totals

  return (
    <div className="report-page pl-report-page">
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
              placeholder="Search item name / code  (F2)"
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
          <span>Products</span>
          <strong>{t?.items || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Bills</span>
          <strong>{t?.bills || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Qty Purchased</span>
          <strong>{num(t?.qty_purchased)}</strong>
        </div>
        <div className="rc-card">
          <span>Qty Returned</span>
          <strong>{num(t?.qty_returned)}</strong>
        </div>
        <div className="rc-card">
          <span>Qty Net</span>
          <strong>{num(t?.qty_net)}</strong>
        </div>
        <div className="rc-card">
          <span>Gross Amount</span>
          <strong>{fmt(t?.gross_amount)}</strong>
        </div>
        <div className="rc-card">
          <span>Returned Value</span>
          <strong>{fmt(t?.amount_returned)}</strong>
        </div>
        <div className="rc-card amber">
          <span>Net Amount</span>
          <strong>{fmt(t?.net_amount)}</strong>
        </div>
      </div>

      <div className="panel report-table-wrap pl-table-wrap">
        {/* Small count strip so the user knows how many rows are below */}
        <div className="pl-count">
          <span>
            <strong>{data.rows.length}</strong> product
            {data.rows.length === 1 ? '' : 's'} ·{' '}
            <strong>{fmt(t?.net_amount)}</strong> net
          </span>
          {busy && <span className="muted-text">Working…</span>}
        </div>
        <div className="table-scroll">
          <table className="data-table pl-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Size</th>
                <th>Unit</th>
                <th className="num">Bills</th>
                <th className="num">Qty Purchased</th>
                <th className="num">Qty Returned</th>
                <th className="num">Qty Net</th>
                <th className="num">Gross Amount</th>
                <th className="num">Returned</th>
                <th className="num">Net Amount</th>
                <th className="num">Avg Rate</th>
                <th>First</th>
                <th>Last</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="15" className="empty">
                    No purchases in this period
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr
                    key={r.item_id}
                    className="clickable"
                    onClick={() => openDetail(r)}
                  >
                    <td>{r.item_code}</td>
                    <td>{r.name}</td>
                    <td>{r.size || '—'}</td>
                    <td>{r.unit || '—'}</td>
                    <td className="num">{r.bill_count}</td>
                    <td className="num">{num(r.qty_purchased)}</td>
                    <td className={'num' + (r.qty_returned > 0 ? ' neg' : '')}>
                      {r.qty_returned > 0 ? `(${num(r.qty_returned)})` : '—'}
                    </td>
                    <td className="num strong">{num(r.qty_net)}</td>
                    <td className="num">{fmt(r.gross_amount)}</td>
                    <td
                      className={'num' + (r.amount_returned > 0 ? ' neg' : '')}
                    >
                      {r.amount_returned > 0
                        ? `(${fmt(r.amount_returned)})`
                        : '—'}
                    </td>
                    <td className="num strong">{fmt(r.net_amount)}</td>
                    <td className="num">{fmt2(r.avg_rate)}</td>
                    <td>{r.first_purchase}</td>
                    <td>{r.last_purchase}</td>
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
          <kbd>Alt</kbd>+<kbd>1/2</kbd> Date focus
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>

      {detail && (
        <Modal
          title={`Purchases — ${detail.item.name}`}
          width={950}
          onClose={() => setDetail(null)}
          footer={
            <button className="btn-primary" onClick={() => setDetail(null)}>
              Close
            </button>
          }
        >
          <div
            className="rd-balance"
            style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}
          >
            <span>
              Code: <strong>{detail.item.item_code}</strong>
            </span>
            <span>
              Purchase price now:{' '}
              <strong>{fmt2(detail.item.purchase_price)}</strong>
            </span>
            <span>
              Selling price now:{' '}
              <strong>{fmt2(detail.item.selling_price)}</strong>
            </span>
            <span>
              Stock now: <strong>{num(detail.item.current_stock)}</strong>
            </span>
          </div>

          <h4 className="cd-sub">Purchase Bills ({detail.bills.length})</h4>
          <div className="rd-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Vendor Bill #</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  <th className="num">GST</th>
                  <th className="num">Incl. Tax</th>
                </tr>
              </thead>
              <tbody>
                {detail.bills.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty">
                      No purchase bills in range
                    </td>
                  </tr>
                ) : (
                  detail.bills.map((b) => (
                    <tr key={b.bill_id}>
                      <td className="strong">{b.serial_no}</td>
                      <td>{b.order_date}</td>
                      <td>{b.vendor || '—'}</td>
                      <td>{b.vendor_bill_no || '—'}</td>
                      <td className="num">{num(b.quantity)}</td>
                      <td className="num">{fmt2(b.rate)}</td>
                      <td className="num">{fmt2(b.amount)}</td>
                      <td className="num">{fmt2(b.gst_amount)}</td>
                      <td className="num strong">{fmt2(b.value_incl_tax)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h4 className="cd-sub">
            Returns to Vendor ({detail.returns.length})
          </h4>
          <div className="rd-scroll short">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return #</th>
                  <th>Date</th>
                  <th>Original Bill</th>
                  <th>Vendor</th>
                  <th>Settlement</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.returns.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty">
                      No returns in range
                    </td>
                  </tr>
                ) : (
                  detail.returns.map((r) => (
                    <tr key={r.return_id}>
                      <td>{r.return_no}</td>
                      <td>{r.return_date}</td>
                      <td>{r.original_bill_no || '—'}</td>
                      <td>{r.vendor || '—'}</td>
                      <td>{r.settlement || '—'}</td>
                      <td className="num">{num(r.quantity)}</td>
                      <td className="num">{fmt2(r.rate)}</td>
                      <td className="num neg">-{fmt2(r.amount)}</td>
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
