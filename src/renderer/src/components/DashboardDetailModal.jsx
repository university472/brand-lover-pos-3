import { useEffect, useState } from 'react'
import { dashboardApi } from '../api/ipc.js'
import Modal from './Modal.jsx'
import Icon from './Icons.jsx'
import InvoiceReceipt from './InvoiceReceipt.jsx'
import SaleEditor from './SaleEditor.jsx'
import AccountLedger from './AccountLedger.jsx'
import { printNow } from '../utils/print.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })

// `from`/`to` = the Dashboard's range, so the list matches the card total.
// `date` is still accepted for single-day callers (CreditBook).
// `onChanged` — an invoice was edited/cancelled from this list → caller refreshes its cards.
export default function DashboardDetailModal({
  type,
  date,
  from,
  to,
  uid,
  onClose,
  onChanged
}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [reprintId, setReprintId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [ledgerCustomerId, setLedgerCustomerId] = useState(null)
  const [tab, setTab] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setError('')
    setData(null)
    setTab(0) // Sales card always opens on "Sales Invoices"
    dashboardApi
      .detail({ type, date, from, to })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [type, date, from, to])

  // After an edit: refresh the list in place (keep the open tab), and the caller's cards.
  useEffect(() => {
    if (!reloadKey) return
    dashboardApi
      .detail({ type, date, from, to })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const printIt = () => printNow('print-detail')

  // Sales card returns { tabs: [...] } (Sales Invoices / Payment Receipts, kept apart);
  // every other card returns a single table.
  const view = data?.tabs ? data.tabs[tab] : data

  const cell = (r, c) => {
    let v = r[c.key]
    if (c.money) {
      const cls = c.signed
        ? Number(v) < 0
          ? 'neg'
          : 'pos'
        : c.danger && Number(v) > 0
          ? 'neg'
          : ''
      return <span className={cls}>{fmt(v)}</span>
    }
    if (c.badge)
      return (
        <span
          className="po-badge received"
          style={{ textTransform: 'capitalize' }}
        >
          {v || '—'}
        </span>
      )
    return (c.prefix || '') + (v ?? '—')
  }

  const extraCols = view
    ? (view.rowInvoice ? 1 : 0) + (view.rowCustomer ? 1 : 0)
    : 0
  // Put the total under the column flagged `sum`; fall back to the last column (old layout).
  const sumIdx = view ? view.columns.findIndex((c) => c.sum) : -1

  return (
    <Modal
      title={data?.title || 'Details'}
      width={760}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={printIt}>
            <Icon name="printer" size={16} /> Print
          </button>
        </>
      }
    >
      {error && <div className="login-error">{error}</div>}
      {!data && !error && <p className="muted-text">Loading…</p>}
      {view && (
        // Everything inside #dash-detail-print is printed: header, the Gross/Returns/Net
        // block (it used to sit outside and was missing from the printout) and the table.
        // The tab buttons are hidden on paper; the printed tab's name is in the header.
        <div id="dash-detail-print">
          <div className="detail-print-head">
            <h2>Brand Lover Family Store</h2>
            <p>
              {data.title}
              {data.tabs ? ` — ${view.label}` : ''}
            </p>
          </div>
          {/* Gross → Returns → Net, so the tab totals (gross) are never mistaken for the
              Sales card (net). */}
          {/* Sum block on top: how the card's number is made (e.g. Gross − Returns −
              Paid to vendors = Sales card; Cash sales − Paid to vendors = Cash in Hand). */}
          {(data.summaryLines || data.summary) && (
            <div className="detail-summary">
              {(
                data.summaryLines || [
                  { label: 'Gross Sales', amount: data.summary.gross },
                  {
                    label: 'Less: Returns',
                    amount: data.summary.returns,
                    minus: true
                  },
                  { label: 'Net Sales', amount: data.summary.net, total: true }
                ]
              ).map((l) => (
                <div
                  key={l.label}
                  className={'recon-line' + (l.total ? ' total' : '')}
                >
                  <span>{l.label}</span>
                  <strong className={l.minus && l.amount > 0 ? 'neg' : ''}>
                    {l.minus ? '−' : ''}
                    {fmt(l.amount)}
                    {l.total && (
                      <>
                        {' '}
                        <span className="pos">✓</span>{' '}
                        <span
                          className="muted-text"
                          style={{ fontSize: 11, fontWeight: 400 }}
                        >
                          (matches the card)
                        </span>
                      </>
                    )}
                  </strong>
                </div>
              ))}
              {data.summary?.recoveries > 0 && (
                <div className="recon-line muted-text" style={{ fontSize: 12 }}>
                  <span>Credit recoveries (not in Sales)</span>
                  <span>{fmt(data.summary.recoveries)}</span>
                </div>
              )}
              {data.summaryNote && (
                <p className="detail-note">{data.summaryNote}</p>
              )}
            </div>
          )}
          {data.tabs && (
            <div className="po-tabs detail-tabs">
              {data.tabs.map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  className={'po-tab' + (i === tab ? ' active' : '')}
                  onClick={() => setTab(i)}
                >
                  {t.label} ({t.rows.length})
                </button>
              ))}
            </div>
          )}
          {view.note && <p className="detail-note">{view.note}</p>}
          <div className="table-scroll" style={{ maxHeight: 420 }}>
            <table className="data-table">
              <thead>
                <tr>
                  {view.columns.map((c) => (
                    <th key={c.key} className={c.money ? 'num' : ''}>
                      {c.label}
                    </th>
                  ))}
                  {view.rowInvoice && <th className="num">Invoice</th>}
                  {view.rowCustomer && <th className="num">Ledger</th>}
                </tr>
              </thead>
              <tbody>
                {view.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={view.columns.length + extraCols}
                      className="empty"
                    >
                      Nothing to show
                    </td>
                  </tr>
                ) : (
                  view.rows.map((r, i) => (
                    <tr key={i}>
                      {view.columns.map((c) => (
                        <td key={c.key} className={c.money ? 'num' : ''}>
                          {cell(r, c)}
                        </td>
                      ))}
                      {view.rowInvoice && (
                        <td className="num">
                          <div className="table-actions">
                            <button
                              className="icon-btn"
                              title="Print this invoice"
                              onClick={(e) => {
                                e.stopPropagation()
                                setReprintId(r[view.rowInvoice])
                              }}
                            >
                              <Icon name="printer" size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              title="Open / edit this invoice (save & print, ← → for previous / next)"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditId(r[view.rowInvoice])
                              }}
                            >
                              <Icon name="edit" size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                      {view.rowCustomer && (
                        <td className="num">
                          <button
                            className="icon-btn"
                            title="Open customer ledger"
                            onClick={(e) => {
                              e.stopPropagation()
                              setLedgerCustomerId(r[view.rowCustomer])
                            }}
                          >
                            <Icon name="book" size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {view.rows.length > 0 && view.total !== undefined && (
                <tfoot>
                  {sumIdx >= 0 ? (
                    <tr>
                      {view.columns.map((c, i) => (
                        <td key={c.key} className="num strong">
                          {i === sumIdx
                            ? fmt(view.total)
                            : i === sumIdx - 1
                              ? 'Total'
                              : ''}
                        </td>
                      ))}
                      {extraCols > 0 && <td colSpan={extraCols} />}
                    </tr>
                  ) : (
                    <tr>
                      <td
                        colSpan={view.columns.length - 1}
                        className="num strong"
                      >
                        Total
                      </td>
                      <td className="num strong">{fmt(view.total)}</td>
                      {view.rowInvoice && <td />}
                      {view.rowCustomer && <td />}
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
      {reprintId && (
        <InvoiceReceipt
          saleId={reprintId}
          onClose={() => setReprintId(null)}
          autoPrint
        />
      )}
      {editId && (
        <SaleEditor
          saleId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setReloadKey((k) => k + 1)
            onChanged?.()
          }}
        />
      )}
      {ledgerCustomerId && (
        <AccountLedger
          customerId={ledgerCustomerId}
          uid={uid}
          onClose={() => setLedgerCustomerId(null)}
        />
      )}
    </Modal>
  )
}
