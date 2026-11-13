import { useEffect, useState, useRef } from 'react'
import { salesApi, companyApi } from '../api/ipc.js'
import Modal from './Modal.jsx'
import Icon from './Icons.jsx'
import Receipt from './Receipt.jsx'
import { printReceiptElement } from '../utils/printReceipt.js'
import useEnterKey from '../hooks/useEnterKey.js'

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Turn a saved bill (sales:get) into the same data the Counter Sale receipt prints, so a
// reprint from Bills looks exactly like the original receipt (before, it used a different,
// older layout: no address, QR, salesman, policy or footer).
function toReceiptData(s) {
  const lines = (s.items || []).map((it) => ({
    itemId: it.item_id,
    code: it.item_code,
    name: it.description,
    qty: Number(it.quantity),
    rate: Number(it.rate),
    net: Number(it.net_amount)
  }))
  const gross = r2(lines.reduce((t, l) => t + l.qty * l.rate, 0))
  const itemDisc = r2(lines.reduce((t, l) => t + (l.qty * l.rate - l.net), 0))
  const [y, m, d] = String(s.invoice_date || '').split('-')
  return {
    invoiceNo: s.invoice_no,
    dateOnly: d ? `${d}/${m}/${y}` : s.invoice_date,
    timeOnly: s.invoice_time ? String(s.invoice_time).slice(0, 5) : '',
    operator: s.operator || '—',
    salesman: s.salesman || '—',
    customer: s.customer,
    customerCode: s.customer_code,
    paymentType: s.payment_type,
    lines,
    grossTotal: gross,
    discountTotal: r2(itemDisc + Number(s.discount || 0)),
    netTotal: Number(s.net_total),
    amountReceived: Number(s.amount_received),
    change: Number(s.cash_back || 0),
    outstanding: r2(Math.max(0, Number(s.net_total) - Number(s.amount_received)))
  }
}

export default function InvoiceReceipt({ saleId, onClose, autoPrint = false }) {
  const [s, setS] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const printRef = useRef(null)

  useEffect(() => {
    setError('')
    setS(null)
    Promise.all([salesApi.get({ id: saleId }), companyApi.getProfile().catch(() => null)])
      .then(([sale, prof]) => {
        setProfile(prof)
        setS(sale)
      })
      .catch((e) => setError(e.message))
  }, [saleId])

  // auto-print mode: silently print then close — no modal shown
  useEffect(() => {
    if (!autoPrint || !s) return
    const t = setTimeout(async () => {
      await printReceiptElement('receipt', {
        printerName: localStorage.getItem('receiptPrinter') || undefined
      })
      onClose?.()
    }, 300)
    return () => clearTimeout(t)
  }, [autoPrint, s, onClose])

  useEnterKey(() => {
    if (s && !autoPrint) printReceiptElement('receipt')
  }, !!s && !autoPrint)

  useEffect(() => {
    if (s && !autoPrint) setTimeout(() => printRef.current?.focus(), 60)
  }, [s, autoPrint])

  const receiptContent = s && (
    <Receipt data={toReceiptData(s)} profile={profile} title="Sale Receipt (Duplicate)" />
  )

  if (autoPrint) {
    return receiptContent ? (
      <div style={{ position: 'fixed', left: '-99999px', top: 0 }} aria-hidden="true">
        {receiptContent}
      </div>
    ) : null
  }

  return (
    <Modal
      title={s ? `Invoice #${s.invoice_no}` : 'Invoice'}
      width={420}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            ref={printRef}
            className="btn-primary"
            onClick={() => printReceiptElement('receipt')}
            disabled={!s}
          >
            <Icon name="printer" size={16} /> Print
          </button>
        </>
      }
    >
      {error && <div className="login-error">{error}</div>}
      {!s && !error && <p className="muted-text">Loading…</p>}
      {receiptContent}
    </Modal>
  )
}
