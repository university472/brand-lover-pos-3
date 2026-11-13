import { useState, useEffect, useCallback, useRef } from 'react'
import { salesApi } from '../api/ipc.js'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import SaleEditor from '../components/SaleEditor.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js' // 📍 PIN #1 — print helper import

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })

export default function CustomerHistory() {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [summary, setSummary] = useState(null)
  const [sales, setSales] = useState([])
  const [saleDetail, setSaleDetail] = useState(null)
  const [editId, setEditId] = useState(null) // bill open in the shared editor
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const searchRef = useRef(null)

  const searchCustomers = useCallback(async (term) => {
    if (!term.trim()) return
    setBusy(true)
    try {
      const results = await salesApi.searchCustomers({ term })
      setSearchResults(results)
      setShowResults(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) searchCustomers(searchTerm)
      else {
        setSearchResults([])
        setShowResults(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, searchCustomers])

  const selectCustomer = async (cust) => {
    setSelectedCustomer(cust)
    setSearchTerm('')
    setShowResults(false)
    setBusy(true)
    try {
      const [sum, list] = await Promise.all([
        salesApi.customerSummary({ customerId: cust.id }),
        salesApi.list({ customerId: cust.id, limit: 200 })
      ])
      setSummary(sum)
      setSales(list)
      setSaleDetail(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openSaleDetail = async (saleId) => {
    setBusy(true)
    try {
      const detail = await salesApi.get({ id: saleId })
      setSaleDetail(detail)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f9: () => printNow(), // 📍 PIN #2 — F9: window.print() → printNow()
      p: () => printNow(), // 📍 PIN #3 — Ctrl+P: window.print() → printNow()
      escape: () => {
        if (saleDetail) setSaleDetail(null)
        else if (showResults) setShowResults(false)
      }
    },
    [saleDetail, showResults]
  )

  return (
    <div className="history-layout">
      <div className="history-search panel">
        <h3>
          <Icon name="history" size={18} /> Customer Purchase History
        </h3>
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            ref={searchRef}
            placeholder="Search customer by code or name...  (F2)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        {showResults && (
          <div
            className="search-results"
            style={{ position: 'static', marginTop: 8 }}
          >
            {searchResults.map((c) => (
              <div
                key={c.id}
                className="sr-row"
                onClick={() => selectCustomer(c)}
              >
                <span className="sr-code">{c.code}</span>
                <span className="sr-name">{c.name}</span>
                {c.telephone && <span className="sr-phone">{c.telephone}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCustomer && summary && (
        <div className="history-main">
          <div className="customer-card panel">
            <div className="customer-info">
              <h4>{selectedCustomer.name}</h4>
              <p>
                <strong>Code:</strong> {selectedCustomer.code}
              </p>
              <p>
                <strong>Telephone:</strong>{' '}
                {selectedCustomer.telephone || 'N/A'}
              </p>
            </div>
            <div className="summary-stats">
              <div className="stat">
                <span>Total Purchases</span>
                <strong>{fmt(summary.total_purchases)}</strong>
              </div>
              {Number(summary.total_returns) > 0 && (
                <div className="stat">
                  <span>Returns</span>
                  <strong>{fmt(summary.total_returns)}</strong>
                </div>
              )}
              <div className="stat">
                <span>Total Paid</span>
                <strong>{fmt(summary.total_paid)}</strong>
              </div>
              <div className="stat">
                <span>{Number(summary.total_due) < 0 ? 'We owe customer' : 'Total Due'}</span>
                <strong>
                  {fmt(Math.abs(Number(summary.total_due) || 0))}
                  {Number(summary.total_due) < 0 ? ' (payable)' : ''}
                </strong>
              </div>
            </div>
          </div>

          <div className="sales-list panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill No</th>
                  <th>Salesman</th>
                  <th>Due Date</th>
                  <th className="num">Net Total</th>
                  <th className="num">Received</th>
                  <th className="num">Cash Back</th>
                  <th className="num">Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty">
                      No sales found
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id}>
                      <td>{s.invoice_date}</td>
                      <td>
                        {s.invoice_no}
                        {Number(s.return_count) > 0 && (
                          <span className="low-tag">returned</span>
                        )}
                      </td>
                      {/* ✅ Phase A3 — salesman column */}
                      <td>{s.salesman || '—'}</td>
                      {/* ✅ Phase A6 */}
                      <td>
                        {s.due_date ? (
                          <span className={s.is_overdue ? 'due-overdue' : ''}>
                            {s.due_date}
                            {s.is_overdue ? ' ⚠' : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">{fmt(s.net_total)}</td>
                      <td className="num">{fmt(s.amount_received)}</td>
                      <td className="num">
                        {fmt(Math.max(0, s.amount_received - s.net_total))}
                      </td>
                      <td className="num">
                        {/* credit bills: what is REALLY still unpaid after repayments and returns */}
                        {fmt(
                          s.payment_type === 'credit'
                            ? Number(s.remaining_due) || 0
                            : Math.max(0, s.net_total - s.amount_received)
                        )}
                      </td>
                      <td className="num">
                        <button
                          className="btn-icon"
                          onClick={() => openSaleDetail(s.id)}
                          title="View details"
                        >
                          <Icon name="edit" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="login-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <div className="hotkey-hint">
        <span>
          <kbd>F2</kbd> Search
        </span>
        <span>
          <kbd>F9</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>

      {saleDetail && (
        <Modal
          title={`Bill #${saleDetail.invoice_no}`}
          width={700}
          onClose={() => setSaleDetail(null)}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => setSaleDetail(null)}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setEditId(saleDetail.id)
                  setSaleDetail(null)
                }}
                title="Edit, save & print this bill (← → for previous / next)"
              >
                <Icon name="edit" size={16} /> Edit / Print
              </button>
            </>
          }
        >
          <div className="sale-detail">
            <div className="detail-meta">
              <p>
                <strong>Customer:</strong> {saleDetail.customer} (
                {saleDetail.customer_code})
              </p>
              <p>
                <strong>Date:</strong> {saleDetail.invoice_date}{' '}
                {saleDetail.invoice_time}
              </p>
              {saleDetail.due_date && (
                <p>
                  <strong>Promise to pay by:</strong>{' '}
                  <span className={saleDetail.is_overdue ? 'due-overdue' : ''}>
                    {saleDetail.due_date}
                    {saleDetail.is_overdue ? ' — OVERDUE' : ''}
                  </span>
                </p>
              )}
              {/* ✅ Phase A3 — Salesman shown separately from created_by */}
              <p>
                <strong>Salesman:</strong> {saleDetail.salesman || '—'}
              </p>
              <p>
                <strong>Created By:</strong>{' '}
                {saleDetail.created_by_name || 'Unknown'}
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Disc %</th>
                  <th className="num">Disc Amt</th>
                  <th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                {saleDetail.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.description}</td>
                    <td className="num">{it.quantity}</td>
                    <td className="num">{fmt(it.rate)}</td>
                    <td className="num">{it.discount_percent}</td>
                    <td className="num">{fmt(it.discount_amount)}</td>
                    <td className="num">{fmt(it.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="detail-totals">
              <div>
                <span>Sub Total:</span>
                <strong>{fmt(saleDetail.sub_total)}</strong>
              </div>
              <div>
                <span>Total Discount:</span>
                <strong>{fmt(saleDetail.discount)}</strong>
              </div>
              <div>
                <span>Net Total:</span>
                <strong>{fmt(saleDetail.net_total)}</strong>
              </div>
              <div>
                <span>Received:</span>
                <strong>{fmt(saleDetail.amount_received)}</strong>
              </div>
              <div>
                <span>Cash Back:</span>
                <strong>
                  {fmt(
                    Math.max(
                      0,
                      saleDetail.amount_received - saleDetail.net_total
                    )
                  )}
                </strong>
              </div>
              <div>
                <span>Due:</span>
                <strong>
                  {fmt(
                    saleDetail.payment_type === 'credit'
                      ? Number(saleDetail.remaining_due) || 0
                      : Math.max(0, saleDetail.net_total - saleDetail.amount_received)
                  )}
                </strong>
              </div>
            </div>
            {saleDetail.returns?.length > 0 && (
              <div className="cust-card bad" style={{ marginTop: 14 }}>
                <p style={{ margin: 0 }}>
                  <strong>Returns on this bill</strong>
                </p>
                {saleDetail.returns.map((r) => (
                  <div key={r.id} style={{ marginTop: 10, fontSize: 13 }}>
                    <div className="cc-row">
                      <span>
                        {r.return_no} · {r.return_date}
                      </span>
                      <strong>{fmt(r.total_amount)}</strong>
                    </div>
                    <div className="cc-row">
                      <span>Refund</span>
                      <span>
                        {r.refund_mode === 'credit_adjust'
                          ? 'Credit reduced'
                          : r.account_name || '—'}
                      </span>
                    </div>
                    {r.items?.length > 0 && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {r.items.map((it, i) => (
                          <li key={i}>
                            {it.itemCode ? `${it.itemCode} · ` : ''}
                            {it.name} × {it.quantity} — {fmt(it.amount)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {editId && (
        <SaleEditor
          saleId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => selectedCustomer && selectCustomer(selectedCustomer)}
        />
      )}
    </div>
  )
}
