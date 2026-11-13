import { useEffect, useState } from 'react'
import { creditApi } from '../api/ipc.js'
import Modal from './Modal.jsx'
import Icon from './Icons.jsx'
import { printNow } from '../utils/print.js'
import useEnterKey from '../hooks/useEnterKey.js' // 📍 PIN #1 — Enter-to-print hook

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

export default function AccountLedger({ customerId, uid, onClose }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      setData(
        await creditApi.accountLedger({
          actingUserId: uid,
          customerId,
          from: from || null,
          to: to || null
        })
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    load()
  }, [customerId]) // eslint-disable-line

  const printIt = () => printNow('print-ledger')

  // 📍 PIN #2 — Enter = print (only when ledger data is loaded)
  useEnterKey(() => {
    if (data) printIt()
  }, !!data)

  const exportXlsx = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await creditApi.exportAccountLedger({
        actingUserId: uid,
        customerId,
        from: from || null,
        to: to || null
      })
      if (!r.canceled) {
        setNotice('Exported ✓')
        setTimeout(() => setNotice(''), 3000)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const badge = (s) => (
    <span className={'ldg-badge ' + (s === 'Dr' ? 'dr' : 'cr')}>{s}</span>
  )

  return (
    <Modal
      title={
        data
          ? `Account Ledger — ${data.customer.name} (${data.customer.code})`
          : 'Account Ledger'
      }
      width={880}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn-secondary"
            onClick={exportXlsx}
            disabled={busy || !data}
          >
            <Icon name="download" size={16} /> Excel
          </button>
          <button className="btn-primary" onClick={printIt} disabled={!data}>
            <Icon name="printer" size={16} /> Print
          </button>
        </>
      }
    >
      <div className="ldg-filter">
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
        <button className="btn-sm primary" onClick={load} disabled={busy}>
          Apply
        </button>
        <button
          className="btn-sm ghost"
          onClick={() => {
            setFrom('')
            setTo('')
            setTimeout(load, 0)
          }}
        >
          All time
        </button>
        {notice && <span className="ldg-notice">{notice}</span>}
      </div>
      {error && <div className="login-error">{error}</div>}
      {!data && !error && <p className="muted-text">Loading…</p>}
      {data && (
        <div id="ledger-print">
          <div className="ledger-print-head">
            <h2>Brand Lover Family Store</h2>
            <p>
              Account Ledger — {data.customer.name} ({data.customer.code})
            </p>
            <p>
              {data.from || 'Start'} → {data.to || 'Today'}
            </p>
          </div>
          <div className="table-scroll" style={{ maxHeight: 440 }}>
            <table className="data-table ldg-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tran</th>
                  <th>Description</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="ldg-opening">
                  <td></td>
                  <td></td>
                  <td>
                    <strong>Opening Balance</strong>
                  </td>
                  <td className="num"></td>
                  <td className="num"></td>
                  <td className="num">
                    <strong>{fmt(data.opening.balance)}</strong>
                  </td>
                  <td>{badge(data.opening.status)}</td>
                </tr>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      No transactions in this period
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td className="ldg-ref">{r.ref}</td>
                      <td>{r.description}</td>
                      <td className="num">{r.debit ? fmt(r.debit) : ''}</td>
                      <td className="num">{r.credit ? fmt(r.credit) : ''}</td>
                      <td className="num">{fmt(r.balance)}</td>
                      <td>{badge(r.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="ldg-total">
                  <td colSpan={3} className="strong">
                    TOTAL
                  </td>
                  <td className="num strong">{fmt(data.totals.debit)}</td>
                  <td className="num strong">{fmt(data.totals.credit)}</td>
                  <td className="num strong">{fmt(data.totals.closing)}</td>
                  <td>{badge(data.totals.closingStatus)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
