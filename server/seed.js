// Demo data for a FRESH web database, created through the real handlers (same rules,
// vouchers, ledgers and stock history as a real shop day) — not raw INSERTs.
import pool from '../src/main/db/pool.js'
import { requestContext } from '../src/main/services/request.context.js'

const ymd = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export async function seedDemoData(handlers) {
  const [[admin]] = await pool.query(
    `SELECT id FROM users WHERE role = 'administrator' AND is_active = 1 ORDER BY id LIMIT 1`
  )
  const [salesmanUser] = await pool.query(`SELECT id FROM users WHERE username = 'Salesman'`)

  return requestContext.run({ userId: admin.id }, async () => {
    const call = async (channel, payload) => {
      const fn = handlers.get(channel)
      if (!fn) throw new Error(`no handler ${channel}`)
      const r = await fn({ sender: null }, { actingUserId: admin.id, ...(payload || {}) })
      if (!r?.ok) throw new Error(`${channel}: ${r?.error}`)
      return r.data
    }
    const step = async (label, fn) => {
      try {
        return await fn()
      } catch (e) {
        console.warn(`[seed] ${label} failed:`, e.message)
        return null
      }
    }

    // ---- Shop profile ----
    await step('profile', () =>
      pool.query(
        `UPDATE companies SET receipt_header = ?, receipt_tagline = ?, receipt_footer = ?
          WHERE id = 1`,
        ['Brand Lover Family Store', 'Quality clothing for the whole family', 'Thanks For Your Visit!']
      )
    )

    // ---- Accounts / users ----
    const [accts] = await pool.query(`SELECT id, type FROM accounts ORDER BY id`)
    const cash = accts.find((a) => a.type === 'cash')?.id
    const bank = accts.find((a) => a.type === 'bank')?.id

    // ---- Salesmen ----
    const sm1 = await step('salesman', () => call('salesmen:create', { name: 'Ali Raza', phone: '0300-1112233' }))
    const sm2 = await step('salesman', () => call('salesmen:create', { name: 'Hamza Iqbal', phone: '0301-4445566' }))

    // ---- Categories / brands / items ----
    const cats = {}
    for (const [name, subs] of [
      ['MENS', ['Shirts', 'Trousers', 'Shalwar Kameez']],
      ['WOMENS', ['Lawn Suits', 'Dupatta']],
      ['KIDS', ['Kids Wear']]
    ]) {
      const c = await step('category', () => call('inventory:categories:create', { name }))
      if (!c) continue
      cats[name] = { id: c.id, subs: {} }
      for (const s of subs) {
        const sc = await step('subcategory', () =>
          call('inventory:subcategories:create', { categoryId: c.id, name: s })
        )
        if (sc) cats[name].subs[s] = sc.id
      }
    }
    const brand = async (name) => (await step('brand', () => call('inventory:brands:create', { name })))?.id
    const bHouse = await brand('Brand Lover')
    const bClassic = await brand('Classic Wear')

    const itemDefs = [
      ['MENS', 'Shirts', 'Formal Shirt White', 'L', 1200, 1999, 10, 25, bClassic],
      ['MENS', 'Shirts', 'Casual Check Shirt', 'M', 950, 1599, 0, 18, bHouse],
      ['MENS', 'Trousers', 'Cotton Trouser Khaki', '32', 1100, 1899, 5, 14, bClassic],
      ['MENS', 'Shalwar Kameez', 'Wash & Wear Suit', 'Free', 2200, 3499, 0, 12, bHouse],
      ['WOMENS', 'Lawn Suits', 'Printed Lawn 3-Pc', 'Free', 2600, 3999, 10, 20, bHouse],
      ['WOMENS', 'Dupatta', 'Chiffon Dupatta', 'Free', 450, 799, 0, 30, bHouse],
      ['KIDS', 'Kids Wear', 'Kids T-Shirt Pack', '6-7Y', 500, 899, 0, 3, bClassic], // low stock
      ['KIDS', 'Kids Wear', 'Kids Denim Jeans', '8-9Y', 800, 1399, 0, 9, bClassic]
    ]
    const items = []
    for (const [cat, sub, name, size, pp, sp, disc, open, brandId] of itemDefs) {
      const it = await step(`item ${name}`, () =>
        call('inventory:items:create', {
          name,
          size,
          pcs: 1,
          categoryId: cats[cat]?.id,
          subCategoryId: cats[cat]?.subs[sub] || null,
          brandId,
          unit: 'Pcs',
          purchasePrice: pp,
          sellingPrice: sp,
          discountPercent: disc,
          reorderQuantity: 5,
          lowStockThreshold: 4,
          openingStock: open
        })
      )
      if (it) items.push({ id: it.id, name, rate: sp, disc })
    }

    // ---- Customers ----
    const usman = await step('customer', () =>
      call('sales:create-customer', {
        name: 'Usman Traders',
        telephone: '0302-7654321',
        address: 'Shahi Road, Rahim Yar Khan',
        openingBalance: 0,
        creditLimit: 50000
      })
    )
    const ahmed = await step('customer', () =>
      call('sales:create-customer', {
        name: 'Ahmed Khan',
        telephone: '0333-1234567',
        address: 'Model Town',
        openingBalance: 0,
        creditLimit: 0
      })
    )
    const [[walkIn]] = await pool.query(`SELECT id FROM customers WHERE is_walk_in = 1 LIMIT 1`)

    // ---- Vendors + a purchase bill (adds stock) + part payment ----
    const v1 = await step('vendor', () =>
      call('purchases:create-vendor', {
        name: 'Faisalabad Cloth House',
        telephone: '041-2233445',
        address: 'Kapra Market, Faisalabad',
        openingBalance: 0
      })
    )
    await step('vendor', () =>
      call('purchases:create-vendor', {
        name: 'Lahore Garments Co.',
        telephone: '042-3344556',
        address: 'Azam Cloth Market, Lahore',
        openingBalance: 15000
      })
    )
    if (v1 && items.length >= 6) {
      await step('purchase bill', () =>
        call('purchases:create-bill', {
          vendorId: v1.id,
          vendorBillNo: 'FCH-2231',
          billDate: ymd(-6),
          addToStock: true,
          lines: [
            { itemId: items[0].id, description: items[0].name, quantity: 10, rate: 1200 },
            { itemId: items[4].id, description: items[4].name, quantity: 8, rate: 2600 },
            { itemId: items[5].id, description: items[5].name, quantity: 20, rate: 450 }
          ]
        })
      )
      await step('pay vendor', () =>
        call('purchases:pay-vendor', {
          vendorId: v1.id,
          amount: 15000,
          accountId: cash,
          date: ymd(-5),
          note: 'Part payment'
        })
      )
    }

    // ---- Sales over the last few days ----
    const line = (i, qty) => ({
      itemId: items[i].id,
      quantity: qty,
      rate: items[i].rate,
      discountMode: 'percent',
      discountValue: items[i].disc
    })
    const total = (ls) =>
      ls.reduce((s, l) => s + +(l.quantity * l.rate * (1 - (l.discountValue || 0) / 100)).toFixed(2), 0)
    const sale = (label, p) =>
      step(label, () => call('sales:create', { invoiceType: 'counter', remarks: '', ...p }))

    if (items.length === itemDefs.length) {
      let ls = [line(0, 2), line(5, 1)]
      const cashSale = await sale('cash sale', {
        paymentType: 'cash', customerId: walkIn.id, accountId: cash, invoiceDate: ymd(-3),
        lines: ls, amountReceived: Math.ceil(total(ls) / 100) * 100, salesmanId: sm1?.id
      })
      ls = [line(4, 2), line(2, 1)]
      await sale('credit sale (overdue)', {
        paymentType: 'credit', customerId: usman?.id, accountId: cash, invoiceDate: ymd(-2),
        dueDate: ymd(-1), lines: ls, amountReceived: 2000, salesmanId: sm2?.id
      })
      ls = [line(3, 1), line(1, 1)]
      await sale('online sale', {
        paymentType: 'online', customerId: walkIn.id, accountId: bank, invoiceDate: ymd(-1),
        lines: ls, amountReceived: total(ls), salesmanId: sm1?.id
      })
      ls = [line(0, 1), line(7, 2)]
      await sale('cash sale today', {
        paymentType: 'cash', customerId: walkIn.id, accountId: cash, invoiceDate: ymd(0),
        lines: ls, amountReceived: Math.ceil(total(ls) / 500) * 500, salesmanId: sm2?.id
      })
      ls = [line(5, 2), line(6, 1)]
      await sale('credit sale today', {
        paymentType: 'credit', customerId: ahmed?.id, accountId: cash, invoiceDate: ymd(0),
        dueDate: ymd(7), lines: ls, amountReceived: 0, salesmanId: sm1?.id
      })

      // Return one shirt from the first cash sale (cash refund)
      if (cashSale?.saleId) {
        const [[si]] = await pool.query(
          `SELECT id FROM sale_items WHERE sale_id = ? ORDER BY id LIMIT 1`,
          [cashSale.saleId]
        )
        if (si)
          await step('return', () =>
            call('returns:create', {
              saleId: cashSale.saleId,
              lines: [{ saleItemId: si.id, quantity: 1 }],
              refundMode: 'cash',
              accountId: cash,
              reason: 'Size issue'
            })
          )
      }
    }

    // ---- Credit repayment + expense ----
    if (usman)
      await step('repayment', () =>
        call('credit:record-repayment', {
          customerId: usman.id, amount: 3000, accountId: cash, date: ymd(0), note: 'Part payment'
        })
      )
    const catsList = await step('expense cats', () => call('expenses:categories', {}))
    const util = (catsList || []).find?.((c) => /util/i.test(c.name)) || (catsList || [])[0]
    if (util)
      await step('expense', () =>
        call('expenses:create', {
          amount: 2500, date: ymd(0), categoryId: util.id, accountId: cash,
          payee: 'WAPDA', description: 'Electricity bill'
        })
      )

    if (salesmanUser.length) console.log('[seed] demo data ready')
  })
}
