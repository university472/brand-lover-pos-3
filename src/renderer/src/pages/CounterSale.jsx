import { useEffect, useState, useRef, useCallback } from 'react'
import { salesApi, companyApi, salesmenApi, printerApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import Receipt from '../components/Receipt.jsx'
import InvoiceBrowser from '../components/InvoiceBrowser.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printReceiptElement } from '../utils/printReceipt.js' // 📍 seedha silent print
import useEnterKey from '../hooks/useEnterKey.js' // 📍 PIN #1 — Enter-to-print hook
import {
  effectiveThreshold,
  lowAfterSale,
  notifyStockChanged
} from '../utils/lowStock.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export default function CounterSale() {
  const { session } = useAuth()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [activeResult, setActiveResult] = useState(0)
  const [navigated, setNavigated] = useState(false)
  const [cart, setCart] = useState([])

  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [codeLookup, setCodeLookup] = useState('')

  const [salesmen, setSalesmen] = useState([])
  const [salesmanId, setSalesmanId] = useState('')

  // 📍 Receipt printer selection (Black Copper / thermal) — separate from Zebra label printer
  const [printers, setPrinters] = useState([])
  const [receiptPrinter, setReceiptPrinter] = useState(
    localStorage.getItem('receiptPrinter') || ''
  )

  const [overallDiscount, setOverallDiscount] = useState('')
  const [deliveryCharges, setDeliveryCharges] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [remarks, setRemarks] = useState('')
  const [paymentType, setPaymentType] = useState('cash')
  const [dueDate, setDueDate] = useState('')

  const [nextInvoiceNo, setNextInvoiceNo] = useState('—')
  const [profile, setProfile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Items the LAST saved bill pushed to/below their alert level (shown until dismissed)
  const [lowAlert, setLowAlert] = useState([])
  const [receipt, setReceipt] = useState(null)
  const [custModal, setCustModal] = useState(false)
  const [newCust, setNewCust] = useState({
    code: '',
    name: '',
    telephone: '',
    address: '',
    creditLimit: '',
    openingBalance: ''
  })
  const [heldModal, setHeldModal] = useState(false)
  const [heldBills, setHeldBills] = useState([])
  // Previous Invoices browser on top of the sale screen (cart is kept). openId = open that
  // bill straight away (Last Bill).
  const [browser, setBrowser] = useState(null)

  const searchRef = useRef(null)
  const searchTimer = useRef(null)
  const custLookupRef = useRef(null)
  const amountRef = useRef(null)
  const salesmanRef = useRef(null)
  const discountRef = useRef(null) // 🆕 bill discount focus target
  const resultRefs = useRef([])

  // 🆕 Tab-navigation targets for the counter workflow
  const exactBtnRef = useRef(null) // the "Exact" button next to Amount Received
  const postSaleBtnRef = useRef(null) // the main "Post Sale" button

  // Keep the highlighted row visible as the operator arrows through a long list.
  useEffect(() => {
    resultRefs.current[activeResult]?.scrollIntoView({ block: 'nearest' })
  }, [activeResult])

  // 📍 PIN #2 — Enter (input ke bahar) → Post Sale (jo khud silent print kar dega)
  useEnterKey(() => {
    if (busy || !cart.length) return
    if (isCredit && isWalkIn) return
    if (limitExceeded) return
    if (discountInvalid) return
    if (!isCredit && tendered < netTotal) return
    save()
  }, !receipt)

  const loadRefData = useCallback(async () => {
    const [cs, ac, inv, prof, sm] = await Promise.all([
      salesApi.customers(),
      salesApi.accounts(),
      salesApi.nextInvoiceNo(),
      companyApi.getProfile(),
      salesmenApi.list()
    ])
    setCustomers(cs)
    setAccounts(ac)
    setNextInvoiceNo(inv.invoiceNo)
    setProfile(prof)
    setSalesmen(sm)
    const walk = cs.find((c) => c.is_walk_in) || cs[0]
    if (walk) setCustomerId(String(walk.id))
    const cash = ac.find((a) => a.type === 'cash') || ac[0]
    if (cash) setAccountId(String(cash.id))

    // 📍 Load printer list, auto-pick a likely thermal/receipt printer if none saved
    printerApi
      .list()
      .then((list) => {
        setPrinters(list)
        if (!localStorage.getItem('receiptPrinter')) {
          const bc = list.find((p) =>
            /black\s*copper|bc87|pos|thermal|58|80/i.test(p.name)
          )
          if (bc) {
            setReceiptPrinter(bc.name)
            localStorage.setItem('receiptPrinter', bc.name)
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadRefData().catch((e) => setError(e.message))
  }, [loadRefData])

  // 📍 Post ke baad receipt ko hidden render karke SEEDHA print — koi modal/preview nahi
  useEffect(() => {
    if (!receipt) return
    const t = setTimeout(async () => {
      await printReceiptElement('receipt', {
        printerName: receiptPrinter || undefined
      })
      setReceipt(null)
    }, 300)
    return () => clearTimeout(t)
  }, [receipt, receiptPrinter])

  const lineDiscAmt = (l) => {
    const gross = l.qty * l.rate
    if (l.discountMode === 'amount')
      return round2(Math.min(Number(l.discountValue) || 0, gross))
    return round2((gross * (Number(l.discountValue) || 0)) / 100)
  }
  const lineNet = (l) => round2(l.qty * l.rate - lineDiscAmt(l))

  const grossSubTotal = round2(cart.reduce((s, l) => s + l.qty * l.rate, 0))
  const itemDiscountTotal = round2(cart.reduce((s, l) => s + lineDiscAmt(l), 0))
  const subTotal = round2(grossSubTotal - itemDiscountTotal)
  const disc = Number(overallDiscount) || 0
  const delivery = Number(deliveryCharges) || 0
  const netTotal = round2(subTotal - disc + delivery)
  const tendered = Number(amountReceived) || 0
  const change = round2(Math.max(0, tendered - netTotal))
  const outstanding = round2(Math.max(0, netTotal - tendered))
  const selectedCustomer = customers.find(
    (c) => String(c.id) === String(customerId)
  )
  const isWalkIn = selectedCustomer?.is_walk_in
  const isCredit = paymentType === 'credit'

  const creditLimit = Number(selectedCustomer?.credit_limit) || 0
  const currentBalance = Number(selectedCustomer?.current_balance) || 0
  const newBalanceAfterSale = currentBalance + outstanding
  const availableCredit =
    creditLimit > 0 ? creditLimit - newBalanceAfterSale : null
  const limitExceeded =
    isCredit && !isWalkIn && creditLimit > 0 && availableCredit < -0.009

  // 🆕 Bill-level discount guard — negative, or a discount that wipes the whole bill out
  // (net must stay > 0). The server rejects net <= 0 anyway; block it before it leaves.
  const discountInvalid = disc < 0 || (cart.length > 0 && netTotal <= 0.009)

  // Warn BEFORE saving: lines whose stock after this bill will be at/below the alert level.
  const lowInCart = lowAfterSale(cart)

  // Lines that must not be posted: more than in stock, zero/negative qty or rate, a discount
  // above 100% / below 0, or a line whose net comes to 0 or less (a free bill).
  const lineProblem = (l) => {
    if (!(Number(l.qty) > 0)) return 'quantity must be more than 0'
    if (Number(l.qty) > Number(l.stock) + 1e-9)
      return `only ${l.stock} ${l.unit || ''} in stock`
    if (!(Number(l.rate) > 0)) return 'rate must be more than 0'
    if (Number(l.discountValue) < 0) return 'discount cannot be negative'
    if (l.discountMode !== 'amount' && Number(l.discountValue) > 100)
      return 'discount cannot be more than 100%'
    if (!(lineNet(l) > 0)) return 'net amount must be more than 0'
    return null
  }
  const cartProblems = cart
    .map((l) => ({ l, why: lineProblem(l) }))
    .filter((x) => x.why)
  // Credit bill with part-payment now: OK. Paid in full (or more) → it isn't a credit bill.
  const creditFullyPaid =
    isCredit && cart.length > 0 && tendered >= netTotal && netTotal > 0
  const cartBlocked = cartProblems.length > 0 || creditFullyPaid

  const runSearch = (value) => {
    setTerm(value)
    setActiveResult(0)
    setNavigated(false)
    clearTimeout(searchTimer.current)
    if (!value.trim()) {
      setResults([])
      setShowResults(false)
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await salesApi.searchItems({ term: value })
        // 0-stock products must never appear (or be selectable) in the search dropdown.
        setResults(r.filter((it) => Number(it.current_stock) > 0))
        setActiveResult(0)
        setShowResults(true)
      } catch (e) {
        setError(e.message)
      }
    }, 180)
  }

  const addItem = (it) => {
    if (Number(it.current_stock) <= 0) {
      setError(`${it.name} is out of stock.`)
      return
    }
    setError('')
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.itemId === it.id)
      if (idx >= 0) {
        if (prev[idx].qty + 1 > Number(it.current_stock) + 1e-9) {
          setError(
            `Only ${Number(it.current_stock)} ${it.unit || ''} of ${it.name} in stock.`
          )
          return prev
        }
        const copy = [...prev]
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }
        return copy
      }
      return [
        ...prev,
        {
          itemId: it.id,
          code: it.item_code,
          name: it.name,
          unit: it.unit,
          qty: 1,
          rate: Number(it.selling_price),
          discountMode: 'percent',
          discountValue: Number(it.discount_percent) || 0,
          stock: Number(it.current_stock),
          avgCost: Number(it.average_cost),
          // Low Stock Alert, or Reorder Qty as fallback (same rule as the Low Stock page)
          threshold: effectiveThreshold(it)
        }
      ]
    })
    setTerm('')
    setResults([])
    setShowResults(false)
    setActiveResult(0)
    setNavigated(false)
    searchRef.current?.focus()
  }

  const onSearchKey = async (e) => {
    // 🆕 Tab from the search box jumps straight to Amount Received —
    // skips Hold / Held / Last Bill / Previous Invoices so the cashier
    // can finish the sale without touching the mouse.
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      amountRef.current?.focus()
      return
    }

    // ↓ / ↑ move the highlight through the dropdown without touching the cursor.
    if (
      showResults &&
      results.length > 0 &&
      (e.key === 'ArrowDown' || e.key === 'ArrowUp')
    ) {
      e.preventDefault()
      setNavigated(true)
      setActiveResult((i) => {
        const max = results.length - 1
        if (e.key === 'ArrowDown') return i >= max ? 0 : i + 1
        return i <= 0 ? max : i - 1
      })
      return
    }
    if (e.key === 'Escape' && showResults) {
      setShowResults(false)
      return
    }
    if (e.key !== 'Enter') return

    // Operator arrowed to a specific row — that explicit pick wins.
    if (navigated && showResults && results.length > 0) {
      addItem(results[Math.min(activeResult, results.length - 1)])
      return
    }

    const code = term.trim()
    if (!code) {
      // khaali + Enter → seedha bill post (phir auto-print)
      if (
        !busy &&
        cart.length &&
        !cartBlocked &&
        !(isCredit && isWalkIn) &&
        !limitExceeded &&
        !discountInvalid &&
        (isCredit || tendered >= netTotal)
      )
        save()
      return
    }
    try {
      const exact = await salesApi.itemByCode({ code })
      if (exact) return addItem(exact)
      if (results.length) return addItem(results[0])
      setError(`No item matches "${code}".`)
    } catch (err) {
      setError(err.message)
    }
  }

  const updateLine = (itemId, field, value) =>
    setCart((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, [field]: value } : l))
    )
  const removeLine = (itemId) =>
    setCart((prev) => prev.filter((l) => l.itemId !== itemId))

  const removeLastLine = () => {
    setCart((prev) => (prev.length ? prev.slice(0, -1) : prev))
  }

  const resetSale = () => {
    setCart([])
    setOverallDiscount('')
    setDeliveryCharges('')
    setAmountReceived('')
    setRemarks('')
    setError('')
    setDueDate('')
    setSalesmanId(salesmen[0] ? String(salesmen[0].id) : '')
    setPaymentType('cash')
    const walkIn = customers.find((c) => c.is_walk_in)
    if (walkIn) setCustomerId(String(walkIn.id))
  }

  const newSale = () => {
    if (
      cart.length &&
      !window.confirm('Clear current cart and start a new sale?')
    )
      return
    resetSale()
    searchRef.current?.focus()
  }

  const openCustomerModal = async () => {
    setError('')
    let code = ''
    try {
      code = (await salesApi.nextCustomerCode()).code
    } catch {
      /* offline: leave blank */
    }
    setNewCust({
      code,
      name: '',
      telephone: '',
      address: '',
      creditLimit: '',
      openingBalance: ''
    })
    setCustModal(true)
  }

  const findByCode = async () => {
    const code = codeLookup.trim()
    if (!code) return
    setError('')
    try {
      const c = await salesApi.customerByCode({ code })
      if (!customers.some((x) => x.id === c.id))
        setCustomers(await salesApi.customers())
      setCustomerId(String(c.id))
      setCodeLookup('')
    } catch (e) {
      setError(e.message)
    }
  }

  const choosePayType = (t) => {
    setPaymentType(t)
    if (t !== 'credit') {
      const want = t === 'online' ? 'bank' : 'cash'
      const acc = accounts.find((a) => a.type === want) || accounts[0]
      if (acc) setAccountId(String(acc.id))
    }
    setAmountReceived('')
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      if (cart.length === 0) throw new Error('Add at least one item.')
      if (creditFullyPaid)
        throw new Error(
          'The whole bill is paid now — use Cash or Online instead of Credit.'
        )
      if (cartBlocked)
        throw new Error(
          'Fix these lines first: ' +
            cartProblems.map((x) => `${x.l.name} — ${x.why}`).join('; ')
        )
      // 🆕 discount guard — server also rejects net <= 0, fail fast in the UI
      if (discountInvalid)
        throw new Error(
          'Bill discount cannot wipe out the whole bill — net total must be greater than 0.'
        )
      if (limitExceeded) {
        throw new Error(
          `Cannot post: credit limit would be exceeded by Rs. ${Math.abs(availableCredit).toLocaleString('en-PK')}.`
        )
      }
      const res = await salesApi.create({
        invoiceType: 'counter',
        paymentType,
        customerId: Number(customerId),
        accountId: Number(accountId),
        overallDiscount: disc,
        deliveryCharges: delivery,
        amountReceived: tendered,
        remarks,
        createdBy: session?.id || null,
        salesmanId: salesmanId ? Number(salesmanId) : null,
        dueDate: paymentType === 'credit' && dueDate ? dueDate : null,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.qty),
          rate: Number(l.rate),
          discountMode: l.discountMode,
          discountValue: Number(l.discountValue) || 0,
          unit: l.unit,
          description: l.name
        }))
      })
      const smObj = salesmen.find((s) => String(s.id) === String(salesmanId))
      setReceipt({
        ...res,
        paymentType,
        salesman: smObj?.name || '—',
        operator: session?.fullName || session?.username || '—',
        customer: selectedCustomer?.name || 'Walk In Cash Customer',
        customerCode: selectedCustomer?.code,
        dateOnly: new Date().toLocaleDateString('en-GB'),
        timeOnly: new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        grossTotal: grossSubTotal,
        // item discounts + bill discount combined, so the receipt shows the full saving
        discountTotal: round2(itemDiscountTotal + disc),
        billDiscount: disc,
        itemDiscount: itemDiscountTotal,
        lines: cart.map((l) => ({ ...l, net: lineNet(l) }))
      })
      setLowAlert(res.lowStock || [])
      notifyStockChanged() // sidebar badge + Dashboard refresh now
      resetSale()
      const inv = await salesApi.nextInvoiceNo()
      setNextInvoiceNo(inv.invoiceNo)
      setAccounts(await salesApi.accounts())
      setCustomers(await salesApi.customers())
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const saveCustomer = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await salesApi.createCustomer(newCust)
      setCustomers(await salesApi.customers())
      setCustomerId(String(r.id))
      setCustModal(false)
      setNewCust({
        code: '',
        name: '',
        telephone: '',
        address: '',
        creditLimit: '',
        openingBalance: ''
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const buildSnapshot = () => ({
    lines: cart,
    customerId,
    paymentType,
    overallDiscount,
    deliveryCharges,
    remarks,
    salesmanId
  })

  const holdCurrent = async () => {
    setBusy(true)
    setError('')
    try {
      if (cart.length === 0) throw new Error('Cart is empty — nothing to hold.')
      await salesApi.hold({
        snapshot: buildSnapshot(),
        customerId: customerId ? Number(customerId) : null,
        customerName: selectedCustomer?.name || null,
        paymentType,
        netTotal,
        heldBy: session?.id || null
      })
      resetSale()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openHeld = async () => {
    setError('')
    try {
      setHeldBills(await salesApi.heldList({ actingUserId: session?.id }))
      setHeldModal(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const resumeHeld = async (id) => {
    setBusy(true)
    setError('')
    try {
      if (cart.length > 0) {
        const ok = window.confirm(
          'Current cart will be replaced by the held bill. Continue?'
        )
        if (!ok) {
          setBusy(false)
          return
        }
      }
      const { snapshot } = await salesApi.heldResume({
        id,
        actingUserId: session?.id
      })
      setCart(snapshot.lines || [])
      setCustomerId(
        snapshot.customerId ? String(snapshot.customerId) : customerId
      )
      setPaymentType(snapshot.paymentType || 'cash')
      setOverallDiscount(snapshot.overallDiscount || '')
      setDeliveryCharges(snapshot.deliveryCharges || '')
      setRemarks(snapshot.remarks || '')
      if (snapshot.salesmanId !== undefined) {
        setSalesmanId(snapshot.salesmanId ? String(snapshot.salesmanId) : '')
      }
      setAmountReceived('')
      setHeldModal(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const discardHeld = async (id) => {
    if (!window.confirm('Discard this held bill?')) return
    try {
      await salesApi.heldDelete({ id, actingUserId: session?.id })
      setHeldBills(await salesApi.heldList({ actingUserId: session?.id }))
    } catch (e) {
      setError(e.message)
    }
  }

  const openLastBill = async () => {
    setError('')
    try {
      const { id } = await salesApi.neighbor({ direction: 'prev' })
      if (!id) throw new Error('No invoices saved yet.')
      setBrowser({ openId: id })
    } catch (e) {
      setError(e.message)
    }
  }

  // A previous bill was edited / cancelled → balances and account totals changed.
  const afterInvoiceChanged = () => {
    salesApi
      .accounts()
      .then(setAccounts)
      .catch(() => {})
    salesApi
      .customers()
      .then(setCustomers)
      .catch(() => {})
  }

  const quickChangeQr = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
      setError('Please choose a PNG or JPG image.')
      return
    }
    if (f.size > 1.5 * 1024 * 1024) {
      setError('Image too large — please use one under 1.5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        setBusy(true)
        await companyApi.updateProfile({
          actingUserId: session.id,
          receiptHeader: profile?.receipt_header,
          receiptTagline: profile?.receipt_tagline,
          receiptFooter: profile?.receipt_footer,
          phone: profile?.phone,
          paymentQrImage: reader.result
        })
        setProfile(await companyApi.getProfile())
      } catch (err) {
        setError(err.message)
      } finally {
        setBusy(false)
      }
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f3: () => custLookupRef.current?.focus(),
      f4: () => {
        amountRef.current?.focus() // credit too: money paid now, the rest goes on credit
      },
      f5: () => {
        if (!busy) loadRefData().catch((e) => setError(e.message))
      },
      f7: () => setBrowser({ openId: null }),
      'alt+arrowleft': () => openLastBill(),
      f8: () => {
        if (!busy) newSale()
      },
      f9: () => {
        if (busy || !cart.length || cartBlocked) return
        if (isCredit && isWalkIn) return
        if (limitExceeded) return
        if (discountInvalid) return
        if (!isCredit && tendered < netTotal) return
        save()
      },
      s: () => {
        if (busy || !cart.length || cartBlocked) return
        if (isCredit && isWalkIn) return
        if (limitExceeded) return
        if (discountInvalid) return
        if (!isCredit && tendered < netTotal) return
        save()
      },
      h: () => {
        if (busy || !cart.length) return
        holdCurrent()
      },
      p: () => {
        if (receipt)
          printReceiptElement('receipt', {
            printerName: receiptPrinter || undefined
          })
      },
      // 📍 PIN #3 — `enter:` handler hata diya — ab useEnterKey (upar) handle karta hai
      f6: () => {
        if (isCredit) return
        setAmountReceived(String(netTotal))
        amountRef.current?.focus()
      },
      'alt+1': () => choosePayType('cash'),
      'alt+2': () => choosePayType('online'),
      'alt+3': () => choosePayType('credit'),
      'alt+4': () => salesmanRef.current?.focus(),
      'alt+5': () => discountRef.current?.focus(), // 🆕 bill discount focus
      escape: () => {
        if (receipt) setReceipt(null)
        else if (custModal) setCustModal(false)
        else if (heldModal) setHeldModal(false)
      },
      delete: () => {
        if (receipt || custModal || heldModal) return
        removeLastLine()
      }
    },
    [
      busy,
      cart,
      receipt,
      custModal,
      heldModal,
      customerId,
      accountId,
      paymentType,
      amountReceived,
      salesmanId,
      isCredit,
      isWalkIn,
      tendered,
      netTotal,
      limitExceeded,
      cartBlocked,
      discountInvalid,
      receiptPrinter
    ]
  )

  return (
    <div className="sale-layout">
      <div className="sale-left panel">
        {/* Search on the left, invoice hint + bill buttons on the right. The toolbar wraps
            to its own line only when the panel is too narrow — nothing is squeezed or pushed
            off-screen. The dropdown hangs off the search box itself. */}
        <div className="sale-searchbar">
          <div className="sale-search-wrap">
            <div className="search-box grow">
              <Icon name="search" size={16} />
              <input
                ref={searchRef}
                autoFocus
                value={term}
                placeholder="Scan barcode or search item by name / code, then Enter"
                onChange={(e) => runSearch(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </div>

            {showResults && results.length > 0 && (
              <div className="search-results sale-search-results">
                {results.map((r, i) => (
                  <div
                    key={r.id}
                    ref={(el) => (resultRefs.current[i] = el)}
                    className={'sr-row' + (i === activeResult ? ' active' : '')}
                    onMouseEnter={() => setActiveResult(i)}
                    onClick={() => addItem(r)}
                  >
                    <span className="sr-code">{r.item_code}</span>
                    <span className="sr-name">{r.name}</span>
                    <span className="sr-stock">
                      {Number(r.current_stock)} {r.unit}
                    </span>
                    <span className="sr-price">{fmt(r.selling_price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sale-toolbar">
            <span className="inv-no-hint">
              Next<span className="lbl-long"> Invoice</span>&nbsp;
              <strong>#{nextInvoiceNo}</strong>
            </span>
            <button
              className="btn-sm ghost"
              onClick={holdCurrent}
              disabled={busy || cart.length === 0}
              title="Park this bill for later (Ctrl+H)"
            >
              <Icon name="pause" size={15} /> Hold
            </button>
            <button
              className="btn-sm ghost"
              onClick={openHeld}
              title="Resume a held bill"
            >
              <Icon name="receipt" size={15} /> Held
            </button>
            <button
              className="btn-sm ghost"
              onClick={openLastBill}
              title="Open the last saved bill — then ← → for previous / next (Alt+←)"
            >
              ◀ Last Bill
            </button>
            <button
              className="btn-sm ghost"
              onClick={() => setBrowser({ openId: null })}
              title="Search, open, edit and reprint saved invoices (F7)"
            >
              <Icon name="book" size={15} />{' '}
              <span className="lbl-long">Previous </span>Invoices
            </button>
          </div>
        </div>

        {cartProblems.length > 0 && (
          <div className="lowstock-banner" role="alert">
            <Icon name="alert" size={15} /> Cannot post yet:&nbsp;
            {cartProblems.map((x) => `${x.l.name} — ${x.why}`).join(', ')}
          </div>
        )}
        {creditFullyPaid && (
          <div className="lowstock-banner" role="alert">
            <Icon name="alert" size={15} /> The whole bill is paid now — choose
            Cash or Online instead of Credit (or enter less in &quot;Paid
            Now&quot;).
          </div>
        )}
        {discountInvalid && !cartProblems.length && !creditFullyPaid && (
          <div className="lowstock-banner" role="alert">
            <Icon name="alert" size={15} /> Bill discount is too large — the net
            total must stay above Rs. 0.
          </div>
        )}
        {lowInCart.length > 0 && (
          <div className="lowstock-banner">
            <Icon name="alert" size={15} /> Low stock after this bill:&nbsp;
            {lowInCart
              .map(
                (l) =>
                  `${l.name} (${l.stock} → ${l.after} left, alert at ${l.threshold})`
              )
              .join(', ')}
          </div>
        )}
        {lowAlert.length > 0 && (
          <div className="lowstock-banner lowstock-after" role="alert">
            <Icon name="alert" size={15} />
            <span>
              <strong>Low stock — reorder:</strong>{' '}
              {lowAlert
                .map(
                  (l) => `${l.name} (${l.stock} left, alert at ${l.threshold})`
                )
                .join(', ')}
            </span>
            <button
              type="button"
              className="btn-icon"
              title="Dismiss"
              onClick={() => setLowAlert([])}
              style={{ marginLeft: 'auto', padding: 2 }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="cart-scroll">
          <table className="data-table cart-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Discount</th>
                <th className="num">Net</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty">
                    Cart is empty — scan or search an item to begin
                  </td>
                </tr>
              ) : (
                cart.map((l) => (
                  <tr
                    key={l.itemId}
                    className={lineProblem(l) ? 'row-warn' : ''}
                  >
                    <td>{l.code}</td>
                    <td>
                      {l.name}
                      {l.qty > l.stock && (
                        <span className="warn-tag">stock {l.stock}</span>
                      )}
                      {l.threshold > 0 && Number(l.stock) <= l.threshold && (
                        <span className="low-tag">low · {l.stock} left</span>
                      )}
                    </td>
                    <td className="num">
                      <input
                        className="cell-input"
                        type="number"
                        min="1"
                        value={l.qty}
                        onChange={(e) =>
                          updateLine(l.itemId, 'qty', Number(e.target.value))
                        }
                      />
                    </td>
                    <td className="num">
                      <input
                        className="cell-input"
                        type="number"
                        min="0"
                        value={l.rate}
                        onChange={(e) =>
                          updateLine(l.itemId, 'rate', Number(e.target.value))
                        }
                      />
                    </td>
                    <td className="num">
                      <div className="disc-cell">
                        <input
                          className="cell-input sm"
                          type="number"
                          min="0"
                          value={l.discountValue}
                          onChange={(e) =>
                            updateLine(
                              l.itemId,
                              'discountValue',
                              Number(e.target.value)
                            )
                          }
                        />
                        <button
                          type="button"
                          className="disc-mode"
                          title="Toggle % or Rs"
                          onClick={() =>
                            updateLine(
                              l.itemId,
                              'discountMode',
                              l.discountMode === 'amount' ? 'percent' : 'amount'
                            )
                          }
                        >
                          {l.discountMode === 'amount' ? 'Rs' : '%'}
                        </button>
                      </div>
                      {lineDiscAmt(l) > 0 && (
                        <span className="disc-amt">-{fmt(lineDiscAmt(l))}</span>
                      )}
                    </td>
                    <td className="num strong">{fmt(lineNet(l))}</td>
                    <td className="num">
                      <button
                        className="btn-icon danger"
                        onClick={() => removeLine(l.itemId)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sale-bottom-bar">
          <div className="sbb-group">
            <span className="sbb-label">Net Total</span>
            <strong className="sbb-value">{fmt(netTotal)}</strong>
          </div>

          <div className="sbb-group">
            <span className="sbb-label">
              {isCredit ? 'Paid Now (optional)' : 'Amount Received'}
            </span>
            <div className="sbb-received">
              <input
                ref={amountRef}
                className="tot-input sbb-input"
                type="number"
                min="0"
                value={amountReceived}
                placeholder={isCredit ? '0' : ''}
                onChange={(e) => setAmountReceived(e.target.value)}
                onKeyDown={(e) => {
                  // 🆕 Tab from Amount Received → Exact (or Post Sale in credit mode).
                  // We only preventDefault when there IS a focusable target,
                  // otherwise the browser default keeps Tab working normally.
                  if (e.key === 'Tab' && !e.shiftKey) {
                    const target = !isCredit
                      ? exactBtnRef.current
                      : postSaleBtnRef.current
                    if (target && !target.disabled) {
                      e.preventDefault()
                      target.focus()
                    }
                    return
                  }
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (busy || !cart.length || cartBlocked) return
                  if (isCredit && isWalkIn) return
                  if (limitExceeded) return
                  if (discountInvalid) return
                  if (!isCredit && tendered < netTotal) return
                  save()
                }}
                title="F4 to focus · Enter posts the sale"
              />
              {!isCredit && (
                <button
                  ref={exactBtnRef}
                  type="button"
                  className="sbb-exact"
                  onKeyDown={(e) => {
                    // 🆕 Tab from Exact → Post Sale (skips Remarks + Clear).
                    if (e.key === 'Tab' && !e.shiftKey) {
                      const target = postSaleBtnRef.current
                      if (target && !target.disabled) {
                        e.preventDefault()
                        target.focus()
                      }
                    }
                  }}
                  onClick={() => {
                    setAmountReceived(String(netTotal))
                    amountRef.current?.focus()
                  }}
                  title="F6"
                >
                  Exact
                </button>
              )}
            </div>
          </div>

          <div className="sbb-group">
            <span className="sbb-label">
              {isCredit
                ? 'Going on Credit'
                : tendered >= netTotal
                  ? 'Return to Customer'
                  : 'Amount Due'}
            </span>
            <strong
              className={
                'sbb-value ' + (isCredit || tendered < netTotal ? 'neg' : 'pos')
              }
            >
              {isCredit
                ? fmt(outstanding)
                : fmt(change || round2(netTotal - tendered))}
            </strong>
          </div>

          <input
            className="remark-input sbb-remarks"
            placeholder="Remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          <div className="sbb-actions">
            <button
              className="btn-secondary"
              onClick={resetSale}
              disabled={busy}
              title="Clear cart (F8)"
            >
              Clear
            </button>
            <button
              ref={postSaleBtnRef}
              className="btn-primary"
              onClick={save}
              disabled={
                busy ||
                cart.length === 0 ||
                cartBlocked ||
                discountInvalid ||
                (isCredit && isWalkIn) ||
                limitExceeded ||
                (!isCredit && tendered < netTotal)
              }
              title="Post Sale (F9 / Ctrl+S)"
            >
              <Icon name="check" size={16} /> {busy ? 'Posting…' : 'Post Sale'}
            </button>
          </div>
        </div>

        {error && (
          <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}
      </div>

      <div className="sale-right panel">
        <h3 className="sale-title">
          <Icon name="cart" size={18} /> Counter Sale
        </h3>

        <div className="field">
          <span className="field-label">Payment Type</span>
          <div className="pay-type-group">
            <button
              type="button"
              className={
                'pay-type-btn' + (paymentType === 'cash' ? ' active cash' : '')
              }
              onClick={() => choosePayType('cash')}
              title="Alt+1"
            >
              Cash
            </button>
            <button
              type="button"
              className={
                'pay-type-btn' +
                (paymentType === 'online' ? ' active online' : '')
              }
              onClick={() => choosePayType('online')}
              title="Alt+2"
            >
              Online
            </button>
            <button
              type="button"
              className={
                'pay-type-btn' +
                (paymentType === 'credit' ? ' active credit' : '')
              }
              onClick={() => choosePayType('credit')}
              title="Alt+3"
            >
              Credit
            </button>
          </div>
        </div>

        <label className="field">
          <span>Customer</span>
          <div className="inline-field">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.code}
                  {c.is_walk_in
                    ? ''
                    : ` (Bal: ${Number(c.current_balance).toLocaleString('en-PK')})`}
                </option>
              ))}
            </select>
            <button
              className="btn-icon"
              title="New customer"
              onClick={openCustomerModal}
            >
              <Icon name="user" size={16} />
            </button>
          </div>
          <div className="code-lookup-row">
            <input
              ref={custLookupRef}
              className="code-lookup"
              placeholder="Find by customer code… (F3)"
              value={codeLookup}
              onChange={(e) => setCodeLookup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && findByCode()}
            />
            <button
              type="button"
              className="btn-icon"
              title="Lookup"
              onClick={findByCode}
            >
              <Icon name="search" size={15} />
            </button>
          </div>
        </label>

        <label className="field">
          <span>
            Salesman <em className="hint-em">(billing staff — Alt+4)</em>
          </span>
          <select
            ref={salesmanRef}
            value={salesmanId}
            onChange={(e) => setSalesmanId(e.target.value)}
          >
            <option value="">— None —</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.phone ? ` · ${s.phone}` : ''}
              </option>
            ))}
          </select>
        </label>

        {isCredit && !isWalkIn && (
          <label className="field">
            <span>
              Promise to pay by{' '}
              <em className="hint-em">(due date — optional)</em>
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        )}

        {isCredit && (
          <div
            className={
              'cust-card' +
              (isWalkIn || limitExceeded ? ' bad' : '') +
              (limitExceeded ? ' limit-warn' : '')
            }
          >
            {isWalkIn ? (
              <span>
                Pick a named customer above — credit can't be given to Walk-In.
              </span>
            ) : (
              <>
                <div className="cc-row">
                  <span>Customer</span>
                  <strong>{selectedCustomer?.name}</strong>
                </div>
                <div className="cc-row">
                  <span>Code</span>
                  <strong>{selectedCustomer?.code}</strong>
                </div>
                <div className="cc-row">
                  <span>Phone</span>
                  <strong>{selectedCustomer?.telephone || '—'}</strong>
                </div>
                <div className="cc-row">
                  <span>Existing Balance</span>
                  <strong>{fmt(currentBalance)}</strong>
                </div>
                <div className="cc-row">
                  <span>Credit Limit</span>
                  <strong>
                    {creditLimit > 0 ? fmt(creditLimit) : 'No limit'}
                  </strong>
                </div>
                {creditLimit > 0 && (
                  <>
                    <div className="cc-row">
                      <span>Available (after this sale)</span>
                      <strong className={availableCredit < 0 ? 'neg' : 'pos'}>
                        {fmt(Math.max(0, availableCredit))}
                      </strong>
                    </div>
                    {limitExceeded && (
                      <div className="limit-warn-badge">
                        ⚠ Limit exceeded by {fmt(Math.abs(availableCredit))} —
                        sale blocked
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        <label className="field">
          <span>Payment Account</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.type})
              </option>
            ))}
          </select>
        </label>

        {/* 📍 Receipt printer dropdown — independent of the Zebra label printer.
            Empty value = auto-pick BLACK COPPER (fallback in printReceipt.js). */}
        <label className="field">
          <span>Receipt Printer</span>
          <select
            value={receiptPrinter}
            onChange={(e) => {
              setReceiptPrinter(e.target.value)
              localStorage.setItem('receiptPrinter', e.target.value)
            }}
          >
            <option value="">Auto (BLACK COPPER)</option>
            {printers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="totals">
          <div className="tot-row">
            <span>Sub Total</span>
            <strong>{fmt(grossSubTotal)}</strong>
          </div>
          <div className="tot-row">
            <span>Item Discounts</span>
            <strong className="neg">-{fmt(itemDiscountTotal)}</strong>
          </div>

          {/* 🆕 Bill-level discount — applied after item discounts, before delivery.
              Same field also editable on the bottom bar's Net Total via Alt+5. */}
          <div className="tot-row">
            <span>
              Bill Discount <em className="hint-em">(Rs. — Alt+5)</em>
            </span>
            <input
              ref={discountRef}
              className="tot-input"
              type="number"
              min="0"
              step="0.01"
              value={overallDiscount}
              onChange={(e) => setOverallDiscount(e.target.value)}
              placeholder="0"
              title="Discount on the whole bill, applied after item-level discounts"
              style={{ width: 110, textAlign: 'right' }}
            />
          </div>

          <div className="tot-row net">
            <span>Net Total</span>
            <strong>{fmt(netTotal)}</strong>
          </div>
        </div>

        <div className="hotkey-hint">
          <div className="hk-group">
            <span className="hk-title">Search</span>
            <span>
              <kbd>F2</kbd> Focus search
            </span>
            <span>
              <kbd>↓</kbd>
              <kbd>↑</kbd> Move
            </span>
            <span>
              <kbd>Enter</kbd> Add item
            </span>
            <span>
              <kbd>Tab</kbd> → Amount
            </span>
          </div>
          <div className="hk-group">
            <span className="hk-title">Customer</span>
            <span>
              <kbd>F3</kbd> Find by code
            </span>
            <span>
              <kbd>Alt</kbd>+<kbd>4</kbd> Salesman
            </span>
          </div>
          <div className="hk-group">
            <span className="hk-title">Payment type</span>
            <span>
              <kbd>Alt</kbd>+<kbd>1</kbd> Cash
            </span>
            <span>
              <kbd>Alt</kbd>+<kbd>2</kbd> Online
            </span>
            <span>
              <kbd>Alt</kbd>+<kbd>3</kbd> Credit
            </span>
          </div>
          <div className="hk-group">
            <span className="hk-title">Amount</span>
            <span>
              <kbd>F4</kbd> Focus field
            </span>
            <span>
              <kbd>F6</kbd> Exact
            </span>
            <span>
              <kbd>Alt</kbd>+<kbd>5</kbd> Bill discount
            </span>
            <span>
              <kbd>Tab</kbd> → Exact / Post
            </span>
            <span>
              <kbd>Enter</kbd> Post sale
            </span>
          </div>
          <div className="hk-group">
            <span className="hk-title">Bill</span>
            <span>
              <kbd>F9</kbd> Post sale
            </span>
            <span>
              <kbd>Ctrl</kbd>+<kbd>H</kbd> Hold
            </span>
            <span>
              <kbd>F8</kbd> New sale
            </span>
            <span>
              <kbd>F7</kbd> Previous invoices
            </span>
            <span>
              <kbd>Alt</kbd>+<kbd>←</kbd> Last bill
            </span>
            <span>
              <kbd>Del</kbd> Undo line
            </span>
            <span>
              <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
            </span>
            <span>
              <kbd>Esc</kbd> Close
            </span>
          </div>
        </div>
      </div>

      {custModal && (
        <Modal
          title="New Customer"
          width={540}
          onClose={() => setCustModal(false)}
          footer={
            <>
              <button
                className="btn-secondary"
                onClick={() => setCustModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveCustomer}
                disabled={busy}
              >
                Save
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <div className="field-row">
            <label className="field">
              <span>Customer Code</span>
              <input
                value={newCust.code}
                onChange={(e) =>
                  setNewCust({ ...newCust, code: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>
                Telephone <em className="hint-em">(not printed)</em>
              </span>
              <input
                value={newCust.telephone}
                onChange={(e) =>
                  setNewCust({ ...newCust, telephone: e.target.value })
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Name</span>
            <input
              autoFocus
              value={newCust.name}
              onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>
              Address <em className="hint-em">(optional)</em>
            </span>
            <input
              value={newCust.address}
              onChange={(e) =>
                setNewCust({ ...newCust, address: e.target.value })
              }
              placeholder="e.g. Faisal Bazar No 2, Sadiqabad"
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Opening Balance (receivable)</span>
              <input
                type="number"
                value={newCust.openingBalance}
                onChange={(e) =>
                  setNewCust({ ...newCust, openingBalance: e.target.value })
                }
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>
                Credit Limit <em className="hint-em">(0 = no limit)</em>
              </span>
              <input
                type="number"
                min="0"
                value={newCust.creditLimit}
                onChange={(e) =>
                  setNewCust({ ...newCust, creditLimit: e.target.value })
                }
                placeholder="0"
              />
            </label>
          </div>
          <p className="muted-text">
            Code is filled automatically but you can type your own — it must be
            unique. Credit limit applies only to credit-type sales.
          </p>
        </Modal>
      )}

      {/* Receipt sirf print ke liye off-screen — koi dialog/preview nahi dikhta */}
      {receipt && (
        <div
          style={{ position: 'fixed', left: '-99999px', top: 0 }}
          aria-hidden="true"
        >
          <Receipt data={receipt} profile={profile} />
        </div>
      )}

      {browser && (
        <InvoiceBrowser
          openId={browser.openId}
          onClose={() => setBrowser(null)}
          onChanged={afterInvoiceChanged}
        />
      )}

      {heldModal && (
        <Modal
          title="Held Bills"
          width={560}
          onClose={() => setHeldModal(false)}
          footer={
            <button
              className="btn-secondary"
              onClick={() => setHeldModal(false)}
            >
              Close
            </button>
          }
        >
          {error && <div className="login-error">{error}</div>}
          {heldBills.length === 0 ? (
            <div className="inv-empty">No held bills right now</div>
          ) : (
            <div className="held-list">
              {heldBills.map((h) => (
                <div key={h.id} className="held-row">
                  <div className="held-info">
                    <strong>
                      {h.customer_name || 'Walk-In'} · {fmt(h.net_total)}
                    </strong>
                    <span className="muted-text">
                      {h.payment_type} ·{' '}
                      {/* the server sends created_at (held_at never existed → "Invalid Date") */}
                      {h.created_at
                        ? new Date(
                            String(h.created_at).replace(' ', 'T')
                          ).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '—'}
                    </span>
                  </div>
                  <div className="held-actions">
                    <button
                      className="btn-sm"
                      onClick={() => resumeHeld(h.id)}
                      disabled={busy}
                    >
                      Resume
                    </button>
                    <button
                      className="btn-sm danger"
                      onClick={() => discardHeld(h.id)}
                      disabled={busy}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
