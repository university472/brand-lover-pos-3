import { useEffect, useState } from 'react'
import { inventoryApi } from '../api/ipc.js'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import DatePresets from '../components/DatePresets.jsx'
import { notifyStockChanged } from '../utils/lowStock.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
const fmt2 = (n) =>
  'Rs. ' +
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
const num = (n) => Number(n || 0).toLocaleString('en-PK')

const TYPE_LABEL = {
  opening: 'Opening',
  purchase: 'Purchase',
  sale: 'Sale',
  sale_return: 'Sale Return',
  sale_edit_reversal: 'Edit / Cancel',
  purchase_return: 'Return to Vendor',
  adjustment: 'Adjustment'
}
const TYPE_CLASS = {
  opening: 'received',
  purchase: 'received',
  sale: 'ordered',
  sale_return: 'received',
  sale_edit_reversal: 'cancelled',
  purchase_return: 'cancelled',
  adjustment: ''
}

export default function ProductHistoryModal({
  itemId: initialItemId = null,
  onClose,
  allowEdit = true,
  onSaved
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selectedId, setSelectedId] = useState(initialItemId)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showOnly, setShowOnly] = useState('all')

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    newStock: '',
    purchasePrice: '',
    sellingPrice: ''
  })
  const [editError, setEditError] = useState('')

  // Debounced search when nothing is selected yet
  useEffect(() => {
    if (selectedId) return
    const term = search.trim()
    if (!term) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const list = await inventoryApi.items.list({ search: term })
        setResults(list.slice(0, 20))
      } catch (e) {
        setError(e.message)
      }
    }, 180)
    return () => clearTimeout(t)
  }, [search, selectedId])

  // Load the history whenever the item or the range changes
  useEffect(() => {
    if (!selectedId) return
    let live = true
    ;(async () => {
      setError('')
      try {
        const d = await inventoryApi.items.history({ id: selectedId, from, to })
        if (!live) return
        setData(d)
        setEditForm({
          newStock: String(d.item.current_stock ?? ''),
          purchasePrice: String(d.item.purchase_price ?? ''),
          sellingPrice: String(d.item.selling_price ?? '')
        })
      } catch (e) {
        if (live) setError(e.message)
      }
    })()
    return () => {
      live = false
    }
  }, [selectedId, from, to])

  const saveEdit = async () => {
    if (busy) return
    setBusy(true)
    setEditError('')
    try {
      const res = await inventoryApi.items.updateStockPrices({
        id: selectedId,
        newStock:
          editForm.newStock === '' ? undefined : Number(editForm.newStock),
        purchasePrice: Number(editForm.purchasePrice),
        sellingPrice: Number(editForm.sellingPrice)
      })
      if (res.stockChanged) notifyStockChanged()
      setEditOpen(false)
      // Reload so the movement list shows the fresh adjustment row
      const d = await inventoryApi.items.history({ id: selectedId, from, to })
      setData(d)
      setEditForm({
        newStock: String(d.item.current_stock ?? ''),
        purchasePrice: String(d.item.purchase_price ?? ''),
        sellingPrice: String(d.item.selling_price ?? '')
      })
      onSaved?.()
    } catch (e) {
      setEditError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const rows = (data?.rows || []).filter((r) => {
    if (showOnly === 'in') return Number(r.quantity_in) > 0
    if (showOnly === 'out') return Number(r.quantity_out) > 0
    return true
  })

  // ────── STAGE 1: item search ──────
  if (!selectedId) {
    return (
      <Modal
        title="Product Stock & Purchase History"
        width={720}
        onClose={onClose}
        footer={
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        }
      >
        {error && <div className="login-error">{error}</div>}
        <label className="field">
          <span>
            Find item <em className="hint-em">(name, code or barcode)</em>
          </span>
          <input
            autoFocus
            value={search}
            placeholder="e.g. Mens Cotton Shirt or 00001"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {search.trim() === '' ? (
          <p className="muted-text" style={{ marginTop: 8 }}>
            Start typing to search.
          </p>
        ) : results.length === 0 ? (
          <p className="muted-text" style={{ marginTop: 8 }}>
            No matching items.
          </p>
        ) : (
          <div
            className="table-scroll"
            style={{ maxHeight: 320, marginTop: 6 }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Size</th>
                  <th className="num">Stock</th>
                  <th className="num">Purchase</th>
                  <th className="num">Selling</th>
                </tr>
              </thead>
              <tbody>
                {results.map((it) => (
                  <tr
                    key={it.id}
                    className="clickable"
                    onClick={() => setSelectedId(it.id)}
                  >
                    <td>{it.item_code}</td>
                    <td>{it.name}</td>
                    <td>{it.size || '—'}</td>
                    <td className="num">
                      {num(it.current_stock)} {it.unit || ''}
                    </td>
                    <td className="num">{fmt(it.purchase_price)}</td>
                    <td className="num">{fmt(it.selling_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    )
  }

  // ────── STAGE 2: history view ──────
  return (
    <Modal
      title={data ? `${data.item.name} — Stock & Purchase History` : 'Loading…'}
      width={1000}
      onClose={onClose}
      footer={
        <>
          {!initialItemId && (
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedId(null)
                setData(null)
                setResults([])
                setSearch('')
              }}
            >
              Change Item
            </button>
          )}
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {error && <div className="login-error">{error}</div>}

      {data && (
        <>
          {/* Header */}
          <div
            className="pv-vcard"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 14,
              alignItems: 'center'
            }}
          >
            <strong>{data.item.name}</strong>
            <span>Code {data.item.item_code}</span>
            {data.item.size && <span>Size {data.item.size}</span>}
            {data.item.unit && <span>Unit {data.item.unit}</span>}
            <span className="pv-vbal">
              Stock now: <strong>{num(data.item.current_stock)}</strong>
            </span>
            <span className="pv-vbal">
              Avg cost: <strong>{fmt2(data.item.average_cost)}</strong>
            </span>
            <span className="pv-vbal">
              Value:{' '}
              <strong>
                {fmt2(
                  Number(data.item.current_stock) *
                    Number(data.item.average_cost)
                )}
              </strong>
            </span>
            {allowEdit && (
              <button
                type="button"
                className="btn-sm ghost"
                style={{ marginLeft: 'auto' }}
                onClick={() => setEditOpen((v) => !v)}
              >
                <Icon name="adjust" size={14} />{' '}
                {editOpen ? 'Hide' : 'Adjust Stock & Prices'}
              </button>
            )}
          </div>

          {/* Optional editor */}
          {editOpen && allowEdit && (
            <div
              className="panel"
              style={{
                padding: 12,
                marginTop: 10,
                background: 'var(--bg-soft, #f7f8fa)'
              }}
            >
              {editError && <div className="login-error">{editError}</div>}
              <div className="field-row">
                <label className="field">
                  <span>
                    New Stock Qty{' '}
                    <em className="hint-em">({data.item.unit || 'Pcs'})</em>
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={editForm.newStock}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, newStock: e.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Purchase Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.purchasePrice}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        purchasePrice: e.target.value
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Selling Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.sellingPrice}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        sellingPrice: e.target.value
                      }))
                    }
                  />
                </label>
              </div>
              <p className="muted-text" style={{ marginTop: 4 }}>
                Stock differences post as an <em>adjustment</em> at the current
                average cost. Purchase price is only the catalogue figure — it
                does not rewrite historical cost.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-end',
                  marginTop: 8
                }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => setEditOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={saveEdit}
                  disabled={busy}
                >
                  {busy ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Lifetime totals */}
          <h4 className="cd-sub" style={{ marginTop: 14 }}>
            Lifetime Totals
          </h4>
          <div
            className="report-cards"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))'
            }}
          >
            <div className="rc-card">
              <span>Opening Stock</span>
              <strong>{num(data.summary.opening)}</strong>
            </div>
            <div className="rc-card">
              <span>Purchased</span>
              <strong>{num(data.summary.purchased)}</strong>
            </div>
            <div className="rc-card">
              <span>Returned In (Customers)</span>
              <strong>{num(data.summary.return_in)}</strong>
            </div>
            <div className="rc-card">
              <span>Adjustments In</span>
              <strong>{num(data.summary.adj_in)}</strong>
            </div>
            <div className="rc-card">
              <span>Total In</span>
              <strong>{num(data.summary.total_in)}</strong>
            </div>
            <div className="rc-card amber">
              <span>Sold</span>
              <strong>{num(data.summary.sold)}</strong>
            </div>
            <div className="rc-card">
              <span>Returned Out (Vendors)</span>
              <strong>{num(data.summary.purchase_return)}</strong>
            </div>
            <div className="rc-card">
              <span>Adjustments Out</span>
              <strong>{num(data.summary.adj_out)}</strong>
            </div>
            <div className="rc-card">
              <span>Total Out</span>
              <strong>{num(data.summary.total_out)}</strong>
            </div>
          </div>

          {/* Filter bar */}
          <h4 className="cd-sub" style={{ marginTop: 16 }}>
            Movement History
          </h4>
          <div className="report-bar" style={{ marginBottom: 8 }}>
            <div className="rb-dates">
              <label>
                From{' '}
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                To{' '}
                <input
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
              <div className="po-tabs" style={{ marginLeft: 8 }}>
                {[
                  ['all', 'All'],
                  ['in', 'Only In'],
                  ['out', 'Only Out']
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    className={'po-tab' + (showOnly === k ? ' active' : '')}
                    onClick={() => setShowOnly(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <span className="muted-text" style={{ fontSize: 12 }}>
              {rows.length} movement{rows.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="table-scroll" style={{ maxHeight: 360 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th className="num">In</th>
                  <th className="num">Out</th>
                  <th className="num">Balance</th>
                  <th className="num">Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty">
                      No stock movements in this period
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{String(r.movement_date).slice(0, 10)}</td>
                      <td>
                        <span
                          className={
                            'po-badge ' + (TYPE_CLASS[r.movement_type] || '')
                          }
                        >
                          {TYPE_LABEL[r.movement_type] || r.movement_type}
                        </span>
                      </td>
                      <td>{r.reference_label || '—'}</td>
                      <td className="num pos">
                        {Number(r.quantity_in) > 0
                          ? '+' + num(r.quantity_in)
                          : '—'}
                      </td>
                      <td className="num neg">
                        {Number(r.quantity_out) > 0
                          ? '−' + num(r.quantity_out)
                          : '—'}
                      </td>
                      <td className="num strong">{num(r.balance_qty)}</td>
                      <td className="num">
                        {r.unit_cost != null ? fmt2(r.unit_cost) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="muted-text" style={{ fontSize: 12, marginTop: 8 }}>
            Lifetime totals are all-time. The movement list respects the date
            range above. Nothing here is ever deleted — purchases, sales,
            returns and adjustments all stay on the record.
          </p>
        </>
      )}
    </Modal>
  )
}
