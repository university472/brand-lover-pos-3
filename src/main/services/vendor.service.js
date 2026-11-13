// export async function createBill(conn, p) {
//   // 1. Make Vendor Optional
//   let v = null
//   if (p.vendorId) {
//     const [[vendor]] = await conn.query(
//       'SELECT id, name FROM vendors WHERE id = ? FOR UPDATE',
//       [p.vendorId]
//     )
//     if (!vendor) throw new Error('Select a valid vendor.')
//     v = vendor
//   }

//   const vbn = String(p.vendorBillNo || '').trim()
//   if (vbn && v && !p.allowDuplicateBillNo) {
//     const [[dup]] = await conn.query(
//       'SELECT serial_no FROM purchase_orders WHERE vendor_id = ? AND vendor_bill_no = ? LIMIT 1',
//       [v.id, vbn]
//     )
//     if (dup) throw new Error(`DUPLICATE_VENDOR_BILL:${dup.serial_no}`)
//   }

//   const lines = []
//   for (const ln of p.lines || []) {
//     const desc = String(ln.description || '').trim()
//     const total = r2(ln.lineTotal)
//     const qty = Number(ln.quantity) || 0
//     if (!desc && !ln.itemId && !total) continue

//     if (!desc && !ln.itemId)
//       throw new Error('Every line needs a product type / name.')
//     if (qty <= 0)
//       throw new Error(`Quantity must be more than 0 for "${desc || 'line'}".`)
//     if (total <= 0)
//       throw new Error(`Enter the total price for "${desc || 'line'}".`)

//     let item = null
//     if (ln.itemId) {
//       ;[[item]] = await conn.query(
//         'SELECT id, name, unit, current_stock, selling_price FROM items WHERE id = ? AND is_active = 1 FOR UPDATE',
//         [ln.itemId]
//       )
//       if (!item) throw new Error('A linked inventory item was not found.')
//     }

//     lines.push({
//       desc: desc || item.name,
//       qty,
//       total,
//       rate: r2(total / qty),
//       item,
//       operation: ln.stockOperation || 'add',
//       sellingPrice: Number(ln.sellingPrice) || 0 // Capture the new selling price if provided
//     })
//   }

//   const total = lines.length
//     ? r2(lines.reduce((s, l) => s + l.total, 0))
//     : r2(p.billAmount)
//   if (total <= 0)
//     throw new Error('Add product lines, or enter the bill amount.')

//   const addStock = !!p.addToStock
//   if (addStock && !lines.some((l) => l.item))
//     throw new Error(
//       'To add stock, link at least one line to an Inventory item.'
//     )

//   const date = p.billDate || localToday()
//   const serial = await nextSerial(conn)

//   // 2. Insert PO (vendor_id can be NULL)
//   const [res] = await conn.query(
//     `INSERT INTO purchase_orders
//        (serial_no, vendor_bill_no, vendor_id, order_date, sub_total, gst_amount, total_incl_tax,
//         status, adds_stock, remarks, created_by)
//      VALUES (?, ?, ?, ?, ?, 0, ?, 'received', ?, ?, ?)`,
//     [
//       serial,
//       (p.vendorBillNo || '').trim() || null,
//       v ? v.id : null,
//       date,
//       total,
//       total,
//       addStock ? 1 : 0,
//       (p.remarks || '').trim() || null,
//       p.createdBy || null
//     ]
//   )
//   const poId = res.insertId

//   for (const l of lines) {
//     await conn.query(
//       `INSERT INTO purchase_order_items
//          (purchase_order_id, item_id, description, quantity, unit, rate, amount, gst_rate, gst_amount, value_incl_tax)
//        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
//       [
//         poId,
//         l.item?.id || null,
//         l.desc,
//         l.qty,
//         l.item?.unit || 'Pcs',
//         l.rate,
//         l.total,
//         l.total
//       ]
//     )

//     if (addStock && l.item) {
//       // Stock logic (Add vs Replace)
//       if (l.operation === 'replace') {
//         const currentQty = Number(l.item.current_stock)
//         if (currentQty > 0) {
//           await postStockMovement(conn, {
//             itemId: l.item.id,
//             movementType: 'adjustment',
//             quantityOut: currentQty,
//             referenceType: 'purchase_replace_clear',
//             referenceId: poId,
//             movementDate: date
//           })
//         }
//         await postStockMovement(conn, {
//           itemId: l.item.id,
//           movementType: 'purchase',
//           quantityIn: l.qty,
//           unitCost: l.rate,
//           referenceType: 'purchase_replace',
//           referenceId: poId,
//           movementDate: date
//         })
//       } else {
//         await postStockMovement(conn, {
//           itemId: l.item.id,
//           movementType: 'purchase',
//           quantityIn: l.qty,
//           unitCost: l.rate,
//           referenceType: 'purchase',
//           referenceId: poId,
//           movementDate: date
//         })
//       }

//       // 3. Update item prices. Purchase price updates always.
//       // Selling price ONLY updates if the line explicitly provided a > 0 value.
//       if (l.sellingPrice > 0) {
//         await conn.query(
//           'UPDATE items SET purchase_price = ?, selling_price = ? WHERE id = ?',
//           [l.rate, l.sellingPrice, l.item.id]
//         )
//       } else {
//         await conn.query('UPDATE items SET purchase_price = ? WHERE id = ?', [
//           l.rate,
//           l.item.id
//         ])
//       }
//     }
//   }

//   // 4. Only post to vendor ledger if a vendor was selected
//   if (v) {
//     await conn.query(
//       'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
//       [total, v.id]
//     )
//     await postVendorLedger(conn, {
//       vendorId: v.id,
//       date,
//       entryType: 'bill',
//       referenceType: 'purchase',
//       referenceId: poId,
//       debit: total,
//       createdBy: p.createdBy,
//       description:
//         `Bill ${serial}${p.vendorBillNo ? ' (vendor #' + p.vendorBillNo.trim() + ')' : ''}` +
//         (lines.length
//           ? ` · ${lines.length} type${lines.length > 1 ? 's' : ''}`
//           : ' · amount only')
//     })
//   }

//   let payment = null
//   if (Number(p.payNow) > 0 && v)
//     payment = await payVendor(conn, {
//       vendorId: v.id,
//       amount: p.payNow,
//       accountId: p.accountId,
//       date,
//       purchaseOrderId: poId,
//       reference: serial,
//       note: `Paid with bill ${serial}`,
//       createdBy: p.createdBy
//     })

//   return {
//     poId,
//     serial,
//     total,
//     lines: lines.length,
//     stockAdded: addStock,
//     payment
//   }
// }

// // Undo a payment (mistake): money back to the account, vendor owes it again, ledger row removed.
// // Money a vendor pays BACK when they owe us (balance below 0, e.g. after goods were returned
// // to them). Receipt voucher (cash/bank goes up), vendor balance moves back toward 0, and a
// // 'refund' ledger row keeps the history. Before, there was no way to record this.
// export async function receiveFromVendor(conn, p) {
//   const amount = r2(p.amount)
//   if (amount <= 0) throw new Error('Enter an amount greater than 0.')
//   if (!p.accountId) throw new Error('Choose Cash in Hand or Online (bank).')
//   const [[v]] = await conn.query(
//     'SELECT id, name, current_balance FROM vendors WHERE id = ? FOR UPDATE',
//     [p.vendorId]
//   )
//   if (!v) throw new Error('Vendor not found.')
//   const owesUs = r2(-Number(v.current_balance))
//   if (owesUs <= 0.009) throw new Error(`${v.name} does not owe you anything.`)
//   if (amount > owesUs + 0.009)
//     throw new Error(
//       `That is more than ${v.name} owes you (Rs. ${owesUs.toLocaleString('en-PK')}).`
//     )
//   const [[acct]] = await conn.query(
//     'SELECT id, name, type FROM accounts WHERE id = ? AND is_active = 1',
//     [p.accountId]
//   )
//   if (!acct) throw new Error('Account not found.')
//   const date = p.date || localToday()
//   const vno = await nextReceiptVoucherNo(conn)
//   const note = (p.note || '').trim() || `Money received from ${v.name}`
//   const [res] = await conn.query(
//     `INSERT INTO vouchers
//        (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method,
//         reference, description, voucher_date, created_by)
//      VALUES (?, 'receipt', 'vendor', ?, ?, ?, ?, 'vendor-refund', ?, ?, ?)`,
//     [
//       vno,
//       v.id,
//       acct.id,
//       amount,
//       acct.type === 'bank' ? 'bank' : 'cash',
//       note,
//       date,
//       p.createdBy || null
//     ]
//   )
//   await conn.query(
//     'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
//     [amount, acct.id]
//   )
//   await conn.query(
//     'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
//     [amount, v.id]
//   )
//   await postVendorLedger(conn, {
//     vendorId: v.id,
//     date,
//     entryType: 'refund',
//     referenceType: 'voucher',
//     referenceId: res.insertId,
//     debit: amount,
//     description: `${vno} · ${note} (${acct.name})`,
//     createdBy: p.createdBy
//   })
//   return {
//     voucherId: res.insertId,
//     voucherNo: vno,
//     amount,
//     account: acct.name,
//     accountType: acct.type
//   }
// }

// export async function deletePayment(conn, voucherId) {
//   const [[v]] = await conn.query(
//     `SELECT * FROM vouchers
//       WHERE id = ? AND party_type = 'vendor'
//         AND (voucher_type = 'payment' OR (voucher_type = 'receipt' AND reference = 'vendor-refund'))
//       FOR UPDATE`,
//     [voucherId]
//   )
//   if (!v) throw new Error('Vendor payment not found.')
//   if (v.voucher_type === 'receipt') {
//     // undo "Receive from vendor": the money goes back out, the vendor owes us again
//     await conn.query(
//       'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?',
//       [v.amount, v.account_id]
//     )
//     await conn.query(
//       'UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?',
//       [v.amount, v.party_id]
//     )
//     await conn.query(
//       `DELETE FROM vendor_ledger WHERE vendor_id = ? AND entry_type = 'refund' AND reference_type = 'voucher' AND reference_id = ?`,
//       [v.party_id, v.id]
//     )
//     await conn.query('DELETE FROM vouchers WHERE id = ?', [v.id])
//     return { deleted: true, amount: Number(v.amount) }
//   }
//   await conn.query(
//     'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
//     [v.amount, v.account_id]
//   )
//   await conn.query(
//     'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
//     [v.amount, v.party_id]
//   )
//   await conn.query(
//     `DELETE FROM vendor_ledger WHERE vendor_id = ? AND entry_type = 'payment' AND reference_type = 'voucher' AND reference_id = ?`,
//     [v.party_id, v.id]
//   )
//   await conn.query('DELETE FROM vouchers WHERE id = ?', [v.id])
//   return { deleted: true, amount: Number(v.amount) }
// }

// // Undo a bill (mistake). Blocked while payments are linked to it (delete those first).
// export async function deleteBill(conn, poId) {
//   const [[po]] = await conn.query(
//     'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
//     [poId]
//   )
//   if (!po) throw new Error('Bill not found.')
//   const [[{ n }]] = await conn.query(
//     'SELECT COUNT(*) AS n FROM vouchers WHERE purchase_order_id = ?',
//     [poId]
//   )
//   if (n > 0)
//     throw new Error(
//       'This bill has a payment made with it — delete that payment first (vendor ledger).'
//     )
//   const [[{ rn }]] = await conn.query(
//     'SELECT COUNT(*) AS rn FROM purchase_returns WHERE purchase_order_id = ?',
//     [poId]
//   )
//   if (rn > 0)
//     throw new Error(
//       'This bill has returns to the vendor — delete those returns first.'
//     )
//   if (po.status === 'received') {
//     if (po.vendor_id)
//       await conn.query(
//         'UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?',
//         [po.total_incl_tax, po.vendor_id]
//       )
//     if (po.adds_stock) {
//       const [items] = await conn.query(
//         'SELECT item_id, quantity FROM purchase_order_items WHERE purchase_order_id = ? AND item_id IS NOT NULL',
//         [poId]
//       )
//       // Some of this bill's goods may already be sold — then the bill can't be undone
//       // (it would push stock below 0).
//       for (const it of items) {
//         const [[cur]] = await conn.query(
//           'SELECT name, current_stock FROM items WHERE id = ?',
//           [it.item_id]
//         )
//         if (cur && Number(cur.current_stock) + 0.0001 < Number(it.quantity))
//           throw new Error(
//             `Can't delete this bill: ${Number(it.quantity)} of "${cur.name}" came with it but only ` +
//               `${Number(cur.current_stock)} are in stock now (the rest was sold).`
//           )
//       }
//       for (const it of items)
//         await postStockMovement(conn, {
//           itemId: it.item_id,
//           movementType: 'adjustment',
//           quantityOut: Number(it.quantity),
//           referenceType: 'purchase_delete',
//           referenceId: poId
//         })
//     }
//   }
//   await conn.query(
//     `DELETE FROM vendor_ledger WHERE entry_type = 'bill' AND reference_type = 'purchase' AND reference_id = ?`,
//     [poId]
//   )
//   await conn.query(
//     'DELETE FROM purchase_order_items WHERE purchase_order_id = ?',
//     [poId]
//   )
//   await conn.query('DELETE FROM purchase_orders WHERE id = ?', [poId])
//   return { deleted: true }
// }

// // Vendor statement: opening (before `from`), every bill (+) / payment (−) with running balance.
// export async function vendorLedger(db, vendorId, from, to) {
//   const [[vendor]] = await db.query(
//     'SELECT id, code, name, telephone, address, gst_reg_no, ntn, opening_balance, current_balance FROM vendors WHERE id = ?',
//     [vendorId]
//   )
//   if (!vendor) throw new Error('Vendor not found.')
//   const [[after]] = await db.query(
//     `SELECT COALESCE(SUM(debit - credit),0) AS net FROM vendor_ledger WHERE vendor_id = ?${from ? ' AND entry_date >= ?' : ''}`,
//     from ? [vendorId, from] : [vendorId]
//   )
//   const opening = r2(Number(vendor.current_balance) - Number(after.net))
//   const args = [vendorId]
//   let w = ''
//   if (from) {
//     w += ' AND l.entry_date >= ?'
//     args.push(from)
//   }
//   if (to) {
//     w += ' AND l.entry_date <= ?'
//     args.push(to)
//   }
//   const [rows] = await db.query(
//     `SELECT l.id, l.entry_date, l.entry_type, l.reference_type, l.reference_id, l.debit, l.credit, l.description,
//             po.serial_no, po.vendor_bill_no, po.adds_stock, vv.voucher_no, vv.reference AS voucher_reference,
//             a.name AS account_name, a.type AS account_type,
//             pr.return_no, pr.settlement, pr.purchase_order_id AS return_bill_id
//        FROM vendor_ledger l
//        LEFT JOIN purchase_orders po ON l.reference_type = 'purchase' AND po.id = l.reference_id
//        LEFT JOIN purchase_returns pr ON l.reference_type = 'purchase_return' AND pr.id = l.reference_id
//        LEFT JOIN vouchers vv ON l.reference_type = 'voucher' AND vv.id = l.reference_id
//        LEFT JOIN accounts a ON a.id = vv.account_id
//       WHERE l.vendor_id = ?${w}
//       ORDER BY l.entry_date ASC, l.id ASC`,
//     args
//   )
//   const billIds = rows
//     .filter((r) => r.entry_type === 'bill' && r.reference_id)
//     .map((r) => r.reference_id)
//   const linesBy = {}
//   if (billIds.length) {
//     const [ls] = await db.query(
//       `SELECT purchase_order_id, description, quantity, rate, amount, item_id FROM purchase_order_items
//         WHERE purchase_order_id IN (?) ORDER BY id`,
//       [billIds]
//     )
//     for (const l of ls)
//       (linesBy[l.purchase_order_id] ||= []).push({
//         description: l.description,
//         quantity: Number(l.quantity),
//         rate: Number(l.rate),
//         amount: Number(l.amount),
//         linked: !!l.item_id
//       })
//   }
//   let bal = opening
//   const out = rows.map((r) => {
//     bal = r2(bal + Number(r.debit) - Number(r.credit))
//     return {
//       id: r.id,
//       date: r.entry_date,
//       type: r.entry_type,
//       description: r.description,
//       bill: Number(r.debit),
//       paid: Number(r.credit),
//       balance: bal,
//       billId: r.entry_type === 'bill' ? r.reference_id : null,
//       // payments, and money received back with "Receive from vendor", can be deleted here
//       // (refunds that belong to a return are undone by deleting that return)
//       voucherId:
//         r.reference_type === 'voucher' &&
//         (r.entry_type === 'payment' ||
//           (r.entry_type === 'refund' &&
//             r.voucher_reference === 'vendor-refund'))
//           ? r.reference_id
//           : null,
//       serial: r.serial_no,
//       vendorBillNo: r.vendor_bill_no,
//       stockAdded: !!r.adds_stock,
//       voucherNo: r.voucher_no,
//       account: r.account_name,
//       accountType: r.account_type,
//       returnId: r.entry_type === 'return' ? r.reference_id : null,
//       returnNo: r.return_no,
//       settlement: r.settlement,
//       returnBillId: r.return_bill_id,
//       lines: r.entry_type === 'bill' ? linesBy[r.reference_id] || [] : undefined
//     }
//   })
//   return {
//     vendor,
//     opening,
//     rows: out,
//     totals: {
//       billed: r2(out.reduce((s, r) => s + r.bill, 0)),
//       paid: r2(out.reduce((s, r) => s + r.paid, 0)),
//       closing: bal
//     }
//   }
// }

// // ─────────────────────────── Bill edit ───────────────────────────
// // Change a bill's product types (qty / total / name, add or remove types) or, for an
// // amount-only bill, its amount. The vendor balance and the bill's ledger row move by the
// // difference; stock follows if the bill added stock; every edit is kept in purchase_bill_edits.
// export async function editBill(conn, p) {
//   const [[po]] = await conn.query(
//     'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
//     [p.poId]
//   )
//   if (!po) throw new Error('Bill not found.')
//   if (po.status !== 'received')
//     throw new Error('Only recorded bills can be edited.')
//   const [old] = await conn.query(
//     'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id',
//     [po.id]
//   )
//   const returnedBy = await returnedQtyByLine(conn, po.id)
//   const oldById = new Map(old.map((l) => [l.id, l]))
//   const changes = []

//   const next = []
//   for (const ln of p.lines || []) {
//     const desc = String(ln.description || '').trim()
//     const qty = Number(ln.quantity) || 0
//     const total = r2(ln.lineTotal)
//     if (!ln.id && !desc && !qty && !total) continue // empty new row
//     if (!desc) throw new Error('Every line needs a product type / name.')
//     if (qty <= 0) throw new Error(`Quantity must be more than 0 for "${desc}".`)
//     if (total <= 0) throw new Error(`Enter the total price for "${desc}".`)
//     const was = ln.id ? oldById.get(Number(ln.id)) : null
//     if (ln.id && !was)
//       throw new Error('A line of this bill was not found — reopen the bill.')
//     const ret = was ? returnedBy.get(was.id) || 0 : 0
//     if (qty + 0.0001 < ret)
//       throw new Error(
//         `"${desc}": ${ret} piece(s) were already returned — quantity can't go below that.`
//       )
//     let item = null
//     const itemId = was
//       ? was.item_id
//       : po.adds_stock && ln.itemId
//         ? Number(ln.itemId)
//         : null
//     if (itemId) {
//       ;[[item]] = await conn.query('SELECT id, unit FROM items WHERE id = ?', [
//         itemId
//       ])
//       if (!item) throw new Error('A linked inventory item was not found.')
//     }
//     next.push({
//       id: was?.id || null,
//       desc,
//       qty,
//       total,
//       rate: r2(total / qty),
//       itemId: item?.id || null,
//       unit: item?.unit || was?.unit || 'Pcs',
//       was
//     })
//   }
//   const keptIds = new Set(next.filter((l) => l.id).map((l) => l.id))
//   const removed = old.filter((l) => !keptIds.has(l.id))
//   for (const l of removed)
//     if ((returnedBy.get(l.id) || 0) > 0)
//       throw new Error(
//         `"${l.description}" has returned pieces — it can't be removed from the bill.`
//       )

//   const oldTotal = r2(po.total_incl_tax)
//   let newTotal
//   if (next.length) newTotal = r2(next.reduce((s, l) => s + l.total, 0))
//   else if (old.length)
//     throw new Error(
//       'A bill needs at least one product type (or delete the bill).'
//     )
//   else newTotal = r2(p.billAmount) // amount-only bill
//   if (newTotal <= 0) throw new Error('The bill total must be more than 0.')

//   for (const l of next) {
//     if (l.was) {
//       const w = l.was
//       const bits = []
//       if (w.description !== l.desc)
//         bits.push(`name "${w.description}" → "${l.desc}"`)
//       if (Number(w.quantity) !== l.qty)
//         bits.push(`qty ${Number(w.quantity)} → ${l.qty}`)
//       if (r2(w.amount) !== l.total)
//         bits.push(`total ${r2(w.amount)} → ${l.total}`)
//       if (bits.length) {
//         changes.push(`${l.desc}: ${bits.join(', ')}`)
//         await conn.query(
//           'UPDATE purchase_order_items SET description = ?, quantity = ?, rate = ?, amount = ?, value_incl_tax = ? WHERE id = ?',
//           [l.desc, l.qty, l.rate, l.total, l.total, w.id]
//         )
//       }
//     } else {
//       changes.push(`added ${l.desc} (qty ${l.qty}, total ${l.total})`)
//       await conn.query(
//         `INSERT INTO purchase_order_items
//            (purchase_order_id, item_id, description, quantity, unit, rate, amount, gst_rate, gst_amount, value_incl_tax)
//          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
//         [po.id, l.itemId, l.desc, l.qty, l.unit, l.rate, l.total, l.total]
//       )
//     }
//   }
//   for (const l of removed) {
//     changes.push(
//       `removed ${l.description} (qty ${Number(l.quantity)}, total ${r2(l.amount)})`
//     )
//     await conn.query('DELETE FROM purchase_order_items WHERE id = ?', [l.id])
//   }
//   if (!next.length && !old.length && newTotal !== oldTotal)
//     changes.push(`amount ${oldTotal} → ${newTotal}`)

//   // stock follows the quantity change (only for bills that added stock)
//   if (po.adds_stock) {
//     const sumBy = (rows) =>
//       rows.reduce(
//         (m, r) => (r.item ? m.set(r.item, (m.get(r.item) || 0) + r.q) : m),
//         new Map()
//       )
//     const before = sumBy(
//       old.map((l) => ({ item: l.item_id, q: Number(l.quantity) }))
//     )
//     const after = sumBy(next.map((l) => ({ item: l.itemId, q: l.qty })))
//     for (const itemId of new Set([...before.keys(), ...after.keys()])) {
//       const d = (after.get(itemId) || 0) - (before.get(itemId) || 0)
//       if (Math.abs(d) < 0.0001) continue
//       const rate = next.find((l) => l.itemId === itemId)?.rate || 0
//       await postStockMovement(conn, {
//         itemId,
//         movementType: d > 0 ? 'purchase' : 'adjustment',
//         quantityIn: d > 0 ? d : 0,
//         quantityOut: d < 0 ? -d : 0,
//         unitCost: d > 0 ? rate : 0,
//         referenceType: 'purchase_edit',
//         referenceId: po.id,
//         movementDate: po.order_date
//       })
//     }
//   }

//   const billDate = p.billDate || po.order_date
//   const vendorBillNo =
//     p.vendorBillNo !== undefined
//       ? String(p.vendorBillNo).trim() || null
//       : po.vendor_bill_no
//   if (billDate !== po.order_date)
//     changes.push(`date ${po.order_date} → ${billDate}`)
//   if ((vendorBillNo || null) !== (po.vendor_bill_no || null))
//     changes.push(
//       `vendor bill # "${po.vendor_bill_no || ''}" → "${vendorBillNo || ''}"`
//     )
//   if (!changes.length) throw new Error('Nothing was changed.')

//   await conn.query(
//     'UPDATE purchase_orders SET sub_total = ?, total_incl_tax = ?, order_date = ?, vendor_bill_no = ?, remarks = ? WHERE id = ?',
//     [
//       newTotal,
//       newTotal,
//       billDate,
//       vendorBillNo,
//       p.remarks !== undefined ? String(p.remarks).trim() || null : po.remarks,
//       po.id
//     ]
//   )
//   const delta = r2(newTotal - oldTotal)
//   if (delta)
//     await conn.query(
//       'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
//       [delta, po.vendor_id]
//     )
//   // the bill's ledger row shows the bill as it is NOW (same place in the statement)
//   const types = next.length
//   await conn.query(
//     `UPDATE vendor_ledger SET debit = ?, entry_date = ?, description = ?
//       WHERE entry_type = 'bill' AND reference_type = 'purchase' AND reference_id = ?`,
//     [
//       newTotal,
//       billDate,
//       `Bill ${po.serial_no}${vendorBillNo ? ' (vendor #' + vendorBillNo + ')' : ''}` +
//         (types ? ` · ${types} type${types > 1 ? 's' : ''}` : ' · amount only') +
//         ' · edited',
//       po.id
//     ]
//   )
//   const reason = String(p.reason || '').trim() || null
//   await conn.query(
//     'INSERT INTO purchase_bill_edits (purchase_order_id, old_total, new_total, reason, changes, edited_by) VALUES (?, ?, ?, ?, ?, ?)',
//     [po.id, oldTotal, newTotal, reason, changes.join('; '), p.createdBy || null]
//   )
//   return {
//     poId: po.id,
//     serial: po.serial_no,
//     oldTotal,
//     newTotal,
//     delta,
//     changes
//   }
// }

// // ───────────────────── Return to vendor (defective / short) ─────────────────────
// async function returnedQtyByLine(conn, poId) {
//   const [rows] = await conn.query(
//     `SELECT ri.po_item_id, SUM(ri.quantity) AS q
//        FROM purchase_return_items ri JOIN purchase_returns r ON r.id = ri.return_id
//       WHERE r.purchase_order_id = ? GROUP BY ri.po_item_id`,
//     [poId]
//   )
//   return new Map(rows.map((r) => [r.po_item_id, Number(r.q)]))
// }

// async function nextReturnNo(conn) {
//   const [[r]] = await conn.query(
//     `SELECT COALESCE(MAX(CAST(REPLACE(return_no, 'PR-', '') AS UNSIGNED)), 0) + 1 AS next
//        FROM purchase_returns WHERE return_no LIKE 'PR-%'`
//   )
//   return 'PR-' + String(r.next).padStart(4, '0')
// }
// async function nextReceiptVoucherNo(conn) {
//   const [[r]] = await conn.query(
//     `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no, 'RV-', '') AS UNSIGNED)), 0) + 1 AS next
//        FROM vouchers WHERE voucher_type = 'receipt' AND voucher_no LIKE 'RV-%'`
//   )
//   return 'RV-' + String(r.next).padStart(3, '0')
// }

// // items: [{ poItemId, quantity }]   settlement: 'deduct' | 'refund' | 'none'
// export async function createReturn(conn, p) {
//   const [[po]] = await conn.query(
//     'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
//     [p.poId]
//   )
//   if (!po) throw new Error('Bill not found.')
//   const [[v]] = await conn.query(
//     'SELECT id, name, current_balance FROM vendors WHERE id = ? FOR UPDATE',
//     [po.vendor_id]
//   )
//   if (!v) throw new Error('Vendor not found.')
//   const [lines] = await conn.query(
//     'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
//     [po.id]
//   )
//   if (!lines.length)
//     throw new Error(
//       'This bill has no product types to return (amount-only bill) — edit the bill amount instead.'
//     )
//   const byId = new Map(lines.map((l) => [l.id, l]))
//   const returnedBy = await returnedQtyByLine(conn, po.id)
//   const picked = []
//   for (const it of p.items || []) {
//     const q = Number(it.quantity) || 0
//     if (q <= 0) continue
//     const l = byId.get(Number(it.poItemId))
//     if (!l) throw new Error('A returned line does not belong to this bill.')
//     const left = Number(l.quantity) - (returnedBy.get(l.id) || 0)
//     if (q > left + 0.0001)
//       throw new Error(
//         `"${l.description}": only ${left} piece(s) can still be returned.`
//       )
//     picked.push({ l, q, amount: r2(q * Number(l.rate)) })
//   }
//   if (!picked.length)
//     throw new Error(
//       'Enter how many pieces of at least one type are being returned.'
//     )
//   const settlement = ['deduct', 'refund', 'none'].includes(p.settlement)
//     ? p.settlement
//     : 'deduct'
//   const total = r2(picked.reduce((s, x) => s + x.amount, 0))
//   const date = p.date || localToday()
//   const returnNo = await nextReturnNo(conn)
//   let acct = null
//   if (settlement === 'refund') {
//     if (!p.accountId)
//       throw new Error('Choose where the money came in: Cash in Hand or Online.')
//     ;[[acct]] = await conn.query(
//       'SELECT id, name, type FROM accounts WHERE id = ? AND is_active = 1',
//       [p.accountId]
//     )
//     if (!acct) throw new Error('Account not found.')
//   }
//   const reason = String(p.reason || '').trim() || null
//   const [res] = await conn.query(
//     `INSERT INTO purchase_returns (return_no, purchase_order_id, vendor_id, return_date, total_amount, settlement, account_id, reason, created_by)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//     [
//       returnNo,
//       po.id,
//       v.id,
//       date,
//       total,
//       settlement,
//       acct?.id || null,
//       reason,
//       p.createdBy || null
//     ]
//   )
//   const returnId = res.insertId
//   for (const x of picked) {
//     await conn.query(
//       'INSERT INTO purchase_return_items (return_id, po_item_id, item_id, description, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
//       [returnId, x.l.id, x.l.item_id, x.l.description, x.q, x.l.rate, x.amount]
//     )
//     if (po.adds_stock && x.l.item_id)
//       await postStockMovement(conn, {
//         itemId: x.l.item_id,
//         movementType: 'purchase_return',
//         quantityOut: x.q,
//         referenceType: 'purchase_return',
//         referenceId: returnId,
//         movementDate: date
//       })
//   }
//   const what = picked.map((x) => `${x.q} × ${x.l.description}`).join(', ')
//   const label = {
//     deduct: 'deducted from balance',
//     refund: `vendor paid back (${acct?.name})`,
//     none: 'replacement / no deduction'
//   }[settlement]
//   // 'return' row: we owe less (credit) — zero for "replacement / no deduction"
//   await postVendorLedger(conn, {
//     vendorId: v.id,
//     date,
//     entryType: 'return',
//     referenceType: 'purchase_return',
//     referenceId: returnId,
//     credit: settlement === 'none' ? 0 : total,
//     createdBy: p.createdBy,
//     description: `${returnNo} · returned ${what} (bill ${po.serial_no}) · ${label}`
//   })
//   let refund = null
//   if (settlement === 'deduct') {
//     await conn.query(
//       'UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?',
//       [total, v.id]
//     )
//   } else if (settlement === 'refund') {
//     // Money came IN from the vendor: receipt voucher, account up; ledger 'refund' row (debit)
//     // cancels the return's credit, so the vendor balance is unchanged overall.
//     const vno = await nextReceiptVoucherNo(conn)
//     const [vr] = await conn.query(
//       `INSERT INTO vouchers (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method,
//                              reference, purchase_order_id, description, voucher_date, created_by)
//        VALUES (?, 'receipt', 'vendor', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         vno,
//         v.id,
//         acct.id,
//         total,
//         acct.type === 'bank' ? 'bank' : 'cash',
//         returnNo,
//         po.id,
//         `Refund from ${v.name} for ${returnNo}`,
//         date,
//         p.createdBy || null
//       ]
//     )
//     await conn.query(
//       'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
//       [total, acct.id]
//     )
//     await conn.query(
//       'UPDATE purchase_returns SET voucher_id = ? WHERE id = ?',
//       [vr.insertId, returnId]
//     )
//     await postVendorLedger(conn, {
//       vendorId: v.id,
//       date,
//       entryType: 'refund',
//       referenceType: 'voucher',
//       referenceId: vr.insertId,
//       debit: total,
//       createdBy: p.createdBy,
//       description: `${vno} · money received back for ${returnNo} (${acct.name})`
//     })
//     refund = { voucherNo: vno, account: acct.name }
//   }
//   return { returnId, returnNo, total, settlement, items: picked.length, refund }
// }

// // Undo a return (mistake): stock back in, balance / money back, ledger rows removed.
// export async function deleteReturn(conn, returnId) {
//   const [[r]] = await conn.query(
//     'SELECT * FROM purchase_returns WHERE id = ? FOR UPDATE',
//     [returnId]
//   )
//   if (!r) throw new Error('Return not found.')
//   const [[po]] = await conn.query(
//     'SELECT adds_stock FROM purchase_orders WHERE id = ?',
//     [r.purchase_order_id]
//   )
//   const [items] = await conn.query(
//     'SELECT * FROM purchase_return_items WHERE return_id = ?',
//     [r.id]
//   )
//   if (po?.adds_stock)
//     for (const it of items)
//       if (it.item_id)
//         await postStockMovement(conn, {
//           itemId: it.item_id,
//           movementType: 'adjustment',
//           quantityIn: Number(it.quantity),
//           unitCost: Number(it.rate),
//           referenceType: 'purchase_return_delete',
//           referenceId: r.id
//         })
//   if (r.settlement === 'deduct')
//     await conn.query(
//       'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
//       [r.total_amount, r.vendor_id]
//     )
//   if (r.settlement === 'refund' && r.voucher_id) {
//     const [[vv]] = await conn.query('SELECT * FROM vouchers WHERE id = ?', [
//       r.voucher_id
//     ])
//     if (vv) {
//       await conn.query(
//         'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?',
//         [vv.amount, vv.account_id]
//       )
//       await conn.query(
//         `DELETE FROM vendor_ledger WHERE entry_type = 'refund' AND reference_type = 'voucher' AND reference_id = ?`,
//         [vv.id]
//       )
//       await conn.query(
//         'UPDATE purchase_returns SET voucher_id = NULL WHERE id = ?',
//         [r.id]
//       )
//       await conn.query('DELETE FROM vouchers WHERE id = ?', [vv.id])
//     }
//   }
//   await conn.query(
//     `DELETE FROM vendor_ledger WHERE entry_type = 'return' AND reference_type = 'purchase_return' AND reference_id = ?`,
//     [r.id]
//   )
//   await conn.query('DELETE FROM purchase_returns WHERE id = ?', [r.id]) // items cascade
//   return { deleted: true, returnNo: r.return_no }
// }

// // Everything the bill screen needs: lines (+ returned qty), returns, edit history, payments.
// export async function billDetail(db, poId) {
//   const [[po]] = await db.query(
//     `SELECT p.*, v.name AS vendor, v.current_balance AS vendor_balance
//        FROM purchase_orders p LEFT JOIN vendors v ON v.id = p.vendor_id WHERE p.id = ?`,
//     [poId]
//   )
//   if (!po) throw new Error('Bill not found.')
//   const [items] = await db.query(
//     `SELECT poi.id, poi.item_id, poi.description, poi.quantity, poi.rate, poi.amount, i.item_code, i.name AS item_name
//        FROM purchase_order_items poi LEFT JOIN items i ON i.id = poi.item_id
//       WHERE poi.purchase_order_id = ? ORDER BY poi.id`,
//     [poId]
//   )
//   const returnedBy = await returnedQtyByLine(db, poId)
//   const [returns] = await db.query(
//     `SELECT r.id, r.return_no, r.return_date, r.total_amount, r.settlement, r.reason, a.name AS account_name
//        FROM purchase_returns r LEFT JOIN accounts a ON a.id = r.account_id
//       WHERE r.purchase_order_id = ? ORDER BY r.id`,
//     [poId]
//   )
//   const [rItems] = returns.length
//     ? await db.query(
//         'SELECT return_id, description, quantity, amount FROM purchase_return_items WHERE return_id IN (?)',
//         [returns.map((r) => r.id)]
//       )
//     : [[]]
//   const [edits] = await db.query(
//     `SELECT e.old_total, e.new_total, e.reason, e.changes, e.edited_at, u.full_name AS by_user
//        FROM purchase_bill_edits e LEFT JOIN users u ON u.id = e.edited_by
//       WHERE e.purchase_order_id = ? ORDER BY e.id DESC`,
//     [poId]
//   )
//   const [payments] = await db.query(
//     `SELECT v.voucher_no, v.amount, v.voucher_date, a.name AS account_name FROM vouchers v LEFT JOIN accounts a ON a.id = v.account_id
//       WHERE v.purchase_order_id = ? AND v.voucher_type = 'payment'`,
//     [poId]
//   )
//   const lines = items.map((l) => {
//     const returned = returnedBy.get(l.id) || 0
//     return {
//       ...l,
//       quantity: Number(l.quantity),
//       rate: Number(l.rate),
//       amount: Number(l.amount),
//       returned,
//       returnable: +(Number(l.quantity) - returned).toFixed(2)
//     }
//   })
//   const returnedValue = r2(
//     returns
//       .filter((r) => r.settlement !== 'none')
//       .reduce((s, r) => s + Number(r.total_amount), 0)
//   )
//   return {
//     ...po,
//     total: Number(po.total_incl_tax),
//     lines,
//     returns: returns.map((r) => ({
//       ...r,
//       total_amount: Number(r.total_amount),
//       items: rItems.filter((i) => i.return_id === r.id)
//     })),
//     returnedValue,
//     netTotal: r2(Number(po.total_incl_tax) - returnedValue),
//     edits,
//     payments
//   }
// }

// Vendor account book: purchase bills (typed product lines, optional stock), payments
// (cash / online, now or later, in parts) and the vendor ledger — managed like credit
// customers. All functions take a transaction connection.
import { postStockMovement } from './stock.service.js'
import { localToday } from './date.util.js'

const r2 = (n) => +Number(n || 0).toFixed(2)

// debit = we owe the vendor MORE (bill); credit = we owe LESS (payment)
export async function postVendorLedger(conn, e) {
  await conn.query(
    `INSERT INTO vendor_ledger
       (vendor_id, entry_date, entry_type, reference_type, reference_id, debit, credit, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.vendorId,
      e.date || localToday(),
      e.entryType,
      e.referenceType || null,
      e.referenceId || null,
      r2(e.debit),
      r2(e.credit),
      e.description || null,
      e.createdBy || null
    ]
  )
}

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

// Pay a vendor from Cash in Hand or Bank. Reduces the account (→ Dashboard Cash / Bank card)
// and the vendor's balance, and writes a ledger row linked to the voucher.
export async function payVendor(conn, p) {
  const amount = r2(p.amount)
  if (amount <= 0) throw new Error('Enter a payment amount greater than 0.')
  if (!p.accountId)
    throw new Error('Choose Cash in Hand or Online (bank) for the payment.')
  const [[v]] = await conn.query(
    'SELECT id, name, current_balance FROM vendors WHERE id = ? FOR UPDATE',
    [p.vendorId]
  )
  if (!v) throw new Error('Vendor not found.')
  if (!p.allowAdvance && amount > Number(v.current_balance) + 0.009)
    throw new Error(
      `Payment is more than the balance owed to ${v.name} (Rs. ${Number(v.current_balance).toLocaleString('en-PK')}).`
    )
  const [[acct]] = await conn.query(
    'SELECT id, name, type FROM accounts WHERE id = ? AND is_active = 1',
    [p.accountId]
  )
  if (!acct) throw new Error('Payment account not found.')
  const date = p.date || localToday()
  const vno = await nextPaymentVoucherNo(conn)
  const note = (p.note || '').trim() || `Payment to ${v.name}`
  const [res] = await conn.query(
    `INSERT INTO vouchers
       (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method,
        reference, purchase_order_id, description, voucher_date, created_by)
     VALUES (?, 'payment', 'vendor', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vno,
      v.id,
      acct.id,
      amount,
      acct.type === 'bank' ? 'bank' : 'cash',
      p.reference || 'vendor-payment',
      p.purchaseOrderId || null,
      note,
      date,
      p.createdBy || null
    ]
  )
  await conn.query(
    'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?',
    [amount, acct.id]
  )
  await conn.query(
    'UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?',
    [amount, v.id]
  )
  await postVendorLedger(conn, {
    vendorId: v.id,
    date,
    entryType: 'payment',
    referenceType: 'voucher',
    referenceId: res.insertId,
    credit: amount,
    description: `${vno} · ${note} (${acct.name})`,
    createdBy: p.createdBy
  })
  return {
    voucherId: res.insertId,
    voucherNo: vno,
    amount,
    account: acct.name,
    accountType: acct.type
  }
}

export async function createBill(conn, p) {
  // 1. Make Vendor Optional
  let v = null
  if (p.vendorId) {
    const [[vendor]] = await conn.query(
      'SELECT id, name FROM vendors WHERE id = ? FOR UPDATE',
      [p.vendorId]
    )
    if (!vendor) throw new Error('Select a valid vendor.')
    v = vendor
  }

  const vbn = String(p.vendorBillNo || '').trim()
  if (vbn && v && !p.allowDuplicateBillNo) {
    const [[dup]] = await conn.query(
      'SELECT serial_no FROM purchase_orders WHERE vendor_id = ? AND vendor_bill_no = ? LIMIT 1',
      [v.id, vbn]
    )
    if (dup) throw new Error(`DUPLICATE_VENDOR_BILL:${dup.serial_no}`)
  }

  const lines = []
  for (const ln of p.lines || []) {
    const desc = String(ln.description || '').trim()
    const qty = Number(ln.quantity) || 0
    const rate = Number(ln.rate) || 0

    if (!desc && !ln.itemId && !rate) continue // empty row

    if (!desc && !ln.itemId)
      throw new Error('Every line needs a product type / name.')
    if (qty <= 0)
      throw new Error(`Quantity must be more than 0 for "${desc || 'line'}".`)
    if (rate <= 0)
      throw new Error(
        `Purchase price must be more than 0 for "${desc || 'line'}".`
      )

    // Backend strictly calculates the total. It does not trust the client's lineTotal.
    const total = r2(qty * rate)

    let item = null
    if (ln.itemId) {
      ;[[item]] = await conn.query(
        'SELECT id, name, unit, current_stock, selling_price FROM items WHERE id = ? AND is_active = 1 FOR UPDATE',
        [ln.itemId]
      )
      if (!item) throw new Error('A linked inventory item was not found.')
    }

    lines.push({
      desc: desc || item.name,
      qty,
      total,
      rate,
      item,
      operation: ln.stockOperation || 'add',
      sellingPrice: Number(ln.sellingPrice) || 0
    })
  }

  const total = lines.length
    ? r2(lines.reduce((s, l) => s + l.total, 0))
    : r2(p.billAmount)
  if (total <= 0)
    throw new Error('Add product lines, or enter the bill amount.')

  const addStock = !!p.addToStock
  if (addStock && !lines.some((l) => l.item))
    throw new Error(
      'To add stock, link at least one line to an Inventory item.'
    )

  const date = p.billDate || localToday()
  const serial = await nextSerial(conn)

  // 2. Insert PO (vendor_id can be NULL)
  const [res] = await conn.query(
    `INSERT INTO purchase_orders
       (serial_no, vendor_bill_no, vendor_id, order_date, sub_total, gst_amount, total_incl_tax,
        status, adds_stock, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'received', ?, ?, ?)`,
    [
      serial,
      (p.vendorBillNo || '').trim() || null,
      v ? v.id : null,
      date,
      total,
      total,
      addStock ? 1 : 0,
      (p.remarks || '').trim() || null,
      p.createdBy || null
    ]
  )
  const poId = res.insertId

  for (const l of lines) {
    await conn.query(
      `INSERT INTO purchase_order_items
         (purchase_order_id, item_id, description, quantity, unit, rate, amount, gst_rate, gst_amount, value_incl_tax)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [
        poId,
        l.item?.id || null,
        l.desc,
        l.qty,
        l.item?.unit || 'Pcs',
        l.rate,
        l.total,
        l.total
      ]
    )

    if (addStock && l.item) {
      // Stock logic (Add vs Replace)
      if (l.operation === 'replace') {
        const currentQty = Number(l.item.current_stock)
        if (currentQty > 0) {
          await postStockMovement(conn, {
            itemId: l.item.id,
            movementType: 'adjustment',
            quantityOut: currentQty,
            referenceType: 'purchase_replace_clear',
            referenceId: poId,
            movementDate: date
          })
        }
        await postStockMovement(conn, {
          itemId: l.item.id,
          movementType: 'purchase',
          quantityIn: l.qty,
          unitCost: l.rate,
          referenceType: 'purchase_replace',
          referenceId: poId,
          movementDate: date
        })
      } else {
        await postStockMovement(conn, {
          itemId: l.item.id,
          movementType: 'purchase',
          quantityIn: l.qty,
          unitCost: l.rate,
          referenceType: 'purchase',
          referenceId: poId,
          movementDate: date
        })
      }

      // 3. Update item prices. Purchase price updates always.
      // Selling price ONLY updates if the line explicitly provided a > 0 value.
      if (l.sellingPrice > 0) {
        await conn.query(
          'UPDATE items SET purchase_price = ?, selling_price = ? WHERE id = ?',
          [l.rate, l.sellingPrice, l.item.id]
        )
      } else {
        await conn.query('UPDATE items SET purchase_price = ? WHERE id = ?', [
          l.rate,
          l.item.id
        ])
      }
    }
  }

  // 4. Only post to vendor ledger if a vendor was selected
  if (v) {
    await conn.query(
      'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
      [total, v.id]
    )
    await postVendorLedger(conn, {
      vendorId: v.id,
      date,
      entryType: 'bill',
      referenceType: 'purchase',
      referenceId: poId,
      debit: total,
      createdBy: p.createdBy,
      description:
        `Bill ${serial}${p.vendorBillNo ? ' (vendor #' + p.vendorBillNo.trim() + ')' : ''}` +
        (lines.length
          ? ` · ${lines.length} type${lines.length > 1 ? 's' : ''}`
          : ' · amount only')
    })
  }

  let payment = null
  if (Number(p.payNow) > 0 && v)
    payment = await payVendor(conn, {
      vendorId: v.id,
      amount: p.payNow,
      accountId: p.accountId,
      date,
      purchaseOrderId: poId,
      reference: serial,
      note: `Paid with bill ${serial}`,
      createdBy: p.createdBy
    })

  return {
    poId,
    serial,
    total,
    lines: lines.length,
    stockAdded: addStock,
    payment
  }
}

// Undo a payment (mistake): money back to the account, vendor owes it again, ledger row removed.
// Money a vendor pays BACK when they owe us (balance below 0, e.g. after goods were returned
// to them). Receipt voucher (cash/bank goes up), vendor balance moves back toward 0, and a
// 'refund' ledger row keeps the history. Before, there was no way to record this.
export async function receiveFromVendor(conn, p) {
  const amount = r2(p.amount)
  if (amount <= 0) throw new Error('Enter an amount greater than 0.')
  if (!p.accountId) throw new Error('Choose Cash in Hand or Online (bank).')
  const [[v]] = await conn.query(
    'SELECT id, name, current_balance FROM vendors WHERE id = ? FOR UPDATE',
    [p.vendorId]
  )
  if (!v) throw new Error('Vendor not found.')
  const owesUs = r2(-Number(v.current_balance))
  if (owesUs <= 0.009) throw new Error(`${v.name} does not owe you anything.`)
  if (amount > owesUs + 0.009)
    throw new Error(
      `That is more than ${v.name} owes you (Rs. ${owesUs.toLocaleString('en-PK')}).`
    )
  const [[acct]] = await conn.query(
    'SELECT id, name, type FROM accounts WHERE id = ? AND is_active = 1',
    [p.accountId]
  )
  if (!acct) throw new Error('Account not found.')
  const date = p.date || localToday()
  const vno = await nextReceiptVoucherNo(conn)
  const note = (p.note || '').trim() || `Money received from ${v.name}`
  const [res] = await conn.query(
    `INSERT INTO vouchers
       (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method,
        reference, description, voucher_date, created_by)
     VALUES (?, 'receipt', 'vendor', ?, ?, ?, ?, 'vendor-refund', ?, ?, ?)`,
    [
      vno,
      v.id,
      acct.id,
      amount,
      acct.type === 'bank' ? 'bank' : 'cash',
      note,
      date,
      p.createdBy || null
    ]
  )
  await conn.query(
    'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
    [amount, acct.id]
  )
  await conn.query(
    'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
    [amount, v.id]
  )
  await postVendorLedger(conn, {
    vendorId: v.id,
    date,
    entryType: 'refund',
    referenceType: 'voucher',
    referenceId: res.insertId,
    debit: amount,
    description: `${vno} · ${note} (${acct.name})`,
    createdBy: p.createdBy
  })
  return {
    voucherId: res.insertId,
    voucherNo: vno,
    amount,
    account: acct.name,
    accountType: acct.type
  }
}

export async function deletePayment(conn, voucherId) {
  const [[v]] = await conn.query(
    `SELECT * FROM vouchers
      WHERE id = ? AND party_type = 'vendor'
        AND (voucher_type = 'payment' OR (voucher_type = 'receipt' AND reference = 'vendor-refund'))
      FOR UPDATE`,
    [voucherId]
  )
  if (!v) throw new Error('Vendor payment not found.')
  if (v.voucher_type === 'receipt') {
    // undo "Receive from vendor": the money goes back out, the vendor owes us again
    await conn.query(
      'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?',
      [v.amount, v.account_id]
    )
    await conn.query(
      'UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?',
      [v.amount, v.party_id]
    )
    await conn.query(
      `DELETE FROM vendor_ledger WHERE vendor_id = ? AND entry_type = 'refund' AND reference_type = 'voucher' AND reference_id = ?`,
      [v.party_id, v.id]
    )
    await conn.query('DELETE FROM vouchers WHERE id = ?', [v.id])
    return { deleted: true, amount: Number(v.amount) }
  }
  await conn.query(
    'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
    [v.amount, v.account_id]
  )
  await conn.query(
    'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
    [v.amount, v.party_id]
  )
  await conn.query(
    `DELETE FROM vendor_ledger WHERE vendor_id = ? AND entry_type = 'payment' AND reference_type = 'voucher' AND reference_id = ?`,
    [v.party_id, v.id]
  )
  await conn.query('DELETE FROM vouchers WHERE id = ?', [v.id])
  return { deleted: true, amount: Number(v.amount) }
}

// Undo a bill (mistake). Blocked while payments are linked to it (delete those first).
export async function deleteBill(conn, poId) {
  const [[po]] = await conn.query(
    'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
    [poId]
  )
  if (!po) throw new Error('Bill not found.')
  const [[{ n }]] = await conn.query(
    'SELECT COUNT(*) AS n FROM vouchers WHERE purchase_order_id = ?',
    [poId]
  )
  if (n > 0)
    throw new Error(
      'This bill has a payment made with it — delete that payment first (vendor ledger).'
    )
  const [[{ rn }]] = await conn.query(
    'SELECT COUNT(*) AS rn FROM purchase_returns WHERE purchase_order_id = ?',
    [poId]
  )
  if (rn > 0)
    throw new Error(
      'This bill has returns to the vendor — delete those returns first.'
    )
  if (po.status === 'received') {
    if (po.vendor_id)
      await conn.query(
        'UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?',
        [po.total_incl_tax, po.vendor_id]
      )
    if (po.adds_stock) {
      const [items] = await conn.query(
        'SELECT item_id, quantity FROM purchase_order_items WHERE purchase_order_id = ? AND item_id IS NOT NULL',
        [poId]
      )
      // Some of this bill's goods may already be sold — then the bill can't be undone
      // (it would push stock below 0).
      for (const it of items) {
        const [[cur]] = await conn.query(
          'SELECT name, current_stock FROM items WHERE id = ?',
          [it.item_id]
        )
        if (cur && Number(cur.current_stock) + 0.0001 < Number(it.quantity))
          throw new Error(
            `Can't delete this bill: ${Number(it.quantity)} of "${cur.name}" came with it but only ` +
              `${Number(cur.current_stock)} are in stock now (the rest was sold).`
          )
      }
      for (const it of items)
        await postStockMovement(conn, {
          itemId: it.item_id,
          movementType: 'adjustment',
          quantityOut: Number(it.quantity),
          referenceType: 'purchase_delete',
          referenceId: poId
        })
    }
  }
  await conn.query(
    `DELETE FROM vendor_ledger WHERE entry_type = 'bill' AND reference_type = 'purchase' AND reference_id = ?`,
    [poId]
  )
  await conn.query(
    'DELETE FROM purchase_order_items WHERE purchase_order_id = ?',
    [poId]
  )
  await conn.query('DELETE FROM purchase_orders WHERE id = ?', [poId])
  return { deleted: true }
}

// Vendor statement: opening (before `from`), every bill (+) / payment (−) with running balance.
export async function vendorLedger(db, vendorId, from, to) {
  const [[vendor]] = await db.query(
    'SELECT id, code, name, telephone, address, gst_reg_no, ntn, opening_balance, current_balance FROM vendors WHERE id = ?',
    [vendorId]
  )
  if (!vendor) throw new Error('Vendor not found.')
  const [[after]] = await db.query(
    `SELECT COALESCE(SUM(debit - credit),0) AS net FROM vendor_ledger WHERE vendor_id = ?${from ? ' AND entry_date >= ?' : ''}`,
    from ? [vendorId, from] : [vendorId]
  )
  const opening = r2(Number(vendor.current_balance) - Number(after.net))
  const args = [vendorId]
  let w = ''
  if (from) {
    w += ' AND l.entry_date >= ?'
    args.push(from)
  }
  if (to) {
    w += ' AND l.entry_date <= ?'
    args.push(to)
  }
  const [rows] = await db.query(
    `SELECT l.id, l.entry_date, l.entry_type, l.reference_type, l.reference_id, l.debit, l.credit, l.description,
            po.serial_no, po.vendor_bill_no, po.adds_stock, vv.voucher_no, vv.reference AS voucher_reference,
            a.name AS account_name, a.type AS account_type,
            pr.return_no, pr.settlement, pr.purchase_order_id AS return_bill_id
       FROM vendor_ledger l
       LEFT JOIN purchase_orders po ON l.reference_type = 'purchase' AND po.id = l.reference_id
       LEFT JOIN purchase_returns pr ON l.reference_type = 'purchase_return' AND pr.id = l.reference_id
       LEFT JOIN vouchers vv ON l.reference_type = 'voucher' AND vv.id = l.reference_id
       LEFT JOIN accounts a ON a.id = vv.account_id
      WHERE l.vendor_id = ?${w}
      ORDER BY l.entry_date ASC, l.id ASC`,
    args
  )
  const billIds = rows
    .filter((r) => r.entry_type === 'bill' && r.reference_id)
    .map((r) => r.reference_id)
  const linesBy = {}
  if (billIds.length) {
    const [ls] = await db.query(
      `SELECT purchase_order_id, description, quantity, rate, amount, item_id FROM purchase_order_items
        WHERE purchase_order_id IN (?) ORDER BY id`,
      [billIds]
    )
    for (const l of ls)
      (linesBy[l.purchase_order_id] ||= []).push({
        description: l.description,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        amount: Number(l.amount),
        linked: !!l.item_id
      })
  }
  let bal = opening
  const out = rows.map((r) => {
    bal = r2(bal + Number(r.debit) - Number(r.credit))
    return {
      id: r.id,
      date: r.entry_date,
      type: r.entry_type,
      description: r.description,
      bill: Number(r.debit),
      paid: Number(r.credit),
      balance: bal,
      billId: r.entry_type === 'bill' ? r.reference_id : null,
      // payments, and money received back with "Receive from vendor", can be deleted here
      // (refunds that belong to a return are undone by deleting that return)
      voucherId:
        r.reference_type === 'voucher' &&
        (r.entry_type === 'payment' ||
          (r.entry_type === 'refund' &&
            r.voucher_reference === 'vendor-refund'))
          ? r.reference_id
          : null,
      serial: r.serial_no,
      vendorBillNo: r.vendor_bill_no,
      stockAdded: !!r.adds_stock,
      voucherNo: r.voucher_no,
      account: r.account_name,
      accountType: r.account_type,
      returnId: r.entry_type === 'return' ? r.reference_id : null,
      returnNo: r.return_no,
      settlement: r.settlement,
      returnBillId: r.return_bill_id,
      lines: r.entry_type === 'bill' ? linesBy[r.reference_id] || [] : undefined
    }
  })
  return {
    vendor,
    opening,
    rows: out,
    totals: {
      billed: r2(out.reduce((s, r) => s + r.bill, 0)),
      paid: r2(out.reduce((s, r) => s + r.paid, 0)),
      closing: bal
    }
  }
}

// ─────────────────────────── Bill edit ───────────────────────────
// Change a bill's product types (qty / total / name, add or remove types) or, for an
// amount-only bill, its amount. The vendor balance and the bill's ledger row move by the
// difference; stock follows if the bill added stock; every edit is kept in purchase_bill_edits.
export async function editBill(conn, p) {
  const [[po]] = await conn.query(
    'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
    [p.poId]
  )
  if (!po) throw new Error('Bill not found.')
  if (po.status !== 'received')
    throw new Error('Only recorded bills can be edited.')
  const [old] = await conn.query(
    'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id',
    [po.id]
  )
  const returnedBy = await returnedQtyByLine(conn, po.id)
  const oldById = new Map(old.map((l) => [l.id, l]))
  const changes = []

  const next = []
  for (const ln of p.lines || []) {
    const desc = String(ln.description || '').trim()
    const qty = Number(ln.quantity) || 0
    const total = r2(ln.lineTotal)
    if (!ln.id && !desc && !qty && !total) continue // empty new row
    if (!desc) throw new Error('Every line needs a product type / name.')
    if (qty <= 0) throw new Error(`Quantity must be more than 0 for "${desc}".`)
    if (total <= 0) throw new Error(`Enter the total price for "${desc}".`)
    const was = ln.id ? oldById.get(Number(ln.id)) : null
    if (ln.id && !was)
      throw new Error('A line of this bill was not found — reopen the bill.')
    const ret = was ? returnedBy.get(was.id) || 0 : 0
    if (qty + 0.0001 < ret)
      throw new Error(
        `"${desc}": ${ret} piece(s) were already returned — quantity can't go below that.`
      )
    let item = null
    const itemId = was
      ? was.item_id
      : po.adds_stock && ln.itemId
        ? Number(ln.itemId)
        : null
    if (itemId) {
      ;[[item]] = await conn.query('SELECT id, unit FROM items WHERE id = ?', [
        itemId
      ])
      if (!item) throw new Error('A linked inventory item was not found.')
    }
    next.push({
      id: was?.id || null,
      desc,
      qty,
      total,
      rate: r2(total / qty),
      itemId: item?.id || null,
      unit: item?.unit || was?.unit || 'Pcs',
      was
    })
  }
  const keptIds = new Set(next.filter((l) => l.id).map((l) => l.id))
  const removed = old.filter((l) => !keptIds.has(l.id))
  for (const l of removed)
    if ((returnedBy.get(l.id) || 0) > 0)
      throw new Error(
        `"${l.description}" has returned pieces — it can't be removed from the bill.`
      )

  const oldTotal = r2(po.total_incl_tax)
  let newTotal
  if (next.length) newTotal = r2(next.reduce((s, l) => s + l.total, 0))
  else if (old.length)
    throw new Error(
      'A bill needs at least one product type (or delete the bill).'
    )
  else newTotal = r2(p.billAmount) // amount-only bill
  if (newTotal <= 0) throw new Error('The bill total must be more than 0.')

  for (const l of next) {
    if (l.was) {
      const w = l.was
      const bits = []
      if (w.description !== l.desc)
        bits.push(`name "${w.description}" → "${l.desc}"`)
      if (Number(w.quantity) !== l.qty)
        bits.push(`qty ${Number(w.quantity)} → ${l.qty}`)
      if (r2(w.amount) !== l.total)
        bits.push(`total ${r2(w.amount)} → ${l.total}`)
      if (bits.length) {
        changes.push(`${l.desc}: ${bits.join(', ')}`)
        await conn.query(
          'UPDATE purchase_order_items SET description = ?, quantity = ?, rate = ?, amount = ?, value_incl_tax = ? WHERE id = ?',
          [l.desc, l.qty, l.rate, l.total, l.total, w.id]
        )
      }
    } else {
      changes.push(`added ${l.desc} (qty ${l.qty}, total ${l.total})`)
      await conn.query(
        `INSERT INTO purchase_order_items
           (purchase_order_id, item_id, description, quantity, unit, rate, amount, gst_rate, gst_amount, value_incl_tax)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
        [po.id, l.itemId, l.desc, l.qty, l.unit, l.rate, l.total, l.total]
      )
    }
  }
  for (const l of removed) {
    changes.push(
      `removed ${l.description} (qty ${Number(l.quantity)}, total ${r2(l.amount)})`
    )
    await conn.query('DELETE FROM purchase_order_items WHERE id = ?', [l.id])
  }
  if (!next.length && !old.length && newTotal !== oldTotal)
    changes.push(`amount ${oldTotal} → ${newTotal}`)

  // stock follows the quantity change (only for bills that added stock)
  if (po.adds_stock) {
    const sumBy = (rows) =>
      rows.reduce(
        (m, r) => (r.item ? m.set(r.item, (m.get(r.item) || 0) + r.q) : m),
        new Map()
      )
    const before = sumBy(
      old.map((l) => ({ item: l.item_id, q: Number(l.quantity) }))
    )
    const after = sumBy(next.map((l) => ({ item: l.itemId, q: l.qty })))
    for (const itemId of new Set([...before.keys(), ...after.keys()])) {
      const d = (after.get(itemId) || 0) - (before.get(itemId) || 0)
      if (Math.abs(d) < 0.0001) continue
      const rate = next.find((l) => l.itemId === itemId)?.rate || 0
      await postStockMovement(conn, {
        itemId,
        movementType: d > 0 ? 'purchase' : 'adjustment',
        quantityIn: d > 0 ? d : 0,
        quantityOut: d < 0 ? -d : 0,
        unitCost: d > 0 ? rate : 0,
        referenceType: 'purchase_edit',
        referenceId: po.id,
        movementDate: po.order_date
      })
    }
  }

  const billDate = p.billDate || po.order_date
  const vendorBillNo =
    p.vendorBillNo !== undefined
      ? String(p.vendorBillNo).trim() || null
      : po.vendor_bill_no
  if (billDate !== po.order_date)
    changes.push(`date ${po.order_date} → ${billDate}`)
  if ((vendorBillNo || null) !== (po.vendor_bill_no || null))
    changes.push(
      `vendor bill # "${po.vendor_bill_no || ''}" → "${vendorBillNo || ''}"`
    )
  if (!changes.length) throw new Error('Nothing was changed.')

  await conn.query(
    'UPDATE purchase_orders SET sub_total = ?, total_incl_tax = ?, order_date = ?, vendor_bill_no = ?, remarks = ? WHERE id = ?',
    [
      newTotal,
      newTotal,
      billDate,
      vendorBillNo,
      p.remarks !== undefined ? String(p.remarks).trim() || null : po.remarks,
      po.id
    ]
  )
  const delta = r2(newTotal - oldTotal)
  if (delta)
    await conn.query(
      'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
      [delta, po.vendor_id]
    )
  // the bill's ledger row shows the bill as it is NOW (same place in the statement)
  const types = next.length
  await conn.query(
    `UPDATE vendor_ledger SET debit = ?, entry_date = ?, description = ?
      WHERE entry_type = 'bill' AND reference_type = 'purchase' AND reference_id = ?`,
    [
      newTotal,
      billDate,
      `Bill ${po.serial_no}${vendorBillNo ? ' (vendor #' + vendorBillNo + ')' : ''}` +
        (types ? ` · ${types} type${types > 1 ? 's' : ''}` : ' · amount only') +
        ' · edited',
      po.id
    ]
  )
  const reason = String(p.reason || '').trim() || null
  await conn.query(
    'INSERT INTO purchase_bill_edits (purchase_order_id, old_total, new_total, reason, changes, edited_by) VALUES (?, ?, ?, ?, ?, ?)',
    [po.id, oldTotal, newTotal, reason, changes.join('; '), p.createdBy || null]
  )
  return {
    poId: po.id,
    serial: po.serial_no,
    oldTotal,
    newTotal,
    delta,
    changes
  }
}

// ───────────────────── Return to vendor (defective / short) ─────────────────────
async function returnedQtyByLine(conn, poId) {
  const [rows] = await conn.query(
    `SELECT ri.po_item_id, SUM(ri.quantity) AS q
       FROM purchase_return_items ri JOIN purchase_returns r ON r.id = ri.return_id
      WHERE r.purchase_order_id = ? GROUP BY ri.po_item_id`,
    [poId]
  )
  return new Map(rows.map((r) => [r.po_item_id, Number(r.q)]))
}

async function nextReturnNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(return_no, 'PR-', '') AS UNSIGNED)), 0) + 1 AS next
       FROM purchase_returns WHERE return_no LIKE 'PR-%'`
  )
  return 'PR-' + String(r.next).padStart(4, '0')
}
async function nextReceiptVoucherNo(conn) {
  const [[r]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(REPLACE(voucher_no, 'RV-', '') AS UNSIGNED)), 0) + 1 AS next
       FROM vouchers WHERE voucher_type = 'receipt' AND voucher_no LIKE 'RV-%'`
  )
  return 'RV-' + String(r.next).padStart(3, '0')
}

// items: [{ poItemId, quantity }]   settlement: 'deduct' | 'refund' | 'none'
export async function createReturn(conn, p) {
  const [[po]] = await conn.query(
    'SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE',
    [p.poId]
  )
  if (!po) throw new Error('Bill not found.')
  const [[v]] = await conn.query(
    'SELECT id, name, current_balance FROM vendors WHERE id = ? FOR UPDATE',
    [po.vendor_id]
  )
  if (!v) throw new Error('Vendor not found.')
  const [lines] = await conn.query(
    'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
    [po.id]
  )
  if (!lines.length)
    throw new Error(
      'This bill has no product types to return (amount-only bill) — edit the bill amount instead.'
    )
  const byId = new Map(lines.map((l) => [l.id, l]))
  const returnedBy = await returnedQtyByLine(conn, po.id)
  const picked = []
  for (const it of p.items || []) {
    const q = Number(it.quantity) || 0
    if (q <= 0) continue
    const l = byId.get(Number(it.poItemId))
    if (!l) throw new Error('A returned line does not belong to this bill.')
    const left = Number(l.quantity) - (returnedBy.get(l.id) || 0)
    if (q > left + 0.0001)
      throw new Error(
        `"${l.description}": only ${left} piece(s) can still be returned.`
      )
    picked.push({ l, q, amount: r2(q * Number(l.rate)) })
  }
  if (!picked.length)
    throw new Error(
      'Enter how many pieces of at least one type are being returned.'
    )
  const settlement = ['deduct', 'refund', 'none'].includes(p.settlement)
    ? p.settlement
    : 'deduct'
  const total = r2(picked.reduce((s, x) => s + x.amount, 0))
  const date = p.date || localToday()
  const returnNo = await nextReturnNo(conn)
  let acct = null
  if (settlement === 'refund') {
    if (!p.accountId)
      throw new Error('Choose where the money came in: Cash in Hand or Online.')
    ;[[acct]] = await conn.query(
      'SELECT id, name, type FROM accounts WHERE id = ? AND is_active = 1',
      [p.accountId]
    )
    if (!acct) throw new Error('Account not found.')
  }
  const reason = String(p.reason || '').trim() || null
  const [res] = await conn.query(
    `INSERT INTO purchase_returns (return_no, purchase_order_id, vendor_id, return_date, total_amount, settlement, account_id, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      returnNo,
      po.id,
      v.id,
      date,
      total,
      settlement,
      acct?.id || null,
      reason,
      p.createdBy || null
    ]
  )
  const returnId = res.insertId
  for (const x of picked) {
    await conn.query(
      'INSERT INTO purchase_return_items (return_id, po_item_id, item_id, description, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [returnId, x.l.id, x.l.item_id, x.l.description, x.q, x.l.rate, x.amount]
    )
    if (po.adds_stock && x.l.item_id)
      await postStockMovement(conn, {
        itemId: x.l.item_id,
        movementType: 'purchase_return',
        quantityOut: x.q,
        referenceType: 'purchase_return',
        referenceId: returnId,
        movementDate: date
      })
  }
  const what = picked.map((x) => `${x.q} × ${x.l.description}`).join(', ')
  const label = {
    deduct: 'deducted from balance',
    refund: `vendor paid back (${acct?.name})`,
    none: 'replacement / no deduction'
  }[settlement]
  // 'return' row: we owe less (credit) — zero for "replacement / no deduction"
  await postVendorLedger(conn, {
    vendorId: v.id,
    date,
    entryType: 'return',
    referenceType: 'purchase_return',
    referenceId: returnId,
    credit: settlement === 'none' ? 0 : total,
    createdBy: p.createdBy,
    description: `${returnNo} · returned ${what} (bill ${po.serial_no}) · ${label}`
  })
  let refund = null
  if (settlement === 'deduct') {
    await conn.query(
      'UPDATE vendors SET current_balance = current_balance - ? WHERE id = ?',
      [total, v.id]
    )
  } else if (settlement === 'refund') {
    // Money came IN from the vendor: receipt voucher, account up; ledger 'refund' row (debit)
    // cancels the return's credit, so the vendor balance is unchanged overall.
    const vno = await nextReceiptVoucherNo(conn)
    const [vr] = await conn.query(
      `INSERT INTO vouchers (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method,
                             reference, purchase_order_id, description, voucher_date, created_by)
       VALUES (?, 'receipt', 'vendor', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vno,
        v.id,
        acct.id,
        total,
        acct.type === 'bank' ? 'bank' : 'cash',
        returnNo,
        po.id,
        `Refund from ${v.name} for ${returnNo}`,
        date,
        p.createdBy || null
      ]
    )
    await conn.query(
      'UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?',
      [total, acct.id]
    )
    await conn.query(
      'UPDATE purchase_returns SET voucher_id = ? WHERE id = ?',
      [vr.insertId, returnId]
    )
    await postVendorLedger(conn, {
      vendorId: v.id,
      date,
      entryType: 'refund',
      referenceType: 'voucher',
      referenceId: vr.insertId,
      debit: total,
      createdBy: p.createdBy,
      description: `${vno} · money received back for ${returnNo} (${acct.name})`
    })
    refund = { voucherNo: vno, account: acct.name }
  }
  return { returnId, returnNo, total, settlement, items: picked.length, refund }
}

// Undo a return (mistake): stock back in, balance / money back, ledger rows removed.
export async function deleteReturn(conn, returnId) {
  const [[r]] = await conn.query(
    'SELECT * FROM purchase_returns WHERE id = ? FOR UPDATE',
    [returnId]
  )
  if (!r) throw new Error('Return not found.')
  const [[po]] = await conn.query(
    'SELECT adds_stock FROM purchase_orders WHERE id = ?',
    [r.purchase_order_id]
  )
  const [items] = await conn.query(
    'SELECT * FROM purchase_return_items WHERE return_id = ?',
    [r.id]
  )
  if (po?.adds_stock)
    for (const it of items)
      if (it.item_id)
        await postStockMovement(conn, {
          itemId: it.item_id,
          movementType: 'adjustment',
          quantityIn: Number(it.quantity),
          unitCost: Number(it.rate),
          referenceType: 'purchase_return_delete',
          referenceId: r.id
        })
  if (r.settlement === 'deduct')
    await conn.query(
      'UPDATE vendors SET current_balance = current_balance + ? WHERE id = ?',
      [r.total_amount, r.vendor_id]
    )
  if (r.settlement === 'refund' && r.voucher_id) {
    const [[vv]] = await conn.query('SELECT * FROM vouchers WHERE id = ?', [
      r.voucher_id
    ])
    if (vv) {
      await conn.query(
        'UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?',
        [vv.amount, vv.account_id]
      )
      await conn.query(
        `DELETE FROM vendor_ledger WHERE entry_type = 'refund' AND reference_type = 'voucher' AND reference_id = ?`,
        [vv.id]
      )
      await conn.query(
        'UPDATE purchase_returns SET voucher_id = NULL WHERE id = ?',
        [r.id]
      )
      await conn.query('DELETE FROM vouchers WHERE id = ?', [vv.id])
    }
  }
  await conn.query(
    `DELETE FROM vendor_ledger WHERE entry_type = 'return' AND reference_type = 'purchase_return' AND reference_id = ?`,
    [r.id]
  )
  await conn.query('DELETE FROM purchase_returns WHERE id = ?', [r.id]) // items cascade
  return { deleted: true, returnNo: r.return_no }
}

// Everything the bill screen needs: lines (+ returned qty), returns, edit history, payments.
export async function billDetail(db, poId) {
  const [[po]] = await db.query(
    `SELECT p.*, v.name AS vendor, v.current_balance AS vendor_balance
       FROM purchase_orders p LEFT JOIN vendors v ON v.id = p.vendor_id WHERE p.id = ?`,
    [poId]
  )
  if (!po) throw new Error('Bill not found.')
  const [items] = await db.query(
    `SELECT poi.id, poi.item_id, poi.description, poi.quantity, poi.rate, poi.amount, i.item_code, i.name AS item_name
       FROM purchase_order_items poi LEFT JOIN items i ON i.id = poi.item_id
      WHERE poi.purchase_order_id = ? ORDER BY poi.id`,
    [poId]
  )
  const returnedBy = await returnedQtyByLine(db, poId)
  const [returns] = await db.query(
    `SELECT r.id, r.return_no, r.return_date, r.total_amount, r.settlement, r.reason, a.name AS account_name
       FROM purchase_returns r LEFT JOIN accounts a ON a.id = r.account_id
      WHERE r.purchase_order_id = ? ORDER BY r.id`,
    [poId]
  )
  const [rItems] = returns.length
    ? await db.query(
        'SELECT return_id, description, quantity, amount FROM purchase_return_items WHERE return_id IN (?)',
        [returns.map((r) => r.id)]
      )
    : [[]]
  const [edits] = await db.query(
    `SELECT e.old_total, e.new_total, e.reason, e.changes, e.edited_at, u.full_name AS by_user
       FROM purchase_bill_edits e LEFT JOIN users u ON u.id = e.edited_by
      WHERE e.purchase_order_id = ? ORDER BY e.id DESC`,
    [poId]
  )
  const [payments] = await db.query(
    `SELECT v.voucher_no, v.amount, v.voucher_date, a.name AS account_name FROM vouchers v LEFT JOIN accounts a ON a.id = v.account_id
      WHERE v.purchase_order_id = ? AND v.voucher_type = 'payment'`,
    [poId]
  )
  const lines = items.map((l) => {
    const returned = returnedBy.get(l.id) || 0
    return {
      ...l,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
      amount: Number(l.amount),
      returned,
      returnable: +(Number(l.quantity) - returned).toFixed(2)
    }
  })
  const returnedValue = r2(
    returns
      .filter((r) => r.settlement !== 'none')
      .reduce((s, r) => s + Number(r.total_amount), 0)
  )
  return {
    ...po,
    total: Number(po.total_incl_tax),
    lines,
    returns: returns.map((r) => ({
      ...r,
      total_amount: Number(r.total_amount),
      items: rItems.filter((i) => i.return_id === r.id)
    })),
    returnedValue,
    netTotal: r2(Number(po.total_incl_tax) - returnedValue),
    edits,
    payments
  }
}
