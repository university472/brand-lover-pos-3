import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { inventoryApi } from '../api/ipc.js'
import Icon from '../components/Icons.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js' // 📍 PIN
import { printNow } from '../utils/print.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
const fmtCost = (n) =>
  'Rs. ' +
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export default function LowStock() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await inventoryApi.items.lowStock()
      setRows(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 📍 PIN — hotkeys
  useHotkeys(
    {
      f5: () => load(),
      f9: () => printNow(),
      p: () => printNow(),
      i: () => navigate('/inventory'),
      escape: () => {} // nothing to close here
    },
    []
  )

  return (
    <div className="lowstock-page">
      <div className="ls-head">
        <h3 className="sale-title">
          <Icon name="alert" size={18} /> Low Stock Alerts
        </h3>
        <button
          className="btn-sm ghost"
          onClick={() => navigate('/inventory')}
          title="Open Inventory (Ctrl+I)"
        >
          <Icon name="package" size={15} /> Open Inventory
        </button>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="panel ls-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Category</th>
                <th className="num">In Stock</th>
                <th className="num">Alert At</th>
                <th className="num">Short By</th>
                <th className="num">Avg Cost</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    All products are above their low-stock threshold 🎉
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const out = Number(r.current_stock) <= 0
                  const shortBy = Math.max(
                    0,
                    Number(r.threshold) - Number(r.current_stock)
                  )
                  return (
                    <tr key={r.id}>
                      <td>{r.item_code}</td>
                      <td>{r.name}</td>
                      <td>{r.category || '—'}</td>
                      <td className="num">
                        <span className={'stock-pill ' + (out ? 'out' : 'low')}>
                          {Number(r.current_stock).toLocaleString('en-PK')}{' '}
                          {r.unit}
                        </span>
                      </td>
                      <td className="num">
                        {Number(r.threshold).toLocaleString('en-PK')}
                      </td>
                      <td className="num strong neg">
                        {shortBy.toLocaleString('en-PK')}
                      </td>
                      <td className="num">{fmtCost(r.average_cost)}</td>
                      <td className="num">{fmt(r.stock_value)}</td>
                    </tr>
                  )
                })
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
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>I</kbd> Inventory
        </span>
      </div>
    </div>
  )
}
