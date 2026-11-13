import { useEffect, useState, useCallback, useRef } from 'react'
import { expensesApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js' // 📍 PIN
import { printNow } from '../utils/print.js'

import { localToday, toLocalDateStr } from '../utils/date.js'
import DatePresets from '../components/DatePresets.jsx'
import { presetRange } from '../utils/dateRanges.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const blank = {
  amount: '',
  categoryId: '',
  accountId: '',
  payee: '',
  reference: '',
  description: '',
  date: ''
}

export default function Payments() {
  const { session } = useAuth()
  const uid = session.id
  const ms = new Date()
  ms.setDate(1)

  const [from, setFrom] = useState(toLocalDateStr(ms))
  const [to, setTo] = useState(localToday())
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')
  const [data, setData] = useState({ rows: [], total: 0, byCat: [] })
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [newCat, setNewCat] = useState('')

  // 📍 PIN — refs
  const searchRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  // opening/closing the expense dialog clears any old error message
  useEffect(() => {
    setError('')
  }, [modal])

  const loadRef = useCallback(async () => {
    const [cats, acs] = await Promise.all([
      expensesApi.categories({ actingUserId: uid }),
      expensesApi.accounts({ actingUserId: uid })
    ])
    setCategories(cats)
    setAccounts(acs)
  }, [uid])

  const load = useCallback(async () => {
    setError('')
    try {
      setData(
        await expensesApi.list({
          actingUserId: uid,
          from,
          to,
          categoryId: catFilter,
          search
        })
      )
    } catch (e) {
      setError(e.message)
    }
  }, [uid, from, to, catFilter, search])

  useEffect(() => {
    loadRef().catch((e) => setError(e.message))
  }, [loadRef])
  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    const cash = accounts.find((a) => a.type === 'cash') || accounts[0]
    setForm({
      ...blank,
      accountId: cash ? String(cash.id) : '',
      date: localToday(),
      categoryId: categories[0] ? String(categories[0].id) : ''
    })
    setEditId(null)
    setError('')
    setModal(true)
  }
  const openEdit = (r) => {
    setForm({
      amount: String(r.amount),
      categoryId: r.expense_category_id ? String(r.expense_category_id) : '',
      accountId: String(r.account_id),
      payee: r.payee || '',
      reference: r.reference || '',
      description: r.description || '',
      date: r.voucher_date
    })
    setEditId(r.id)
    setError('')
    setModal(true)
  }
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    // Same warning as paying a vendor: don't let the drawer/bank go below 0 unnoticed.
    const amt = Number(form.amount) || 0
    const acct = accounts.find((a) => String(a.id) === String(form.accountId))
    if (acct && amt > 0) {
      const old = editId ? data.rows.find((x) => x.id === editId) : null
      // when editing, the old amount (same account) is already out of the balance
      const avail =
        (Number(acct.current_balance) || 0) +
        (old && String(old.account_id) === String(acct.id) ? Number(old.amount) || 0 : 0)
      if (
        amt > avail + 0.009 &&
        !window.confirm(
          `${acct.name} has only ${fmt(avail)}. Spending ${fmt(amt)} will make it ${fmt(avail - amt)}. Save anyway?`
        )
      )
        return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        actingUserId: uid,
        amount: Number(form.amount),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        accountId: Number(form.accountId),
        payee: form.payee,
        reference: form.reference,
        description: form.description,
        date: form.date
      }
      if (editId) await expensesApi.update({ ...payload, id: editId })
      else await expensesApi.create(payload)
      setModal(false)
      await load()
      setAccounts(await expensesApi.accounts({ actingUserId: uid }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const del = async (r) => {
    if (
      !window.confirm(
        `Delete ${r.voucher_no} (${fmt(r.amount)})? The account balance will be restored.`
      )
    )
      return
    setError('')
    try {
      await expensesApi.delete({ actingUserId: uid, id: r.id })
      await load()
      setAccounts(await expensesApi.accounts({ actingUserId: uid }))
    } catch (e) {
      setError(e.message)
    }
  }

  const addCat = async () => {
    if (!newCat.trim()) return
    try {
      await expensesApi.addCategory({ actingUserId: uid, name: newCat })
      setCategories(await expensesApi.categories({ actingUserId: uid }))
      setNewCat('')
    } catch (e) {
      setError(e.message)
    }
  }

  // 📍 PIN — hotkeys
  useHotkeys(
    {
      t: () => {
        const r = presetRange('today')
        setFrom(r.from)
        setTo(r.to)
      },
      w: () => {
        const r = presetRange('week') // Ctrl+W — This Week (same as the button)
        setFrom(r.from)
        setTo(r.to)
      },
      m: () => {
        const r = presetRange('month')
        setFrom(r.from)
        setTo(r.to)
      },
      l: () => {
        setFrom('')
        setTo('')
      },
      f2: () => searchRef.current?.focus(),
      f5: () => {
        if (!busy) load()
      },
      f8: () => {
        if (!busy && !modal) openNew()
      },
      f9: () => {
        // F9 → save modal (only when modal is open)
        if (busy || !modal) return
        save()
      },
      e: () => {
        if (!busy) load()
      }, // alias for F5
      p: () => printNow(),
      'alt+1': () => fromRef.current?.focus(),
      'alt+2': () => toRef.current?.focus(),
      escape: () => {
        if (modal) setModal(false)
      }
    },
    [busy, modal, from, to, catFilter, search, form, editId]
  )

  return (
    <div className="report-page">
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
          <select
            className="role-select"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rb-actions">
          <div className="search-box">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder="Payee / note / voucher  (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn-sm primary"
            onClick={openNew}
            title="New Expense (F8)"
          >
            <Icon name="plus" size={15} /> New Expense
          </button>
        </div>
      </div>

      {/* the expense dialog shows its own error — not twice */}
      {error && !modal && (
        <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      <div className="report-cards">
        <div className="rc-card amber">
          <span>Total (range)</span>
          <strong>{fmt(data.total)}</strong>
        </div>
        {data.byCat.slice(0, 4).map((c) => (
          <div key={c.category} className="rc-card">
            <span>{c.category}</span>
            <strong>{fmt(c.total)}</strong>
            <em style={{ fontSize: 11, color: 'var(--muted)' }}>
              {c.cnt} entries
            </em>
          </div>
        ))}
      </div>

      <div className="panel report-table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher</th>
                <th>Date</th>
                <th>Category</th>
                <th>Payee</th>
                <th>Description</th>
                <th>Account</th>
                <th>By</th>
                <th className="num">Amount</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty">
                    No expenses in this range
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.voucher_no}</td>
                    <td>{r.voucher_date}</td>
                    <td>{r.category || '—'}</td>
                    <td>{r.payee || '—'}</td>
                    <td>{r.description || '—'}</td>
                    <td>
                      {r.account_name}{' '}
                      <span className="muted-text">({r.payment_method})</span>
                    </td>
                    <td>{r.by_user || '—'}</td>
                    <td className="num strong neg">{fmt(r.amount)}</td>
                    <td className="num">
                      <div className="table-actions">
                        <button
                          className="btn-icon"
                          title="Edit"
                          onClick={() => openEdit(r)}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Delete"
                          onClick={() => del(r)}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
          <kbd>F8</kbd> New
        </span>
        <span>
          <kbd>F9</kbd> Save
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>1/2</kbd> Date focus
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>

      {modal && (
        <Modal
          title={editId ? 'Edit Expense' : 'New Expense / Payment'}
          width={520}
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={save}
                disabled={busy}
                title="Save (F9)"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <div className="field-row">
            <label className="field">
              <span>Amount</span>
              <input
                type="number"
                min="0"
                autoFocus
                value={form.amount}
                onChange={(e) => setF('amount', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setF('date', e.target.value)}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Category</span>
              <select
                value={form.categoryId}
                onChange={(e) => setF('categoryId', e.target.value)}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>From Account</span>
              <select
                value={form.accountId}
                onChange={(e) => setF('accountId', e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type}) · {fmt(a.current_balance)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>
              Payee <em className="hint-em">(salesman name, guest, vendor…)</em>
            </span>
            <input
              value={form.payee}
              onChange={(e) => setF('payee', e.target.value)}
              placeholder="e.g. Ali (salary) / Guest tea"
            />
          </label>
          <label className="field">
            <span>Description / Note</span>
            <input
              value={form.description}
              onChange={(e) => setF('description', e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Reference{' '}
              <em className="hint-em">(cheque no, bill no — optional)</em>
            </span>
            <input
              value={form.reference}
              onChange={(e) => setF('reference', e.target.value)}
            />
          </label>

          <div className="add-cat-row">
            <input
              placeholder="Add a new category…"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCat()}
            />
            <button type="button" className="btn-sm ghost" onClick={addCat}>
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
