import { useEffect, useState, useCallback } from 'react'
import { purchasesApi } from '../api/ipc.js'
import Modal from './Modal.jsx'
import Icon from './Icons.jsx'
import { localToday } from '../utils/date.js'
import { notifyStockChanged } from '../utils/lowStock.js'

// One purchase bill: VIEW (types, returned pieces, returns, edit history, payments),
// EDIT (qty / total / types — the total follows the qty at the same per-piece price unless
// the owner types a total) and RETURN TO VENDOR (defective / short pieces; deduct from
// balance, vendor paid back, or replacement only).

const fmt = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
let seq = 0

const SETTLE = {
  deduct: { label: 'Deduct from what we owe', hint: 'Vendor balance goes down by the return value.' },
  refund: { label: 'Vendor paid the money back', hint: 'Money comes IN to Cash in Hand / Online; vendor balance unchanged.' },
  none: { label: 'Replacement / no deduction', hint: 'Only recorded — the vendor will send replacement pieces.' }
}

export default function PurchaseBillModal({ billId, uid, accounts, onClose, onChanged, onDelete }) {
  const [bill, setBill] = useState(null)
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'return'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // edit state
  const [lines, setLines] = useState([])
  const [amount, setAmount] = useState('')
  const [billDate, setBillDate] = useState('')
  const [vendorBillNo, setVendorBillNo] = useState('')
  const [reason, setReason] = useState('')
  // return state
  const [retQty, setRetQty] = useState({})
  const [settle, setSettle] = useState('deduct')
  const [via, setVia] = useState('cash')
  const [retDate, setRetDate] = useState(localToday())
  const [retReason, setRetReason] = useState('')

  const load = useCallback(async () => {
    setBill(await purchasesApi.billDetail({ actingUserId: uid, id: billId }))
  }, [uid, billId])
  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const startEdit = () => {
    setError('')
    setLines(bill.lines.map((l) => ({ key: ++seq, id: l.id, description: l.description, quantity: String(l.quantity),
      lineTotal: String(l.amount), rate: l.rate, auto: true, returned: l.returned, linked: !!l.item_id })))
    setAmount(String(bill.total))
    setBillDate(bill.order_date)
    setVendorBillNo(bill.vendor_bill_no || '')
    setReason('')
    setMode('edit')
  }
  const startReturn = () => {
    setError('')
    setRetQty({})
    setSettle('deduct')
    setVia('cash')
    setRetDate(localToday())
    setRetReason('')
    setMode('return')
  }

  // Changing qty moves the total at the same per-piece price (owner's rule) — unless the owner
  // typed a total himself for that line.
  const setQty = (key, q) =>
    setLines((p) => p.map((l) => (l.key !== key ? l : {
      ...l, quantity: q, lineTotal: l.auto && l.rate ? String(r2((Number(q) || 0) * l.rate)) : l.lineTotal })))
  const setTotal = (key, t) => setLines((p) => p.map((l) => (l.key !== key ? l : { ...l, lineTotal: t, auto: false })))
  const setDesc = (key, d) => setLines((p) => p.map((l) => (l.key !== key ? l : { ...l, description: d })))
  const addLine = () => setLines((p) => [...p, { key: ++seq, id: null, description: '', quantity: '', lineTotal: '', rate: 0, auto: false, returned: 0 }])
  const removeLine = (key) => setLines((p) => p.filter((l) => l.key !== key))

  const amountOnly = bill && bill.lines.length === 0
  const newTotal = amountOnly ? r2(Number(amount) || 0) : r2(lines.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0))
  const delta = bill ? r2(newTotal - bill.total) : 0

  const saveEdit = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await purchasesApi.editBill({
        actingUserId: uid, poId: bill.id, billDate, vendorBillNo, reason,
        lines: amountOnly ? [] : lines.map((l) => ({ id: l.id, description: l.description, quantity: Number(l.quantity) || 0, lineTotal: Number(l.lineTotal) || 0 })),
        billAmount: amountOnly ? newTotal : 0
      })
      if (bill.adds_stock) notifyStockChanged()
      onChanged?.(`Bill ${r.serial} updated: ${fmt(r.oldTotal)} → ${fmt(r.newTotal)} (vendor balance ${r.delta >= 0 ? '+' : '−'}${fmt(Math.abs(r.delta))}).`)
      setMode('view')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const retLines = bill ? bill.lines.map((l) => ({ ...l, q: Number(retQty[l.id]) || 0 })) : []
  const retTotal = r2(retLines.reduce((s, l) => s + l.q * l.rate, 0))
  const acctFor = (v) => accounts.find((a) => a.type === (v === 'bank' ? 'bank' : 'cash'))
  const balNow = Number(bill?.vendor_balance) || 0
  const balAfterReturn = settle === 'deduct' ? r2(balNow - retTotal) : balNow

  const saveReturn = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await purchasesApi.createReturn({
        actingUserId: uid, poId: bill.id, date: retDate, reason: retReason, settlement: settle,
        accountId: settle === 'refund' ? acctFor(via)?.id : null,
        items: retLines.filter((l) => l.q > 0).map((l) => ({ poItemId: l.id, quantity: l.q }))
      })
      if (bill.adds_stock) notifyStockChanged()
      onChanged?.(`${r.returnNo}: ${fmt(r.total)} of goods returned — ${SETTLE[r.settlement].label.toLowerCase()}` +
        (r.refund ? ` (${r.refund.voucherNo} into ${r.refund.account})` : '') + '.')
      setMode('view')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeReturn = async (ret) => {
    if (!window.confirm(`Delete return ${ret.return_no} (${fmt(ret.total_amount)})? Everything it changed is reversed.`)) return
    setBusy(true)
    setError('') // an older failure message must not stay after this succeeds
    try {
      await purchasesApi.deleteReturn({ actingUserId: uid, id: ret.id })
      if (bill.adds_stock) notifyStockChanged()
      onChanged?.(`Return ${ret.return_no} deleted.`)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const title = bill ? `Bill ${bill.serial_no} — ${bill.vendor || ''}` : 'Bill'
  const footer =
    mode === 'view' ? (
      <>
        <button
          className="btn-danger"
          onClick={() => {
            setError('')
            const blocked = onDelete?.(bill)
            if (typeof blocked === 'string') setError(blocked)
          }}
          disabled={!bill || busy}
        >
          Delete bill
        </button>
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
        <button className="btn-secondary" onClick={startReturn} disabled={!bill || amountOnly} title={amountOnly ? 'Amount-only bill: use Edit bill' : ''}>
          <Icon name="return" size={15} /> Return to vendor
        </button>
        <button className="btn-primary" onClick={startEdit} disabled={!bill}>
          Edit bill
        </button>
      </>
    ) : (
      <>
        <button className="btn-secondary" onClick={() => setMode('view')} disabled={busy}>
          Back
        </button>
        {mode === 'edit' ? (
          <button className="btn-primary" onClick={saveEdit} disabled={busy}>
            {busy ? 'Saving…' : `Save changes (${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))})`}
          </button>
        ) : (
          <button className="btn-primary" onClick={saveReturn} disabled={busy || retTotal <= 0}>
            {busy ? 'Saving…' : `Save return (${fmt(retTotal)})`}
          </button>
        )}
      </>
    )

  return (
    <Modal title={title} width={820} onClose={onClose} footer={footer}>
      {error && <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
      {!bill ? (
        <p className="muted-text">Loading…</p>
      ) : mode === 'view' ? (
        <>
          <div className="pb-head">
            <span>{bill.order_date}</span>
            {bill.vendor_bill_no && <span>vendor bill #{bill.vendor_bill_no}</span>}
            {bill.adds_stock ? <span className="po-badge received">stock added</span> : <span className="po-badge">record only</span>}
            {bill.remarks && <span>· {bill.remarks}</span>}
            <span className="pb-bal">
              Vendor balance now: <strong>{fmt(bill.vendor_balance)}</strong>
              {Number(bill.vendor_balance) < 0 && <em> (vendor owes you / advance)</em>}
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product type</th>
                <th className="num">Qty</th>
                <th className="num">Returned</th>
                <th className="num">Per piece</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.length === 0 ? (
                <tr><td colSpan="5" className="empty">Amount-only bill (no product types)</td></tr>
              ) : (
                bill.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.description}{l.item_code ? <span className="muted-text"> · {l.item_code}</span> : ''}</td>
                    <td className="num">{l.quantity}</td>
                    <td className={'num' + (l.returned ? ' neg' : '')}>{l.returned || '—'}</td>
                    <td className="num">{fmt(l.rate)}</td>
                    <td className="num">{fmt(l.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr><td colSpan="4" className="num strong">Bill total</td><td className="num strong">{fmt(bill.total)}</td></tr>
              {bill.returnedValue > 0 && (
                <>
                  <tr><td colSpan="4" className="num">Less: returned to vendor</td><td className="num neg">−{fmt(bill.returnedValue)}</td></tr>
                  <tr><td colSpan="4" className="num strong">Net bill</td><td className="num strong">{fmt(bill.netTotal)}</td></tr>
                </>
              )}
            </tfoot>
          </table>

          {bill.returns.length > 0 && (
            <div className="pb-sec">
              <h4>Returns to vendor</h4>
              {bill.returns.map((r) => (
                <div key={r.id} className="pb-row">
                  <span className="po-badge cancelled">{r.return_no}</span>
                  <span>{r.return_date}</span>
                  <span className="pb-grow">
                    {r.items.map((i) => `${Number(i.quantity)} × ${i.description}`).join(', ')}
                    {r.reason ? ` — ${r.reason}` : ''}
                    <em> · {SETTLE[r.settlement].label}{r.account_name ? ` (${r.account_name})` : ''}</em>
                  </span>
                  <strong>{fmt(r.total_amount)}</strong>
                  <button type="button" className="btn-icon danger" title="Delete this return" onClick={() => removeReturn(r)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {bill.payments.length > 0 && (
            <div className="pb-sec">
              <h4>Paid with this bill</h4>
              {bill.payments.map((p) => (
                <div key={p.voucher_no} className="pb-row">
                  <span className="po-badge received">{p.voucher_no}</span>
                  <span>{p.voucher_date}</span>
                  <span className="pb-grow">{p.account_name}</span>
                  <strong>{fmt(p.amount)}</strong>
                </div>
              ))}
            </div>
          )}
          {bill.edits.length > 0 && (
            <div className="pb-sec">
              <h4>Edit history</h4>
              {bill.edits.map((e, i) => (
                <div key={i} className="pb-row pb-edit">
                  <span>{String(e.edited_at).slice(0, 16)}</span>
                  <span className="pb-grow">
                    {fmt(e.old_total)} → <strong>{fmt(e.new_total)}</strong> · {e.changes}
                    {e.reason ? <em> — “{e.reason}”</em> : ''}
                    {e.by_user ? <span className="muted-text"> · {e.by_user}</span> : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : mode === 'edit' ? (
        <>
          <div className="field-row">
            <label className="field"><span>Bill date</span><input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></label>
            <label className="field"><span>Vendor's bill no.</span><input value={vendorBillNo} onChange={(e) => setVendorBillNo(e.target.value)} /></label>
          </div>
          {amountOnly ? (
            <label className="field" style={{ maxWidth: 300 }}>
              <span>Bill amount</span>
              <input type="number" min="0" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          ) : (
            <>
              <p className="muted-text pv-hint">
                Change the quantity and the total changes at the same per-piece price (e.g. 100 → 90 pieces). You can also type a total yourself.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product type</th>
                    <th className="num" style={{ width: 110 }}>Qty</th>
                    <th className="num" style={{ width: 150 }}>Total</th>
                    <th className="num" style={{ width: 110 }}>Per piece</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const q = Number(l.quantity) || 0
                    const t = Number(l.lineTotal) || 0
                    return (
                      <tr key={l.key}>
                        <td>
                          <input className="pv-in" value={l.description} onChange={(e) => setDesc(l.key, e.target.value)} placeholder="Product type" />
                          {l.returned > 0 && <div className="muted-text" style={{ fontSize: 11 }}>{l.returned} returned — qty can't go below that</div>}
                        </td>
                        <td className="num"><input className="pv-in num" type="number" min="0" value={l.quantity} onChange={(e) => setQty(l.key, e.target.value)} /></td>
                        <td className="num"><input className="pv-in num" type="number" min="0" value={l.lineTotal} onChange={(e) => setTotal(l.key, e.target.value)} /></td>
                        <td className="num muted-text">{q > 0 && t > 0 ? fmt(r2(t / q)) : '—'}</td>
                        <td>
                          <button type="button" className="btn-icon danger" title={l.returned ? 'Has returns — cannot remove' : 'Remove'} disabled={l.returned > 0} onClick={() => removeLine(l.key)}>
                            <Icon name="x" size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <button type="button" className="btn-sm ghost" onClick={addLine} style={{ marginTop: 6 }}>
                <Icon name="plus" size={14} /> Add product type
              </button>
            </>
          )}
          <label className="field" style={{ marginTop: 10 }}>
            <span>Reason (kept in the bill's history)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Only 90 pieces arrived instead of 100" />
          </label>
          <div className="pb-sum">
            <span>Old total <strong>{fmt(bill.total)}</strong></span>
            <span>New total <strong>{fmt(newTotal)}</strong></span>
            <span className={delta > 0 ? 'neg' : delta < 0 ? 'pos' : ''}>
              Vendor balance {fmt(bill.vendor_balance)} → <strong>{fmt(r2(Number(bill.vendor_balance) + delta))}</strong>
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="muted-text pv-hint">Enter how many pieces of each type go back to the vendor (defective / extra / wrong).</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product type</th>
                <th className="num">Bought</th>
                <th className="num">Already returned</th>
                <th className="num" style={{ width: 120 }}>Return now</th>
                <th className="num">Per piece</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {retLines.map((l) => (
                <tr key={l.id}>
                  <td>{l.description}</td>
                  <td className="num">{l.quantity}</td>
                  <td className="num">{l.returned || '—'}</td>
                  <td className="num">
                    <input className="pv-in num" type="number" min="0" max={l.returnable} disabled={l.returnable <= 0}
                      value={retQty[l.id] ?? ''} placeholder={l.returnable > 0 ? `max ${l.returnable}` : 'none left'}
                      onChange={(e) => { const val = e.target.value; setRetQty((m) => ({ ...m, [l.id]: val })) }} />
                  </td>
                  <td className="num">{fmt(l.rate)}</td>
                  <td className="num">{l.q ? fmt(r2(l.q * l.rate)) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan="5" className="num strong">Return value</td><td className="num strong">{fmt(retTotal)}</td></tr>
            </tfoot>
          </table>
          <div className="field" style={{ marginTop: 10 }}>
            <span className="field-label">What happens to the money?</span>
            <div className="pb-settle">
              {Object.entries(SETTLE).map(([k, s]) => (
                <label key={k} className={'pb-opt' + (settle === k ? ' active' : '')}>
                  <input type="radio" name="settle" checked={settle === k} onChange={() => setSettle(k)} />
                  <span><strong>{s.label}</strong><em>{s.hint}</em></span>
                </label>
              ))}
            </div>
          </div>
          {settle === 'refund' && (
            <div className="pay-type-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 320, marginTop: 6 }}>
              <button type="button" className={'pay-type-btn' + (via === 'cash' ? ' active cash' : '')} onClick={() => setVia('cash')}>Cash in Hand</button>
              <button type="button" className={'pay-type-btn' + (via === 'bank' ? ' active online' : '')} onClick={() => setVia('bank')}>Online</button>
            </div>
          )}
          <div className="field-row" style={{ marginTop: 8 }}>
            <label className="field"><span>Return date</span><input type="date" value={retDate} onChange={(e) => setRetDate(e.target.value)} /></label>
            <label className="field"><span>Reason</span><input value={retReason} onChange={(e) => setRetReason(e.target.value)} placeholder="e.g. defective stitching" /></label>
          </div>
          <div className="pb-sum">
            <span>Return value <strong>{fmt(retTotal)}</strong></span>
            {settle === 'refund' ? (
              <span className="pos">{via === 'bank' ? 'Online' : 'Cash in Hand'} +{fmt(retTotal)}</span>
            ) : (
              <span className={settle === 'deduct' && retTotal ? 'pos' : ''}>
                Vendor balance {fmt(balNow)} → <strong>{fmt(balAfterReturn)}</strong>
                {balAfterReturn < 0 && <em> (vendor owes you)</em>}
              </span>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
