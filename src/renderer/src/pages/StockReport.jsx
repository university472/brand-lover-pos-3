import { useEffect, useState, useCallback, useRef } from 'react'
import { reportsApi, inventoryApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import ReportTabs from '../components/ReportTabs.jsx'
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

export default function StockReport() {
  const { session } = useAuth()
  const uid = session.id
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState([])
  const [data, setData] = useState({ rows: [], totals: null })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const searchRef = useRef(null) // 📍
  const categoryRef = useRef(null) // 📍

  useEffect(() => {
    inventoryApi.categories
      .list()
      .then(setCategories)
      .catch((e) => setError(e.message))
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      setData(
        await reportsApi.stockValuation({
          actingUserId: uid,
          search,
          categoryId: categoryId ? Number(categoryId) : null
        })
      )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, search, categoryId])

  useEffect(() => {
    load()
  }, [load])

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await reportsApi.exportReport({
        actingUserId: uid,
        reportType: 'stock',
        search,
        categoryId: categoryId ? Number(categoryId) : null
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

  // 📍 PIN — hotkeys
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
      'alt+1': () => categoryRef.current?.focus()
    },
    [busy, search, categoryId]
  )

  return (
    <div className="report-page">
      <ReportTabs />
      <div className="report-bar">
        <div className="rb-dates">
          <select
            ref={categoryRef}
            className="role-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            title="Filter by category (Alt+1)"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="search-box">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder="Search name / code  (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
          <span>Products</span>
          <strong>{t?.items || 0}</strong>
        </div>
        <div className="rc-card">
          <span>Total Units</span>
          <strong>{Number(t?.qty || 0).toLocaleString('en-PK')}</strong>
        </div>
        <div className="rc-card">
          <span>Stock Value</span>
          <strong>{fmt(t?.value)}</strong>
        </div>
        <div className="rc-card amber">
          <span>Low Stock</span>
          <strong>{t?.low || 0}</strong>
        </div>
      </div>
      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Size</th>
                <th>Category</th>
                <th className="num">Stock</th>
                <th className="num">Purchase</th>
                <th className="num">Selling</th>
                <th className="num">Avg Cost</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty">
                    No products
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => {
                  const low =
                    Number(r.threshold) > 0 &&
                    Number(r.current_stock) <= Number(r.threshold)
                  return (
                    <tr key={r.item_code}>
                      <td>{r.item_code}</td>
                      <td>{r.name}</td>
                      <td>{r.size || '—'}</td>
                      <td>{r.category || '—'}</td>
                      <td className="num">
                        <span className={'stock-pill' + (low ? ' low' : '')}>
                          {Number(r.current_stock).toLocaleString('en-PK')}
                        </span>
                      </td>
                      <td className="num">{fmtCost(r.purchase_price)}</td>
                      <td className="num">{fmtCost(r.selling_price)}</td>
                      <td className="num">{fmtCost(r.average_cost)}</td>
                      <td className="num strong">{fmt(r.value)}</td>
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
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1</kbd> Category
        </span>
      </div>
    </div>
  )
}
