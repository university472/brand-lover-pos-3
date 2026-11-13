import { useEffect, useState, useCallback, useRef } from 'react'
import { creditApi, salesApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import AccountLedger from '../components/AccountLedger.jsx'
import Receipt from '../components/Receipt.jsx'
import DashboardDetailModal from '../components/DashboardDetailModal.jsx'
import SaleEditor from '../components/SaleEditor.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { useArrowListNav } from '../hooks/useArrowListNav.js'
import { printReceiptElement } from '../utils/printReceipt.js'

import { localToday } from '../utils/date.js'
const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })

// ✅ A2 — payables dikhane ke liye helper
const fmtBalance = (n) => {
  const v = Number(n || 0)
  if (v < -0.009) return `${fmt(Math.abs(v))} (payable)`
  return fmt(v)
}

export default function CreditBook() {
  const { session } = useAuth()
  const uid = session.id

  const [totals, setTotals] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false) // ✅ A2 — settled toggle
  const [selId, setSelId] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [payModal, setPayModal] = useState(false)
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentType: 'cash',
    accountId: '',
    date: '',
    note: ''
  })
  const [editTarget, setEditTarget] = useState(null)
  // true = the pay dialog is used for "Refund to customer" (shop owes the customer)
  const [refundMode, setRefundMode] = useState(false)
  const [showLedger, setShowLedger] = useState(false)
  const [cardDetail, setCardDetail] = useState(null)
  const [receipt, setReceipt] = useState(null)

  const searchRef = useRef(null)
  const amountRef = useRef(null)
  const customerListRef = useRef(null)
  useArrowListNav(customerListRef)

  const loadTop = useCallback(async () => {
    const [t, ac] = await Promise.all([
      salesApi.dailyPaymentTotals({ actingUserId: uid }),
      salesApi.accounts()
    ])
    setTotals(t)
    setAccounts(ac)
  }, [uid])

  const loadCustomers = useCallback(async () => {
    setCustomers(
      await creditApi.customers({
        actingUserId: uid,
        search,
        includeSettled: showAll
      })
    )
  }, [uid, search, showAll])

  const loadLedger = useCallback(
    async (id) => {
      if (!id) {
        setLedger(null)
        return
      }
      setLedger(await creditApi.ledger({ actingUserId: uid, customerId: id }))
    },
    [uid]
  )

  useEffect(() => {
    loadTop().catch((e) => setError(e.message))
  }, [loadTop])
  useEffect(() => {
    loadCustomers().catch((e) => setError(e.message))
  }, [loadCustomers])
  useEffect(() => {
    loadLedger(selId).catch((e) => setError(e.message))
  }, [selId, loadLedger])

  // opening/closing the repayment dialog clears any old error message
  useEffect(() => {
    setError('')
  }, [payModal, editTarget])

  // Credit bill opened from the customer's bill list (view / edit / reprint, ← → to move)
  const [billEditId, setBillEditId] = useState(null)

  const refreshAll = async () => {
    await loadTop()
    await loadCustomers()
    if (selId) await loadLedger(selId)
  }

  // Every credit repayment auto-prints a receipt, same as a normal sale.
  useEffect(() => {
    if (!receipt) return
    const t = setTimeout(async () => {
      await printReceiptElement('receipt', {
        printerName: localStorage.getItem('receiptPrinter') || undefined
      })
      setReceipt(null)
    }, 300)
    return () => clearTimeout(t)
  }, [receipt])

  // Cash/Online toggle — auto-picks the first matching account, still editable below
  // via "Into Account" if there's more than one of that type.
  const choosePayType = (type) => {
    const acc = accounts.find((a) => a.type === type)
    setPayForm((f) => ({
      ...f,
      paymentType: type,
      accountId: acc ? String(acc.id) : f.accountId
    }))
  }

  const openPay = () => {
    const cash = accounts.find((a) => a.type === 'cash') || accounts[0]
    setPayForm({
      amount: '',
      paymentType: cash?.type === 'bank' ? 'bank' : 'cash',
      accountId: cash ? String(cash.id) : '',
      date: localToday(),
      note: ''
    })
    setError('')
    setRefundMode(false)
    setPayModal(true)
  }
  // Shop owes the customer (balance below 0) → pay the money back
  const openRefund = () => {
    openPay()
    setRefundMode(true)
  }

  const savePay = async () => {
    setBusy(true)
    setError('')
    if (refundMode) {
      try {
        await creditApi.refundCustomer({
          actingUserId: uid,
          customerId: selId,
          amount: Number(payForm.amount),
          accountId: Number(payForm.accountId),
          date: payForm.date,
          note: payForm.note
        })
        setPayModal(false)
        setRefundMode(false)
        await refreshAll() // the refund shows in the Ledger Timeline
      } catch (e) {
        setError(e.message)
      } finally {
        setBusy(false)
      }
      return
    }
    try {
      const outstandingBefore = Number(ledger?.summary?.outstanding) || 0
      const res = await creditApi.recordRepayment({
        actingUserId: uid,
        customerId: selId,
        amount: Number(payForm.amount),
        accountId: Number(payForm.accountId),
        date: payForm.date,
        note: payForm.note
      })
      setPayModal(false)
      setReceipt({
        voucherNo: res.voucherNo,
        amount: res.amount,
        dateOnly: new Date().toLocaleDateString('en-GB'),
        timeOnly: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        customer: res.customerName,
        customerCode: res.customerCode,
        accountName: res.accountName,
        method: res.method,
        operator: session?.fullName || session?.username || '—',
        remainingBalance: +(outstandingBefore - res.amount).toFixed(2)
      })
      await refreshAll()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openEdit = (r) => {
    setEditTarget({ ...r })
    setError('')
    const acct = accounts.find((a) => String(a.id) === String(r.account_id))
    setPayForm({
      amount: String(r.amount),
      paymentType: acct?.type === 'bank' ? 'bank' : 'cash',
      accountId: String(r.account_id),
      date: r.voucher_date,
      note: r.description || ''
    })
  }
  const saveEdit = async () => {
    setBusy(true)
    setError('')
    try {
      await creditApi.updateRepayment({
        actingUserId: uid,
        voucherId: editTarget.id,
        amount: Number(payForm.amount),
        accountId: Number(payForm.accountId),
        date: payForm.date,
        note: payForm.note
      })
      setEditTarget(null)
      await refreshAll()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const deleteRefund = async (e) => {
    if (
      !window.confirm(
        `Delete this refund of ${fmt(e.amount)}? The money goes back into the account and you will owe the customer again.`
      )
    )
      return
    setError('')
    try {
      await creditApi.deleteCustomerRefund({ actingUserId: uid, voucherId: e.refundVoucherId })
      await refreshAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteRepayment = async (r) => {
    if (
      !window.confirm(
        `Delete repayment ${r.voucher_no} of ${fmt(r.amount)}? The balance will be restored.`
      )
    )
      return
    setError('')
    try {
      await creditApi.deleteRepayment({ actingUserId: uid, voucherId: r.id })
      await refreshAll()
    } catch (e) {
      setError(e.message)
    }
  }

  const modalOpen = payModal || !!editTarget
  // Live limit for the amount box (the server checks it too): repayment up to what is owed,
  // refund up to what the shop owes, edit = owed + this repayment's old amount.
  const outNow = Number(ledger?.summary?.outstanding) || 0
  const maxAmount = editTarget
    ? +(outNow + Number(editTarget.amount || 0)).toFixed(2)
    : refundMode
      ? +Math.abs(Math.min(0, outNow)).toFixed(2)
      : +Math.max(0, outNow).toFixed(2)
  const overMax = modalOpen && Number(payForm.amount) > maxAmount + 0.009
  const canPay = !!selId && !!ledger && Number(ledger.summary.outstanding) > 0

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f3: () => {
        if (!busy && !modalOpen && canPay) openPay()
      },
      f6: () => {
        if (!modalOpen || !ledger) return
        setPayForm((f) => ({
          ...f,
          amount: String(Math.abs(Number(ledger.summary.outstanding)))
        }))
        amountRef.current?.focus()
      },
      f9: () => {
        if (busy || !modalOpen || overMax) return
        editTarget ? saveEdit() : savePay()
      },
      s: () => {
        if (busy || !modalOpen || overMax) return
        editTarget ? saveEdit() : savePay()
      },
      'alt+1': () => {
        if (modalOpen) choosePayType('cash')
        else setCardDetail('cash')
      },
      'alt+2': () => {
        if (modalOpen) choosePayType('bank')
        else setCardDetail('online')
      },
      'alt+3': () => {
        if (!modalOpen) setCardDetail('credit')
      },
      'alt+4': () => {
        if (!modalOpen && selId && ledger) setShowLedger(true)
      },
      'alt+5': () => {
        if (!modalOpen) setCardDetail('credit-collections')
      },
      f5: () => {
        if (!busy) refreshAll().catch((e) => setError(e.message))
      },
      escape: () => {
        if (payModal || editTarget) {
          setPayModal(false)
          setEditTarget(null)
        } else if (showLedger) setShowLedger(false)
        else if (cardDetail) setCardDetail(null)
      }
    },
    [
      busy,
      modalOpen,
      canPay,
      ledger,
      selId,
      accounts,
      payModal,
      editTarget,
      showLedger,
      cardDetail,
      overMax,
      payForm,
      refundMode
    ]
  )

  return (
    <div className="credit-page">
      <div className="coll-cards">
        <div
          className="coll-card cash clickable"
          role="button"
          tabIndex={0}
          onClick={() => setCardDetail('cash')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCardDetail('cash')
            }
          }}
          title="Alt+1 — view today's cash movement"
        >
          <span>Today · Cash</span>
          <strong>{fmt(totals?.cash)}</strong>
          <em>
            {totals?.cashRefund > 0
              ? `sales ${fmt(totals.cashSales)} − refunds ${fmt(totals.cashRefund)}`
              : `${totals?.cashCnt || 0} entries`}
          </em>
        </div>
        <div
          className="coll-card online clickable"
          role="button"
          tabIndex={0}
          onClick={() => setCardDetail('online')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCardDetail('online')
            }
          }}
          title="Alt+2 — view today's online movement"
        >
          <span>Today · Online</span>
          <strong>{fmt(totals?.online)}</strong>
          <em>
            {totals?.onlineRefund > 0
              ? `sales ${fmt(totals.onlineSales)} − refunds ${fmt(totals.onlineRefund)}`
              : `${totals?.onlineCnt || 0} entries`}
          </em>
        </div>
        <div
          className="coll-card credit clickable"
          role="button"
          tabIndex={0}
          onClick={() => setCardDetail('credit')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCardDetail('credit')
            }
          }}
          title="Alt+3 — view today's credit bills"
        >
          <span>Today · Credit Given</span>
          <strong>{fmt(totals?.credit)}</strong>
          <em>{totals?.creditCnt || 0} bills</em>
        </div>
        {/* Recoveries get their own card — they are no longer blended into the
            Cash / Online sales cards above (those are sales-only). */}
        <div
          className="coll-card recovery clickable"
          role="button"
          tabIndex={0}
          onClick={() => setCardDetail('credit-collections')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCardDetail('credit-collections')
            }
          }}
          title="Alt+5 — view today's recoveries"
        >
          <span>Today · Recovery</span>
          <strong>{fmt(totals?.creditCollected)}</strong>
          <em>
            {totals?.recoveryCnt || 0} receipts · Cash {fmt(totals?.cashRecovery)} ·
            Online {fmt(totals?.onlineRecovery)}
          </em>
        </div>
      </div>

      <div className="credit-body">
        <div className="inv-pane">
          <div className="inv-pane-head">
            <span>OWES MONEY</span>
            {/* ✅ A2 — show all toggle */}
            <label
              className="bc-check"
              title="Show customers with cleared / settled accounts too"
            >
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />{' '}
              All
            </label>
          </div>
          {/* flex: none — it used to stretch to ~270px tall in this column */}
          <div className="search-box" style={{ margin: '8px', flex: '0 0 auto' }}>
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              placeholder="Search name / code (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="inv-list" ref={customerListRef}>
            {customers.length === 0 && (
              <div className="inv-empty">
                {showAll
                  ? 'No customers with credit history 🎉'
                  : 'No outstanding credit 🎉'}
              </div>
            )}
            {customers.map((c) => {
              const v = Number(c.current_balance)
              return (
                <div
                  key={c.id}
                  data-nav-item
                  tabIndex={0}
                  className={
                    'inv-list-item' + (selId === c.id ? ' active' : '')
                  }
                  onClick={() => setSelId(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelId(c.id)
                    }
                  }}
                >
                  <div className="ili-text">
                    <strong>{c.name}</strong>
                    <span>{c.code}</span>
                  </div>
                  <span className={'owe-amt' + (v < 0 ? ' payable' : '')}>
                    {fmtBalance(v)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel credit-detail">
          {/* the repayment dialog shows its own error — not twice */}
          {error && !payModal && !editTarget && (
            <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </div>
          )}
          {!ledger ? (
            <div className="inv-empty" style={{ margin: 'auto' }}>
              Select a customer to view their credit ledger
            </div>
          ) : (
            <>
              <div className="cd-head">
                <div>
                  <h3>
                    {ledger.customer.name}{' '}
                    <span className="muted-text">· {ledger.customer.code}</span>
                  </h3>
                  <div className="cd-balance">
                    Outstanding:{' '}
                    <strong
                      className={
                        Number(ledger.summary.outstanding) < -0.009
                          ? 'payable'
                          : ''
                      }
                    >
                      {fmtBalance(ledger.summary.outstanding)}
                    </strong>
                    {ledger.summary.oldestAgeDays > 0 && (
                      <span
                        className={
                          'age-chip' +
                          (ledger.summary.oldestAgeDays > 30 ? ' old' : '')
                        }
                      >
                        oldest {ledger.summary.oldestAgeDays}d
                      </span>
                    )}
                  </div>
                </div>
                <div className="cd-actions">
                  <button
                    className="btn-sm secondary"
                    onClick={() => setShowLedger(true)}
                    title="Open printable account ledger"
                  >
                    <Icon name="book" size={15} /> Account Ledger
                  </button>
                  {Number(ledger.summary.outstanding) < -0.009 ? (
                    <button
                      className="btn-sm primary"
                      onClick={openRefund}
                      title="You owe this customer — record the money you pay back"
                    >
                      <Icon name="wallet" size={15} /> Refund to customer
                    </button>
                  ) : (
                    <button
                      className="btn-sm primary"
                      onClick={openPay}
                      disabled={Number(ledger.summary.outstanding) <= 0}
                    >
                      <Icon name="wallet" size={15} /> Record Repayment
                    </button>
                  )}
                </div>
              </div>

              <div className="cb-summary">
                <div>
                  <span>Billed</span>
                  <strong>{fmt(ledger.summary.totalBilled)}</strong>
                </div>
                <div>
                  <span>Total Due</span>
                  <strong>
                    {fmt(ledger.summary.totalDue + ledger.summary.opening)}
                  </strong>
                </div>
                <div>
                  <span>Repaid</span>
                  <strong className="pos">
                    {fmt(ledger.summary.totalRepaid)}
                  </strong>
                </div>
                <div>
                  <span>Outstanding</span>
                  <strong
                    className={
                      Number(ledger.summary.outstanding) < -0.009
                        ? 'payable'
                        : ledger.summary.outstanding > 0
                          ? 'neg'
                          : 'pos'
                    }
                  >
                    {fmtBalance(ledger.summary.outstanding)}
                  </strong>
                </div>
              </div>

              <div className="cb-cols">
                <div className="cb-panel">
                  <h4 className="cd-sub">Bills (oldest settled first)</h4>
                  <div className="cb-scroll">
                    {ledger.bills.length === 0 ? (
                      <div className="inv-empty">No credit bills</div>
                    ) : (
                      ledger.bills.map((b) => (
                        <div
                          key={b.id}
                          className="bill-row clickable"
                          title="Open / edit this bill"
                          onClick={() => setBillEditId(b.id)}
                        >
                          <div className="bill-main">
                            <strong>#{b.invoice_no}</strong>
                            <span>
                              {b.invoice_date} · total {fmt(b.net_total)}
                              {b.due_date ? ` · due ${b.due_date}` : ''}
                            </span>
                          </div>
                          <div className="bill-right">
                            <span className={'status-chip ' + (b.overdue ? 'unpaid' : b.status)}>
                              {b.overdue ? 'overdue' : b.status}
                            </span>
                            <span className="bill-rem">
                              {b.remaining > 0
                                ? fmt(b.remaining) + ' left'
                                : 'cleared'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="cb-panel">
                  <h4 className="cd-sub">Ledger Timeline</h4>
                  <div className="cb-scroll">
                    {ledger.timeline.length === 0 ? (
                      <div className="inv-empty">No activity</div>
                    ) : (
                      ledger.timeline.map((e, i) => (
                        <div key={i} className={'tl-row ' + e.kind}>
                          <div className="tl-main">
                            <strong>{e.label}</strong>
                            <span>
                              {e.date || 'opening'}
                              {e.kind === 'payment' && e.description
                                ? ' · ' + e.description
                                : ''}
                              {e.kind === 'payment' && e.account_name
                                ? ' · ' + e.account_name
                                : ''}
                            </span>
                          </div>
                          <div className="tl-amt">
                            <strong
                              className={e.kind === 'payment' ? 'pos' : 'neg'}
                            >
                              {e.kind === 'payment' ? '-' : '+'}
                              {fmt(e.amount)}
                            </strong>
                            <span className="tl-bal">
                              bal {fmtBalance(e.balance)}
                            </span>
                          </div>
                          {e.kind === 'payment' && e.id && !e.isAdjustment && (
                            <div className="tl-actions">
                              <button
                                className="btn-icon"
                                title="Edit"
                                onClick={() => openEdit(e)}
                              >
                                <Icon name="edit" size={14} />
                              </button>
                              <button
                                className="btn-icon danger"
                                title="Delete"
                                onClick={() => deleteRepayment(e)}
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          )}
                          {e.refundVoucherId && (
                            <div className="tl-actions">
                              <button
                                className="btn-icon danger"
                                title="Delete this refund"
                                onClick={() => deleteRefund(e)}
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {(payModal || editTarget) && (
        <Modal
          title={
            editTarget
              ? `Edit Repayment · ${editTarget.voucher_no}`
              : refundMode
                ? 'Refund to customer (money paid back)'
                : 'Record Repayment'
          }
          width={440}
          onClose={() => {
            setPayModal(false)
            setEditTarget(null)
          }}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => {
                  setPayModal(false)
                  setEditTarget(null)
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={editTarget ? saveEdit : savePay}
                disabled={busy || overMax}
              >
                Save
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <div className="field">
            <span className="field-label">
              Payment Type <em className="hint-em">(Alt+1 / Alt+2)</em>
            </span>
            <div className="pay-type-group">
              <button
                type="button"
                className={
                  'pay-type-btn' +
                  (payForm.paymentType === 'cash' ? ' active cash' : '')
                }
                onClick={() => choosePayType('cash')}
              >
                Cash
              </button>
              <button
                type="button"
                className={
                  'pay-type-btn' +
                  (payForm.paymentType === 'bank' ? ' active online' : '')
                }
                onClick={() => choosePayType('bank')}
              >
                Online
              </button>
            </div>
          </div>
          <div className="field-row">
            <label className="field">
              <span>
                Amount <em className="hint-em">(F6 fills outstanding)</em>
              </span>
              <input
                ref={amountRef}
                type="number"
                min="0"
                autoFocus
                value={payForm.amount}
                onChange={(e) =>
                  setPayForm({ ...payForm, amount: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || busy || overMax) return
                  e.preventDefault()
                  editTarget ? saveEdit() : savePay()
                }}
              />
            </label>
            <label className="field">
              <span>{refundMode ? 'Paid from' : 'Into Account'}</span>
              <select
                value={payForm.accountId}
                onChange={(e) =>
                  setPayForm({ ...payForm, accountId: e.target.value })
                }
              >
                {accounts
                  .filter((a) => a.type === payForm.paymentType)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {overMax && (
            <div className="login-error">
              {refundMode
                ? `That is more than you owe this customer (${fmt(maxAmount)}).`
                : `That is more than the outstanding balance (${fmt(maxAmount)}). Enter up to that amount.`}
            </div>
          )}
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={payForm.date}
              onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Note (repayment history)</span>
            <input
              value={payForm.note}
              placeholder="e.g. Paid in cash at counter"
              onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
            />
          </label>
        </Modal>
      )}

      {showLedger && ledger && (
        <AccountLedger
          customerId={ledger.customer.id}
          uid={uid}
          onClose={() => setShowLedger(false)}
        />
      )}

      {cardDetail && (
        <DashboardDetailModal
          type={cardDetail}
          date={localToday()}
          uid={uid}
          onClose={() => setCardDetail(null)}
          onChanged={() => refreshAll().catch((e) => setError(e.message))}
        />
      )}

      {billEditId && (
        <SaleEditor
          saleId={billEditId}
          onClose={() => setBillEditId(null)}
          onSaved={() => refreshAll().catch((e) => setError(e.message))}
        />
      )}

      {/* Repayment receipt — off-screen, purely for the silent auto-print */}
      {receipt && (
        <div style={{ position: 'fixed', left: '-99999px', top: 0 }} aria-hidden="true">
          <Receipt data={receipt} title="Payment Receipt" variant="repayment" />
        </div>
      )}

      <div className="hotkey-hint">
        <div className="hk-group">
          <span className="hk-title">Customer</span>
          <span>
            <kbd>F2</kbd> Search
          </span>
          <span>
            <kbd>↓</kbd>
            <kbd>↑</kbd> Move
          </span>
          <span>
            <kbd>Enter</kbd> Select
          </span>
        </div>
        <div className="hk-group">
          <span className="hk-title">Payment</span>
          <span>
            <kbd>F3</kbd> Record payment
          </span>
          <span>
            <kbd>F6</kbd> Exact outstanding
          </span>
          <span>
            <kbd>Enter</kbd> Post
          </span>
          <span>
            <kbd>Alt</kbd>+<kbd>1</kbd>/<kbd>2</kbd> Cash/Online account
          </span>
        </div>
        <div className="hk-group">
          <span className="hk-title">Details &amp; Ledger</span>
          <span>
            <kbd>Alt</kbd>+<kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd> Cash/Online/Credit
          </span>
          <span>
            <kbd>Alt</kbd>+<kbd>4</kbd> Account ledger
          </span>
        </div>
        <div className="hk-group">
          <span className="hk-title">General</span>
          <span>
            <kbd>F5</kbd> Refresh
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}
