import pool from '../db/pool.js'
import { postStockMovement } from '../services/stock.service.js'
import { authorize, ADMIN_ROLES } from '../services/auth.guard.js'
import {
  postVendorLedger,
  payVendor,
  receiveFromVendor,
  createBill,
  deleteBill,
  deletePayment,
  vendorLedger,
  editBill,
  createReturn,
  deleteReturn,
  billDetail
} from '../services/vendor.service.js'

import { localToday } from '../services/date.util.js'
const today = () => localToday()

async function nextSerial(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(serial_no, 'PO-', '') AS UNSIGNED)), 0) + 1 AS next
       FROM purchase_orders WHERE serial_no LIKE 'PO-%'`
  )
  return 'PO-' + String(r.next).padStart(4, '0')
}
async function nextPaymentVoucherNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no, 'PV-', '') AS UNSIGNED)), 0) + 1 AS next
       FROM vouchers WHERE voucher_type = 'payment' AND voucher_no LIKE 'PV-%'`
  )
  return 'PV-' + String(r.next).padStart(3, '0')
}

// Shared receive logic — used by create(receiveNow) and the receive handler.
async function doReceive(
  conn,
  poId,
  { accountId = null, amountPaid = 0, createdBy = null, date = null }
) {
  const [[po]] = await conn.query(
    `SELECT * FROM purchase_orders WHERE id = ?`,
    [poId]
  )
  if (!po) throw new Error('Purchase order not found.')
  if (po.status === 'received')
    throw new Error('This purchase order is already received.')
  if (po.status === 'cancelled')
    throw new Error('This purchase order was cancelled.')

  const recvDate = date || po.order_date || today()
  const [items] = await conn.query(
    `SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`,
    [poId]
  )
  if (items.length === 0) throw new Error('This order has no line items.')

  // Stock in at purchase rate → recomputes weighted-average cost. Refresh last purchase price.
  for (const li of items) {
    await postStockMovement(conn, {
      itemId: li.item_id,
      movementType: 'purchase',
      quantityIn: Number(li.quantity),
      unitCost: Number(li.rate),
      referenceType: 'purchase',
      referenceId: poId,
      movementDate: recvDate
    })
    await conn.query(`UPDATE items SET purchase_price = ? WHERE id = ?`, [
      li.rate,
      li.item_id
    ])
  }

  const total = Number(po.total_incl_tax)
  // Full amount becomes payable to the vendor…
  if (po.vendor_id) {
    await conn.query(
      `UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?`,
      [total, po.vendor_id]
    )
    // …and appears in the vendor ledger (so ledger = vendor balance)
    await postVendorLedger(conn, { vendorId: po.vendor_id, date: recvDate, entryType: 'bill',
      referenceType: 'purchase', referenceId: poId, debit: total, createdBy,
      description: `Bill ${po.serial_no} (received order)` })
  }
  await conn.query(
    `UPDATE purchase_orders SET status = 'received' WHERE id = ?`,
    [poId]
  )

  // …then any payment made now reduces both the account and the payable.
  let paid = 0
  const wantPaid = Number(amountPaid) || 0
  if (wantPaid > 0 && accountId) {
    paid = +Math.min(wantPaid, total).toFixed(2)
    const [[acct]] = await conn.query(
      `SELECT type FROM accounts WHERE id = ?`,
      [accountId]
    )
    const method = acct?.type === 'bank' ? 'bank' : 'cash'
    const vno = await nextPaymentVoucherNo(conn)
    const [pres] = await conn.query(
      `INSERT INTO vouchers
         (voucher_no, voucher_type, party_type, party_id, account_id, amount,
          payment_method, reference, purchase_order_id, description, voucher_date, created_by)
       VALUES (?, 'payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vno,
        po.vendor_id ? 'vendor' : 'none',
        po.vendor_id || null,
        accountId,
        paid,
        method,
        po.serial_no,
        poId,
        `Purchase payment — ${po.serial_no}`,
        recvDate,
        createdBy
      ]
    )
    await conn.query(
      `UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`,
      [paid, accountId]
    )
    if (po.vendor_id) {
      await conn.query(
        `UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?`,
        [paid, po.vendor_id]
      )
      await postVendorLedger(conn, { vendorId: po.vendor_id, date: recvDate, entryType: 'payment',
        referenceType: 'voucher', referenceId: pres.insertId, credit: paid, createdBy,
        description: `${vno} · Purchase payment — ${po.serial_no}` })
    }
  }
  return {
    received: true,
    total,
    paid,
    outstanding: +(total - paid).toFixed(2)
  }
}

export function registerPurchasesHandlers(ipcMain) {
  ipcMain.handle('purchases:vendors', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT id, code, name, telephone, address, gst_reg_no, ntn, current_balance
           FROM vendors WHERE is_active = 1 ORDER BY name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('purchases:create-vendor', async (_e, p) => {
    try {
      if (!p.name || !p.name.trim())
        return { ok: false, error: 'Vendor name is required.' }
      const [[r]] = await pool.query(
        `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 13001000) + 1 AS next FROM vendors`
      )
      const code = String(r.next)
      const bal = Number(p.openingBalance) || 0
      const [res] = await pool.query(
        `INSERT INTO vendors (code, name, telephone, address, gst_reg_no, ntn, opening_balance, current_balance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          p.name.trim(),
          p.telephone || null,
          p.address || null,
          p.gstRegNo || null,
          p.ntn || null,
          bal,
          bal
        ]
      )
      // An old balance owed to this vendor starts the ledger (keeps ledger = balance)
      if (bal !== 0)
        await postVendorLedger(pool, { vendorId: res.insertId, entryType: 'opening',
          debit: Math.max(bal, 0), credit: Math.max(-bal, 0), description: 'Opening balance' })
      return { ok: true, data: { id: res.insertId, code } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('purchases:accounts', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT id, name, type, current_balance FROM accounts WHERE is_active = 1 ORDER BY type, name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('purchases:search-items', async (_e, { term }) => {
    try {
      const s = `%${(term || '').trim()}%`
      const [rows] = await pool.query(
        `SELECT id, item_code, name, unit, purchase_price, current_stock, barcode
           FROM items
          WHERE is_active = 1 AND (name LIKE ? OR item_code LIKE ? OR barcode LIKE ?)
          ORDER BY name LIMIT 25`,
        [s, s, s]
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('purchases:next-serial', async () => {
    try {
      return { ok: true, data: { serial: await nextSerial(pool) } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ---------------- Create PO (optionally receive in the same transaction) ----------------
  ipcMain.handle('purchases:create', async (_e, payload) => {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const {
        vendorId,
        orderDate,
        deliveryDate,
        termsOfPayment,
        jobDescription,
        employeeReference,
        termsConditions,
        remarks,
        lines = [],
        receiveNow = false,
        accountId = null,
        amountPaid = 0,
        createdBy = null
      } = payload

      if (!vendorId) throw new Error('Select a vendor.')
      if (!Array.isArray(lines) || lines.length === 0)
        throw new Error('Add at least one item.')

      let subTotal = 0,
        gstTotal = 0
      const resolved = []
      for (const ln of lines) {
        const [[it]] = await conn.query(
          `SELECT id, name, unit FROM items WHERE id = ? AND is_active = 1`,
          [ln.itemId]
        )
        if (!it) throw new Error(`Item not found (id ${ln.itemId}).`)
        const qty = Number(ln.quantity) || 0
        const rate = Number(ln.rate) || 0
        if (qty <= 0)
          throw new Error(`Quantity must be greater than 0 for ${it.name}.`)
        const amount = +(qty * rate).toFixed(2)
        const gstRate = Number(ln.gstRate) || 0
        const gstAmt = +((amount * gstRate) / 100).toFixed(2)
        const valueIncl = +(amount + gstAmt).toFixed(2)
        subTotal += amount
        gstTotal += gstAmt
        resolved.push({
          it,
          qty,
          rate,
          amount,
          gstRate,
          gstAmt,
          valueIncl,
          unit: ln.unit || it.unit,
          description: ln.description || it.name
        })
      }
      subTotal = +subTotal.toFixed(2)
      gstTotal = +gstTotal.toFixed(2)
      const total = +(subTotal + gstTotal).toFixed(2)

      const date = orderDate || today()
      const serial = await nextSerial(conn)
      const status = receiveNow ? 'received' : 'ordered'

      const [poRes] = await conn.query(
        `INSERT INTO purchase_orders
           (serial_no, vendor_id, order_date, delivery_date, terms_of_payment, job_description,
            employee_reference, sub_total, gst_amount, total_incl_tax, status, terms_conditions, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serial,
          vendorId,
          date,
          deliveryDate || null,
          termsOfPayment || null,
          jobDescription || null,
          employeeReference || null,
          subTotal,
          gstTotal,
          total,
          status,
          termsConditions || null,
          remarks || null,
          createdBy
        ]
      )
      const poId = poRes.insertId

      for (const r of resolved) {
        await conn.query(
          `INSERT INTO purchase_order_items
             (purchase_order_id, item_id, description, quantity, unit, rate, amount,
              gst_rate, gst_amount, value_incl_tax)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            poId,
            r.it.id,
            r.description,
            r.qty,
            r.unit,
            r.rate,
            r.amount,
            r.gstRate,
            r.gstAmt,
            r.valueIncl
          ]
        )
      }

      let recv = null
      if (receiveNow)
        recv = await doReceive(conn, poId, {
          accountId,
          amountPaid,
          createdBy,
          date
        })

      await conn.commit()
      return {
        ok: true,
        data: {
          poId,
          serial,
          subTotal,
          gstTotal,
          total,
          status,
          ...(recv || {})
        }
      }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // ---------------- Receive an existing (ordered) PO ----------------
  ipcMain.handle(
    'purchases:receive',
    async (_e, { id, accountId = null, amountPaid = 0, createdBy = null }) => {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const result = await doReceive(conn, id, {
          accountId,
          amountPaid,
          createdBy
        })
        await conn.commit()
        return { ok: true, data: result }
      } catch (err) {
        await conn.rollback()
        return { ok: false, error: err.message }
      } finally {
        conn.release()
      }
    }
  )

  ipcMain.handle('purchases:list', async (_e, params) => {
    try {
      const { limit = 50 } = params || {}
      const [rows] = await pool.query(
        `SELECT p.id, p.serial_no, p.order_date, p.delivery_date, p.status,
                p.sub_total, p.gst_amount, p.total_incl_tax, v.name AS vendor
           FROM purchase_orders p
           LEFT JOIN vendors v ON v.id = p.vendor_id
          ORDER BY p.id DESC LIMIT ?`,
        [Number(limit)]
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('purchases:get', async (_e, { id }) => {
    try {
      const [[po]] = await pool.query(
        `SELECT p.*, v.name AS vendor, v.gst_reg_no AS vendor_gst, v.ntn AS vendor_ntn
           FROM purchase_orders p LEFT JOIN vendors v ON v.id = p.vendor_id
          WHERE p.id = ?`,
        [id]
      )
      if (!po) return { ok: false, error: 'Purchase order not found.' }
      const [items] = await pool.query(
        `SELECT poi.*, i.item_code FROM purchase_order_items poi
           LEFT JOIN items i ON i.id = poi.item_id WHERE poi.purchase_order_id = ?`,
        [id]
      )
      return { ok: true, data: { ...po, items } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ================= Vendor account book (bills, payments, ledger) =================
  const tx = async (fn) => {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const data = await fn(conn)
      await conn.commit()
      return { ok: true, data }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: err.message }
    } finally {
      conn.release()
    }
  }

  ipcMain.handle('purchases:update-vendor', async (_e, p) => {
    try {
      await authorize(p.actingUserId, ADMIN_ROLES)
      if (!p.name || !p.name.trim()) return { ok: false, error: 'Vendor name is required.' }
      await pool.query(
        `UPDATE vendors SET name = ?, telephone = ?, address = ?, gst_reg_no = ?, ntn = ? WHERE id = ?`,
        [p.name.trim(), p.telephone || null, p.address || null, p.gstRegNo || null, p.ntn || null, p.id]
      )
      return { ok: true, data: { id: p.id } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // New purchase bill (typed product lines or amount only; optional stock; optional pay now)
  ipcMain.handle('purchases:create-bill', async (_e, p) =>
    tx(async (conn) => {
      await authorize(p.actingUserId, ADMIN_ROLES)
      return createBill(conn, { ...p, createdBy: p.actingUserId })
    })
  )

  // Pay a vendor any time (cash in hand or online/bank), in parts
  ipcMain.handle('purchases:pay-vendor', async (_e, p) =>
    tx(async (conn) => {
      await authorize(p.actingUserId, ADMIN_ROLES)
      return payVendor(conn, { ...p, createdBy: p.actingUserId })
    })
  )

  // Vendor owes us (balance below 0) and pays the money back
  ipcMain.handle('purchases:receive-from-vendor', async (_e, p) =>
    tx(async (conn) => {
      const user = await authorize(p.actingUserId, ADMIN_ROLES)
      return receiveFromVendor(conn, { ...p, createdBy: user.id })
    })
  )

  ipcMain.handle('purchases:delete-vendor-payment', async (_e, { actingUserId, voucherId }) =>
    tx(async (conn) => {
      await authorize(actingUserId, ADMIN_ROLES)
      return deletePayment(conn, voucherId)
    })
  )

  ipcMain.handle('purchases:delete-bill', async (_e, { actingUserId, id }) =>
    tx(async (conn) => {
      await authorize(actingUserId, ADMIN_ROLES)
      return deleteBill(conn, id)
    })
  )

  ipcMain.handle('purchases:vendor-ledger', async (_e, { actingUserId, vendorId, from, to } = {}) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      return { ok: true, data: await vendorLedger(pool, vendorId, from, to) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Edit a recorded bill (qty / total / types / amount) — balance, ledger, stock follow
  ipcMain.handle('purchases:edit-bill', async (_e, p) =>
    tx(async (conn) => {
      await authorize(p.actingUserId, ADMIN_ROLES)
      return editBill(conn, { ...p, createdBy: p.actingUserId })
    })
  )

  // Return defective / short pieces to the vendor (deduct, refund or replacement)
  ipcMain.handle('purchases:create-return', async (_e, p) =>
    tx(async (conn) => {
      await authorize(p.actingUserId, ADMIN_ROLES)
      return createReturn(conn, { ...p, createdBy: p.actingUserId })
    })
  )

  ipcMain.handle('purchases:delete-return', async (_e, { actingUserId, id }) =>
    tx(async (conn) => {
      await authorize(actingUserId, ADMIN_ROLES)
      return deleteReturn(conn, id)
    })
  )

  ipcMain.handle('purchases:bill-detail', async (_e, { actingUserId, id } = {}) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      return { ok: true, data: await billDetail(pool, id) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Bill history (date range + vendor / serial / vendor-bill-no search)
  ipcMain.handle('purchases:bills', async (_e, { actingUserId, from, to, search } = {}) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      const args = []
      let w = "WHERE p.status = 'received'"
      if (from) {
        w += ' AND p.order_date >= ?'
        args.push(from)
      }
      if (to) {
        w += ' AND p.order_date <= ?'
        args.push(to)
      }
      if (search && search.trim()) {
        w += ' AND (v.name LIKE ? OR p.serial_no LIKE ? OR p.vendor_bill_no LIKE ?)'
        const q = `%${search.trim()}%`
        args.push(q, q, q)
      }
      const [rows] = await pool.query(
        `SELECT p.id, p.serial_no, p.vendor_bill_no, p.order_date, p.total_incl_tax AS total,
                p.adds_stock, p.remarks, v.id AS vendor_id, v.name AS vendor,
                (SELECT COUNT(*) FROM purchase_order_items i WHERE i.purchase_order_id = p.id) AS line_count,
                (SELECT COALESCE(SUM(amount),0) FROM vouchers x WHERE x.purchase_order_id = p.id AND x.voucher_type = 'payment') AS paid_with_bill,
                (SELECT COALESCE(SUM(total_amount),0) FROM purchase_returns r WHERE r.purchase_order_id = p.id AND r.settlement <> 'none') AS returned_value,
                (SELECT COUNT(*) FROM purchase_returns r WHERE r.purchase_order_id = p.id) AS return_count,
                (SELECT COUNT(*) FROM purchase_bill_edits e WHERE e.purchase_order_id = p.id) AS edit_count
           FROM purchase_orders p LEFT JOIN vendors v ON v.id = p.vendor_id
          ${w}
          ORDER BY p.order_date DESC, p.id DESC LIMIT 500`,
        args
      )
      const total = rows.reduce((s, r) => s + Number(r.total), 0)
      return { ok: true, data: { rows, total: +total.toFixed(2) } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })
}
