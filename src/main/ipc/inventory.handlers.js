// import { dialog, BrowserWindow } from 'electron'
// import * as XLSX from 'xlsx'
// import pool from '../db/pool.js'
// import {
//   postStockMovement,
//   getRunningBalance
// } from '../services/stock.service.js'
// import { LOW_WHERE, THRESHOLD_SQL } from '../services/stock.alerts.js'

// function pick(normRow, keys) {
//   for (const k of keys) {
//     if (normRow[k] !== undefined && normRow[k] !== '') return normRow[k]
//   }
//   return ''
// }
// function normalizeRow(row) {
//   const out = {}
//   for (const k of Object.keys(row)) {
//     out[k.toLowerCase().replace(/[\s_\-.]/g, '')] = row[k]
//   }
//   return out
// }

// export function registerInventoryHandlers(ipcMain) {
//   // ---------------- Categories ----------------
//   ipcMain.handle('inventory:categories:list', async () => {
//     try {
//       const [rows] = await pool.query(
//         `SELECT c.id, c.code, c.name, c.is_active,
//                 (SELECT COUNT(*) FROM sub_categories sc WHERE sc.category_id = c.id) AS sub_count
//            FROM categories c
//           WHERE c.is_active = 1
//           ORDER BY CAST(c.code AS UNSIGNED), c.name`
//       )
//       return { ok: true, data: rows }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('inventory:categories:create', async (_e, { code, name }) => {
//     try {
//       if (!name || !name.trim())
//         return { ok: false, error: 'Category name is required.' }
//       let finalCode = (code || '').trim()
//       if (!finalCode) {
//         const [[r]] = await pool.query(
//           `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) + 1 AS next FROM categories`
//         )
//         finalCode = String(r.next)
//       }
//       const [res] = await pool.query(
//         `INSERT INTO categories (code, name) VALUES (?, ?)`,
//         [finalCode, name.trim()]
//       )
//       return { ok: true, data: { id: res.insertId, code: finalCode } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('inventory:categories:update', async (_e, { id, name }) => {
//     try {
//       await pool.query(`UPDATE categories SET name = ? WHERE id = ?`, [
//         name.trim(),
//         id
//       ])
//       return { ok: true, data: { id } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle(
//     'inventory:categories:toggle',
//     async (_e, { id, isActive }) => {
//       try {
//         await pool.query(`UPDATE categories SET is_active = ? WHERE id = ?`, [
//           isActive ? 1 : 0,
//           id
//         ])
//         return { ok: true, data: { id } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ---------------- Sub-categories ----------------
//   ipcMain.handle('inventory:subcategories:list', async (_e, { categoryId }) => {
//     try {
//       const [rows] = await pool.query(
//         `SELECT sc.id, sc.code, sc.name, sc.is_active,
//                 (SELECT COUNT(*) FROM items i WHERE i.sub_category_id = sc.id AND i.is_active = 1) AS item_count
//            FROM sub_categories sc
//           WHERE sc.category_id = ? AND sc.is_active = 1
//           ORDER BY CAST(sc.code AS UNSIGNED), sc.name`,
//         [categoryId]
//       )
//       return { ok: true, data: rows }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle(
//     'inventory:subcategories:create',
//     async (_e, { categoryId, code, name }) => {
//       try {
//         if (!categoryId) return { ok: false, error: 'Select a category first.' }
//         if (!name || !name.trim())
//           return { ok: false, error: 'Sub-category name is required.' }
//         let finalCode = (code || '').trim()
//         if (!finalCode) {
//           const [[r]] = await pool.query(
//             `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) AS mx FROM sub_categories WHERE category_id = ?`,
//             [categoryId]
//           )
//           if (r.mx > 0) finalCode = String(r.mx + 1)
//           else {
//             const [[c]] = await pool.query(
//               `SELECT code FROM categories WHERE id = ?`,
//               [categoryId]
//             )
//             finalCode = String(Number(c.code) * 100 + 1)
//           }
//         }
//         const [res] = await pool.query(
//           `INSERT INTO sub_categories (category_id, code, name) VALUES (?, ?, ?)`,
//           [categoryId, finalCode, name.trim()]
//         )
//         return { ok: true, data: { id: res.insertId, code: finalCode } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   ipcMain.handle('inventory:subcategories:update', async (_e, { id, name }) => {
//     try {
//       await pool.query(`UPDATE sub_categories SET name = ? WHERE id = ?`, [
//         name.trim(),
//         id
//       ])
//       return { ok: true, data: { id } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle(
//     'inventory:subcategories:toggle',
//     async (_e, { id, isActive }) => {
//       try {
//         await pool.query(
//           `UPDATE sub_categories SET is_active = ? WHERE id = ?`,
//           [isActive ? 1 : 0, id]
//         )
//         return { ok: true, data: { id } }
//       } catch (err) {
//         return { ok: false, error: err.message }
//       }
//     }
//   )

//   // ---------------- Brands ----------------
//   ipcMain.handle('inventory:brands:list', async () => {
//     try {
//       const [rows] = await pool.query(
//         `SELECT id, name FROM brands WHERE is_active = 1 ORDER BY name`
//       )
//       return { ok: true, data: rows }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('inventory:brands:create', async (_e, { name }) => {
//     try {
//       if (!name || !name.trim())
//         return { ok: false, error: 'Brand name is required.' }
//       const [res] = await pool.query(
//         `INSERT INTO brands (name) VALUES (?)
//          ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), is_active = 1`,
//         [name.trim()]
//       )
//       return { ok: true, data: { id: res.insertId } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   // ---------------- Items ----------------
//   ipcMain.handle('inventory:items:next-code', async () => {
//     try {
//       const [[r]] = await pool.query(
//         `SELECT COALESCE(MAX(CAST(item_code AS UNSIGNED)), 0) + 1 AS next FROM items`
//       )
//       return { ok: true, data: { code: String(r.next).padStart(5, '0') } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   // Item form rules — before, minus prices were saved and a minus opening stock silently became 0.
//   function validateItem(p, isCreate) {
//     if (!p.name || !String(p.name).trim())
//       throw new Error('Item name is required.')
//     const num = (v) => (v === '' || v == null ? 0 : Number(v))
//     if (!Number.isFinite(num(p.purchasePrice)) || num(p.purchasePrice) < 0)
//       throw new Error('Purchase price cannot be negative.')
//     if (!Number.isFinite(num(p.sellingPrice)) || !(num(p.sellingPrice) > 0))
//       throw new Error('Selling price must be more than 0.')
//     if (num(p.discountPercent) < 0 || num(p.discountPercent) > 100)
//       throw new Error('Discount % must be between 0 and 100.')
//     if (num(p.reorderQuantity) < 0 || num(p.lowStockThreshold) < 0)
//       throw new Error('Reorder qty / low-stock alert cannot be negative.')
//     if (isCreate && num(p.openingStock) < 0)
//       throw new Error('Opening stock cannot be negative.')
//   }
//   // The barcode has no unique key in the database — two items with one barcode would make a
//   // scan pick the wrong item, so refuse it here.
//   async function assertBarcodeFree(db, barcode, itemId) {
//     const bc = String(barcode || '').trim()
//     if (!bc) return
//     const [[hit]] = await db.query(
//       `SELECT name FROM items WHERE (barcode = ? OR item_code = ?) AND id <> ? LIMIT 1`,
//       [bc, bc, Number(itemId) || 0]
//     )
//     if (hit)
//       throw new Error(`Barcode "${bc}" is already used by "${hit.name}".`)
//   }
//   // MySQL's "Duplicate entry '00001' for key 'items.item_code'" → plain words
//   function friendlyItemError(err) {
//     if (err && err.code === 'ER_DUP_ENTRY') {
//       if (/barcode/i.test(err.message))
//         return 'This barcode is already used by another item.'
//       return 'This item code is already used by another item.'
//     }
//     return err.message
//   }

//   // An item's category: from its sub-category when one is picked, otherwise the Category the
//   // user chose on its own (before, a Category without a Sub-category was silently dropped).
//   async function itemCategoryId(db, p) {
//     if (p.subCategoryId) {
//       const [[sc]] = await db.query(
//         `SELECT category_id FROM sub_categories WHERE id = ?`,
//         [p.subCategoryId]
//       )
//       if (sc) return sc.category_id
//     }
//     return p.categoryId ? Number(p.categoryId) : null
//   }

//   ipcMain.handle('inventory:items:list', async (_e, params) => {
//     try {
//       const { categoryId, subCategoryId, search, uncategorized, showInactive } =
//         params || {}
//       // showInactive: list the deactivated items so they can be switched back on
//       let where = showInactive
//         ? 'WHERE i.is_active = 0'
//         : 'WHERE i.is_active = 1'
//       const args = []
//       if (uncategorized) {
//         where += ' AND i.sub_category_id IS NULL AND i.category_id IS NULL'
//       } else if (subCategoryId) {
//         where += ' AND i.sub_category_id = ?'
//         args.push(subCategoryId)
//       } else if (categoryId) {
//         where += ' AND COALESCE(sc.category_id, i.category_id) = ?'
//         args.push(categoryId)
//       }
//       if (search && search.trim()) {
//         where +=
//           ' AND (i.name LIKE ? OR i.item_code LIKE ? OR i.barcode LIKE ?)'
//         const s = `%${search.trim()}%`
//         args.push(s, s, s)
//       }
//       const [rows] = await pool.query(
//         `SELECT i.id, i.item_code, i.name, i.description, i.sub_category_id,
//                 i.brand_id, i.purchase_price, i.selling_price, i.unit,
//                 i.size, i.pcs,
//                 i.reorder_quantity, i.low_stock_threshold, i.discount_percent, i.barcode,
//                 i.current_stock, i.average_cost,
//                 (i.current_stock * i.average_cost) AS stock_value,
//                 COALESCE(sc.category_id, i.category_id) AS category_id,
//                 sc.name AS sub_category, c.name AS category, b.name AS brand
//            FROM items i
//            LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
//            LEFT JOIN categories c ON c.id = COALESCE(sc.category_id, i.category_id)
//            LEFT JOIN brands b ON b.id = i.brand_id
//           ${where}
//           ORDER BY i.name`,
//         args
//       )
//       return { ok: true, data: rows }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('inventory:items:create', async (_e, p) => {
//     const conn = await pool.getConnection()
//     try {
//       await conn.beginTransaction()
//       validateItem(p, true)

//       let itemCode = (p.itemCode || '').trim()
//       if (!itemCode) {
//         const [[r]] = await conn.query(
//           `SELECT COALESCE(MAX(CAST(item_code AS UNSIGNED)), 0) + 1 AS next FROM items`
//         )
//         itemCode = String(r.next).padStart(5, '0')
//       }

//       await assertBarcodeFree(conn, p.barcode || itemCode, 0)
//       const categoryId = await itemCategoryId(conn, p)
//       const [res] = await conn.query(
//         `INSERT INTO items
//            (item_code, name, description, category_id, sub_category_id, brand_id,
//             purchase_price, selling_price, unit, size, pcs, reorder_quantity, low_stock_threshold,
//             discount_percent, barcode, current_stock, average_cost)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
//         [
//           itemCode,
//           p.name.trim(),
//           p.description || null,
//           categoryId,
//           p.subCategoryId,
//           p.brandId || null,
//           Number(p.purchasePrice) || 0,
//           Number(p.sellingPrice) || 0,
//           p.unit || 'Pcs',
//           p.size || null,
//           p.pcs || null,
//           Number(p.reorderQuantity) || 0,
//           // "Low Stock Alert (units)" from the item form — was never saved before, so no item
//           // could ever show as low (only Excel import stored it).
//           Math.max(0, Number(p.lowStockThreshold) || 0),
//           Number(p.discountPercent) || 0,
//           (p.barcode || itemCode).trim()
//         ]
//       )

//       const itemId = res.insertId
//       const openQty = Number(p.openingStock) || 0
//       if (openQty > 0) {
//         await postStockMovement(conn, {
//           itemId,
//           movementType: 'opening',
//           quantityIn: openQty,
//           unitCost: Number(p.purchasePrice) || 0,
//           referenceType: 'opening'
//         })
//       }
//       await conn.commit()
//       return { ok: true, data: { id: itemId, item_code: itemCode } }
//     } catch (err) {
//       await conn.rollback()
//       return { ok: false, error: friendlyItemError(err) }
//     } finally {
//       conn.release()
//     }
//   })

//   ipcMain.handle('inventory:items:update', async (_e, p) => {
//     try {
//       validateItem(p, false)
//       await assertBarcodeFree(pool, p.barcode, p.id)
//       const categoryId = await itemCategoryId(pool, p)
//       await pool.query(
//         `UPDATE items SET
//            name = ?, description = ?, category_id = ?, sub_category_id = ?, brand_id = ?,
//            purchase_price = ?, selling_price = ?, unit = ?, size = ?, pcs = ?,
//            reorder_quantity = ?, low_stock_threshold = ?, discount_percent = ?, barcode = ?
//          WHERE id = ?`,
//         [
//           p.name.trim(),
//           p.description || null,
//           categoryId,
//           p.subCategoryId,
//           p.brandId || null,
//           Number(p.purchasePrice) || 0,
//           Number(p.sellingPrice) || 0,
//           p.unit || 'Pcs',
//           p.size || null,
//           p.pcs || null,
//           Number(p.reorderQuantity) || 0,
//           Math.max(0, Number(p.lowStockThreshold) || 0), // was not saved on edit either
//           Number(p.discountPercent) || 0,
//           (p.barcode || '').trim(),
//           p.id
//         ]
//       )
//       return { ok: true, data: { id: p.id } }
//     } catch (err) {
//       return { ok: false, error: friendlyItemError(err) }
//     }
//   })

//   ipcMain.handle('inventory:items:toggle', async (_e, { id, isActive }) => {
//     try {
//       await pool.query(`UPDATE items SET is_active = ? WHERE id = ?`, [
//         isActive ? 1 : 0,
//         id
//       ])
//       return { ok: true, data: { id } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle(
//     'inventory:items:adjust-stock',
//     async (_e, { id, newQuantity, unitCost }) => {
//       const conn = await pool.getConnection()
//       try {
//         await conn.beginTransaction()
//         const target = Number(newQuantity)
//         if (Number.isNaN(target) || target < 0)
//           throw new Error('Enter a valid quantity.')
//         const prev = await getRunningBalance(conn, id)
//         const diff = target - prev.qty
//         if (diff !== 0) {
//           await postStockMovement(conn, {
//             itemId: id,
//             movementType: 'adjustment',
//             quantityIn: diff > 0 ? diff : 0,
//             quantityOut: diff < 0 ? -diff : 0,
//             unitCost: Number(unitCost) || prev.avgCost || 0,
//             referenceType: 'adjustment'
//           })
//         }
//         await conn.commit()
//         return { ok: true, data: { id, newQuantity: target } }
//       } catch (err) {
//         await conn.rollback()
//         return { ok: false, error: err.message }
//       } finally {
//         conn.release()
//       }
//     }
//   )

//   // Quick "set stock + prices" for one item — the Purchases page's Manage Stock & Prices
//   // dialog. Runs as ONE transaction so a failed price write can never leave a stock move
//   // behind (and vice versa). Stock always goes through postStockMovement so the ledger,
//   // running balance, and weighted-average cost all stay consistent with every other path.
//   ipcMain.handle(
//     'inventory:items:update-stock-prices',
//     async (_e, { id, newStock, purchasePrice, sellingPrice } = {}) => {
//       const conn = await pool.getConnection()
//       try {
//         await conn.beginTransaction()

//         const [[item]] = await conn.query(
//           `SELECT id, name, unit FROM items WHERE id = ? AND is_active = 1`,
//           [id]
//         )
//         if (!item) throw new Error('Item not found or inactive.')

//         const pp = Number(purchasePrice)
//         const sp = Number(sellingPrice)
//         if (!Number.isFinite(pp) || pp < 0)
//           throw new Error('Purchase price cannot be negative.')
//         if (!Number.isFinite(sp) || !(sp > 0))
//           throw new Error('Selling price must be more than 0.')

//         await conn.query(
//           `UPDATE items SET purchase_price = ?, selling_price = ? WHERE id = ?`,
//           [pp, sp, id]
//         )

//         let stockChanged = false
//         let fromQty = null
//         let toQty = null

//         // newStock may be omitted (price-only edit) — only touch stock when it was sent.
//         if (newStock !== undefined && newStock !== null && newStock !== '') {
//           const target = Number(newStock)
//           if (!Number.isFinite(target) || target < 0)
//             throw new Error('Stock quantity must be zero or more.')
//           const prev = await getRunningBalance(conn, id)
//           fromQty = Number(prev.qty)
//           toQty = target
//           const diff = target - fromQty
//           // A no-op (same number typed) must NOT write a zero-diff ledger row.
//           if (Math.abs(diff) > 1e-9) {
//             await postStockMovement(conn, {
//               itemId: id,
//               movementType: 'adjustment',
//               quantityIn: diff > 0 ? diff : 0,
//               quantityOut: diff < 0 ? -diff : 0,
//               // Count-correction cost basis = what the shelf already carries, not the
//               // new purchase price (which is only the catalog value for future purchases).
//               unitCost: prev.avgCost || 0,
//               referenceType: 'adjustment'
//             })
//             stockChanged = true
//           }
//         }

//         await conn.commit()
//         return { ok: true, data: { id, stockChanged, fromQty, toQty } }
//       } catch (err) {
//         await conn.rollback()
//         return { ok: false, error: err.message }
//       } finally {
//         conn.release()
//       }
//     }
//   )

//   ipcMain.handle('inventory:items:ledger', async (_e, { id }) => {
//     try {
//       const [rows] = await pool.query(
//         `SELECT id, movement_type, quantity_in, quantity_out, unit_cost,
//                 balance_qty, balance_avg_cost, movement_date
//            FROM stock_ledger
//           WHERE item_id = ?
//           ORDER BY id DESC
//           LIMIT 200`,
//         [id]
//       )
//       return { ok: true, data: rows }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('inventory:items:ensure-barcodes', async () => {
//     try {
//       const [res] = await pool.query(
//         `UPDATE items SET barcode = item_code
//           WHERE (barcode IS NULL OR barcode = '') AND is_active = 1`
//       )
//       return { ok: true, data: { updated: res.affectedRows } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   // LOW_WHERE / THRESHOLD_SQL come from services/stock.alerts.js (one rule app-wide).

//   ipcMain.handle('inventory:items:low-stock', async () => {
//     try {
//       const [rows] = await pool.query(
//         `SELECT i.id, i.item_code, i.name, i.unit, i.size, i.pcs, i.current_stock,
//                 i.reorder_quantity, i.low_stock_threshold, i.average_cost, i.selling_price,
//                 (i.current_stock * i.average_cost) AS stock_value,
//                 ${THRESHOLD_SQL} AS threshold,
//                 sc.name AS sub_category, c.name AS category
//            FROM items i
//            LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
//            LEFT JOIN categories c ON c.id = COALESCE(sc.category_id, i.category_id)
//           WHERE ${LOW_WHERE}
//           ORDER BY (i.current_stock - ${THRESHOLD_SQL}) ASC,
//             i.current_stock ASC`
//       )
//       return { ok: true, data: rows }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('inventory:items:low-stock-count', async () => {
//     try {
//       const [[r]] = await pool.query(
//         `SELECT COUNT(*) AS n FROM items i WHERE ${LOW_WHERE}`
//       )
//       return { ok: true, data: { count: Number(r.n) } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   // ---------------- Excel import ----------------
//   ipcMain.handle('inventory:items:import-template', async () => {
//     try {
//       const win = BrowserWindow.getFocusedWindow()
//       const result = await dialog.showSaveDialog(win, {
//         title: 'Save Import Template',
//         defaultPath: 'items-import-template.xlsx',
//         filters: [{ name: 'Excel', extensions: ['xlsx'] }]
//       })
//       if (result.canceled || !result.filePath)
//         return { ok: true, data: { canceled: true } }
//       const sample = [
//         {
//           Name: 'Example Shirt',
//           Size: 'M',
//           Pcs: 1,
//           Category: 'MENS',
//           SubCategory: 'SHIRT',
//           Brand: 'Generic',
//           ItemCode: '',
//           PurchasePrice: 1200,
//           SellingPrice: 1999,
//           Unit: 'Pcs',
//           ReorderQty: 2,
//           LowStockThreshold: 0,
//           Discount: 10,
//           OpeningStock: 0,
//           Barcode: ''
//         }
//       ]
//       const ws = XLSX.utils.json_to_sheet(sample)
//       const wb = XLSX.utils.book_new()
//       XLSX.utils.book_append_sheet(wb, ws, 'Items')
//       XLSX.writeFile(wb, result.filePath)
//       return { ok: true, data: { path: result.filePath } }
//     } catch (err) {
//       return { ok: false, error: err.message }
//     }
//   })

//   ipcMain.handle('inventory:items:import', async () => {
//     const conn = await pool.getConnection()
//     try {
//       const win = BrowserWindow.getFocusedWindow()
//       const result = await dialog.showOpenDialog(win, {
//         title: 'Import Items from Excel',
//         filters: [{ name: 'Spreadsheet', extensions: ['xlsx', 'xls', 'csv'] }],
//         properties: ['openFile']
//       })
//       if (result.canceled || !result.filePaths.length) {
//         conn.release()
//         return { ok: true, data: { canceled: true } }
//       }

//       const wb = XLSX.readFile(result.filePaths[0])
//       const sheet = wb.Sheets[wb.SheetNames[0]]
//       const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

//       const catCache = new Map()
//       const subCache = new Map()
//       const brandCache = new Map()

//       const [[codeRow]] = await conn.query(
//         `SELECT COALESCE(MAX(CAST(item_code AS UNSIGNED)), 0) AS mx FROM items`
//       )
//       let nextCode = codeRow.mx

//       async function resolveCategory(name) {
//         const key = name.toLowerCase()
//         if (catCache.has(key)) return catCache.get(key)
//         const [ex] = await conn.query(
//           `SELECT id, code FROM categories WHERE name = ? LIMIT 1`,
//           [name]
//         )
//         if (ex.length) {
//           catCache.set(key, ex[0].id)
//           return ex[0].id
//         }
//         const [[r]] = await conn.query(
//           `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) + 1 AS next FROM categories`
//         )
//         const [res] = await conn.query(
//           `INSERT INTO categories (code, name) VALUES (?, ?)`,
//           [String(r.next), name]
//         )
//         catCache.set(key, res.insertId)
//         return res.insertId
//       }
//       async function resolveSub(categoryId, name) {
//         const key = categoryId + '::' + name.toLowerCase()
//         if (subCache.has(key)) return subCache.get(key)
//         const [ex] = await conn.query(
//           `SELECT id FROM sub_categories WHERE category_id = ? AND name = ? LIMIT 1`,
//           [categoryId, name]
//         )
//         if (ex.length) {
//           subCache.set(key, ex[0].id)
//           return ex[0].id
//         }
//         const [[r]] = await conn.query(
//           `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) AS mx FROM sub_categories WHERE category_id = ?`,
//           [categoryId]
//         )
//         let code
//         if (r.mx > 0) code = String(r.mx + 1)
//         else {
//           const [[c]] = await conn.query(
//             `SELECT code FROM categories WHERE id = ?`,
//             [categoryId]
//           )
//           code = String(Number(c.code) * 100 + 1)
//         }
//         const [res] = await conn.query(
//           `INSERT INTO sub_categories (category_id, code, name) VALUES (?, ?, ?)`,
//           [categoryId, code, name]
//         )
//         subCache.set(key, res.insertId)
//         return res.insertId
//       }
//       async function resolveBrand(name) {
//         if (!name) return null
//         const key = name.toLowerCase()
//         if (brandCache.has(key)) return brandCache.get(key)
//         const [res] = await conn.query(
//           `INSERT INTO brands (name) VALUES (?)
//            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
//           [name]
//         )
//         brandCache.set(key, res.insertId)
//         return res.insertId
//       }

//       let imported = 0
//       const errors = []

//       for (let idx = 0; idx < rawRows.length; idx++) {
//         const n = normalizeRow(rawRows[idx])
//         const name = String(pick(n, ['name', 'itemname', 'item'])).trim()
//         const catName = String(pick(n, ['category', 'cat'])).trim()
//         const subName = String(pick(n, ['subcategory', 'subcat'])).trim()
//         if (!name || !catName || !subName) {
//           errors.push(
//             `Row ${idx + 2}: Name, Category and SubCategory are required.`
//           )
//           continue
//         }
//         try {
//           await conn.beginTransaction()
//           const categoryId = await resolveCategory(catName)
//           const subCategoryId = await resolveSub(categoryId, subName)
//           const brandId = await resolveBrand(String(pick(n, ['brand'])).trim())

//           let itemCode = String(pick(n, ['itemcode', 'code'])).trim()
//           if (!itemCode) {
//             nextCode += 1
//             itemCode = String(nextCode).padStart(5, '0')
//           }

//           const purchase =
//             Number(pick(n, ['purchaseprice', 'purchase', 'cost'])) || 0
//           const selling =
//             Number(
//               pick(n, ['sellingprice', 'saleprice', 'selling', 'price'])
//             ) || 0
//           const openQty =
//             Number(pick(n, ['openingstock', 'stock', 'qty', 'quantity'])) || 0
//           const lowStockThreshold =
//             Number(pick(n, ['lowstockthreshold', 'lowstock'])) || 0
//           const barcode = String(pick(n, ['barcode'])).trim() || itemCode
//           const size = String(pick(n, ['size'])).trim() || null
//           const pcs = Number(pick(n, ['pcs'])) || null

//           const [res] = await conn.query(
//             `INSERT INTO items
//                (item_code, name, category_id, sub_category_id, brand_id,
//                 purchase_price, selling_price, unit, size, pcs, reorder_quantity, low_stock_threshold, discount_percent,
//                 barcode, current_stock, average_cost)
//              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
//             [
//               itemCode,
//               name,
//               categoryId || null,
//               subCategoryId,
//               brandId,
//               purchase,
//               selling,
//               String(pick(n, ['unit'])).trim() || 'Pcs',
//               size,
//               pcs,
//               Number(pick(n, ['reorderqty', 'reorder'])) || 0,
//               lowStockThreshold,
//               Number(pick(n, ['discount', 'discountpercent'])) || 0,
//               barcode
//             ]
//           )

//           if (openQty > 0) {
//             await postStockMovement(conn, {
//               itemId: res.insertId,
//               movementType: 'opening',
//               quantityIn: openQty,
//               unitCost: purchase,
//               referenceType: 'opening'
//             })
//           }
//           await conn.commit()
//           imported += 1
//         } catch (rowErr) {
//           await conn.rollback()
//           errors.push(`Row ${idx + 2}: ${rowErr.message}`)
//         }
//       }

//       conn.release()
//       return {
//         ok: true,
//         data: { imported, skipped: errors.length, errors: errors.slice(0, 15) }
//       }
//     } catch (err) {
//       conn.release()
//       return { ok: false, error: err.message }
//     }
//   })
// }

import { dialog, BrowserWindow } from 'electron'
import * as XLSX from 'xlsx'
import pool from '../db/pool.js'
import {
  postStockMovement,
  getRunningBalance
} from '../services/stock.service.js'
import { LOW_WHERE, THRESHOLD_SQL } from '../services/stock.alerts.js'

function pick(normRow, keys) {
  for (const k of keys) {
    if (normRow[k] !== undefined && normRow[k] !== '') return normRow[k]
  }
  return ''
}
function normalizeRow(row) {
  const out = {}
  for (const k of Object.keys(row)) {
    out[k.toLowerCase().replace(/[\s_\-.]/g, '')] = row[k]
  }
  return out
}

export function registerInventoryHandlers(ipcMain) {
  // ---------------- Categories ----------------
  ipcMain.handle('inventory:categories:list', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT c.id, c.code, c.name, c.is_active,
                (SELECT COUNT(*) FROM sub_categories sc WHERE sc.category_id = c.id) AS sub_count
           FROM categories c
          WHERE c.is_active = 1
          ORDER BY CAST(c.code AS UNSIGNED), c.name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:categories:create', async (_e, { code, name }) => {
    try {
      if (!name || !name.trim())
        return { ok: false, error: 'Category name is required.' }
      let finalCode = (code || '').trim()
      if (!finalCode) {
        const [[r]] = await pool.query(
          `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) + 1 AS next FROM categories`
        )
        finalCode = String(r.next)
      }
      const [res] = await pool.query(
        `INSERT INTO categories (code, name) VALUES (?, ?)`,
        [finalCode, name.trim()]
      )
      return { ok: true, data: { id: res.insertId, code: finalCode } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:categories:update', async (_e, { id, name }) => {
    try {
      await pool.query(`UPDATE categories SET name = ? WHERE id = ?`, [
        name.trim(),
        id
      ])
      return { ok: true, data: { id } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(
    'inventory:categories:toggle',
    async (_e, { id, isActive }) => {
      try {
        await pool.query(`UPDATE categories SET is_active = ? WHERE id = ?`, [
          isActive ? 1 : 0,
          id
        ])
        return { ok: true, data: { id } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ---------------- Sub-categories ----------------
  ipcMain.handle('inventory:subcategories:list', async (_e, { categoryId }) => {
    try {
      const [rows] = await pool.query(
        `SELECT sc.id, sc.code, sc.name, sc.is_active,
                (SELECT COUNT(*) FROM items i WHERE i.sub_category_id = sc.id AND i.is_active = 1) AS item_count
           FROM sub_categories sc
          WHERE sc.category_id = ? AND sc.is_active = 1
          ORDER BY CAST(sc.code AS UNSIGNED), sc.name`,
        [categoryId]
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(
    'inventory:subcategories:create',
    async (_e, { categoryId, code, name }) => {
      try {
        if (!categoryId) return { ok: false, error: 'Select a category first.' }
        if (!name || !name.trim())
          return { ok: false, error: 'Sub-category name is required.' }
        let finalCode = (code || '').trim()
        if (!finalCode) {
          const [[r]] = await pool.query(
            `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) AS mx FROM sub_categories WHERE category_id = ?`,
            [categoryId]
          )
          if (r.mx > 0) finalCode = String(r.mx + 1)
          else {
            const [[c]] = await pool.query(
              `SELECT code FROM categories WHERE id = ?`,
              [categoryId]
            )
            finalCode = String(Number(c.code) * 100 + 1)
          }
        }
        const [res] = await pool.query(
          `INSERT INTO sub_categories (category_id, code, name) VALUES (?, ?, ?)`,
          [categoryId, finalCode, name.trim()]
        )
        return { ok: true, data: { id: res.insertId, code: finalCode } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle('inventory:subcategories:update', async (_e, { id, name }) => {
    try {
      await pool.query(`UPDATE sub_categories SET name = ? WHERE id = ?`, [
        name.trim(),
        id
      ])
      return { ok: true, data: { id } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(
    'inventory:subcategories:toggle',
    async (_e, { id, isActive }) => {
      try {
        await pool.query(
          `UPDATE sub_categories SET is_active = ? WHERE id = ?`,
          [isActive ? 1 : 0, id]
        )
        return { ok: true, data: { id } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ---------------- Brands ----------------
  ipcMain.handle('inventory:brands:list', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT id, name FROM brands WHERE is_active = 1 ORDER BY name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:brands:create', async (_e, { name }) => {
    try {
      if (!name || !name.trim())
        return { ok: false, error: 'Brand name is required.' }
      const [res] = await pool.query(
        `INSERT INTO brands (name) VALUES (?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), is_active = 1`,
        [name.trim()]
      )
      return { ok: true, data: { id: res.insertId } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // // ---------------- Items ----------------
  // ipcMain.handle('inventory:items:next-code', async () => {
  //   try {
  //     const [[r]] = await pool.query(
  //       `SELECT COALESCE(MAX(CAST(item_code AS UNSIGNED)), 0) + 1 AS next FROM items`
  //     )
  //     return { ok: true, data: { code: String(r.next).padStart(5, '0') } }
  //   } catch (err) {
  //     return { ok: false, error: err.message }
  //   }
  // })

  ipcMain.handle('inventory:items:next-code', async () => {
    try {
      // Database se sirf woh codes uthayen jo numbers hain (14725 wale manual codes ko ignore karne ke liye)
      const [rows] = await pool.query(
        `SELECT item_code FROM items WHERE item_code REGEXP '^[0-9]+$'`
      )

      // Unko integer mein convert karke ek Set mein dalen
      const usedCodes = new Set(rows.map((r) => parseInt(r.item_code, 10)))

      // 1 se shuru karke pehla khaali number dhoondein (gap filling)
      let nextCode = 1
      while (usedCodes.has(nextCode)) {
        nextCode++
      }

      return { ok: true, data: { code: String(nextCode).padStart(5, '0') } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Item form rules — before, minus prices were saved and a minus opening stock silently became 0.
  // function validateItem(p, isCreate) {
  //   if (!p.name || !String(p.name).trim())
  //     throw new Error('Item name is required.')
  //   const num = (v) => (v === '' || v == null ? 0 : Number(v))
  //   if (!Number.isFinite(num(p.purchasePrice)) || num(p.purchasePrice) < 0)
  //     throw new Error('Purchase price cannot be negative.')
  //   if (!Number.isFinite(num(p.sellingPrice)) || !(num(p.sellingPrice) > 0))
  //     throw new Error('Selling price must be more than 0.')
  //   if (num(p.discountPercent) < 0 || num(p.discountPercent) > 100)
  //     throw new Error('Discount % must be between 0 and 100.')
  //   if (num(p.reorderQuantity) < 0 || num(p.lowStockThreshold) < 0)
  //     throw new Error('Reorder qty / low-stock alert cannot be negative.')
  //   if (isCreate && num(p.openingStock) < 0)
  //     throw new Error('Opening stock cannot be negative.')
  // }

  function validateItem(p, isCreate) {
    if (!p.name || !String(p.name).trim())
      throw new Error('Item name is required.')
    const num = (v) => (v === '' || v == null ? 0 : Number(v))
    if (!Number.isFinite(num(p.purchasePrice)) || num(p.purchasePrice) < 0)
      throw new Error('Purchase price cannot be negative.')

    // CHANGED: Allow 0 or empty for minimal creation, just block negatives
    if (!Number.isFinite(num(p.sellingPrice)) || num(p.sellingPrice) < 0)
      throw new Error('Selling price cannot be negative.')

    if (num(p.discountPercent) < 0 || num(p.discountPercent) > 100)
      throw new Error('Discount % must be between 0 and 100.')
    if (num(p.reorderQuantity) < 0 || num(p.lowStockThreshold) < 0)
      throw new Error('Reorder qty / low-stock alert cannot be negative.')
    if (isCreate && num(p.openingStock) < 0)
      throw new Error('Opening stock cannot be negative.')
  }
  // The barcode has no unique key in the database — two items with one barcode would make a
  // scan pick the wrong item, so refuse it here.
  async function assertBarcodeFree(db, barcode, itemId) {
    const bc = String(barcode || '').trim()
    if (!bc) return
    const [[hit]] = await db.query(
      `SELECT name FROM items WHERE (barcode = ? OR item_code = ?) AND id <> ? LIMIT 1`,
      [bc, bc, Number(itemId) || 0]
    )
    if (hit)
      throw new Error(`Barcode "${bc}" is already used by "${hit.name}".`)
  }
  // MySQL's "Duplicate entry '00001' for key 'items.item_code'" → plain words
  function friendlyItemError(err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      if (/barcode/i.test(err.message))
        return 'This barcode is already used by another item.'
      return 'This item code is already used by another item.'
    }
    return err.message
  }

  // An item's category: from its sub-category when one is picked, otherwise the Category the
  // user chose on its own (before, a Category without a Sub-category was silently dropped).
  async function itemCategoryId(db, p) {
    if (p.subCategoryId) {
      const [[sc]] = await db.query(
        `SELECT category_id FROM sub_categories WHERE id = ?`,
        [p.subCategoryId]
      )
      if (sc) return sc.category_id
    }
    return p.categoryId ? Number(p.categoryId) : null
  }

  ipcMain.handle('inventory:items:list', async (_e, params) => {
    try {
      const { categoryId, subCategoryId, search, uncategorized, showInactive } =
        params || {}
      // showInactive: list the deactivated items so they can be switched back on
      let where = showInactive
        ? 'WHERE i.is_active = 0'
        : 'WHERE i.is_active = 1'
      const args = []
      if (uncategorized) {
        where += ' AND i.sub_category_id IS NULL AND i.category_id IS NULL'
      } else if (subCategoryId) {
        where += ' AND i.sub_category_id = ?'
        args.push(subCategoryId)
      } else if (categoryId) {
        where += ' AND COALESCE(sc.category_id, i.category_id) = ?'
        args.push(categoryId)
      }
      if (search && search.trim()) {
        where +=
          ' AND (i.name LIKE ? OR i.item_code LIKE ? OR i.barcode LIKE ?)'
        const s = `%${search.trim()}%`
        args.push(s, s, s)
      }
      const [rows] = await pool.query(
        `SELECT i.id, i.item_code, i.name, i.description, i.sub_category_id,
                i.brand_id, i.purchase_price, i.selling_price, i.unit,
                i.size, i.pcs,
                i.reorder_quantity, i.low_stock_threshold, i.discount_percent, i.barcode,
                i.current_stock, i.average_cost,
                (i.current_stock * i.average_cost) AS stock_value,
                COALESCE(sc.category_id, i.category_id) AS category_id,
                sc.name AS sub_category, c.name AS category, b.name AS brand
           FROM items i
           LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
           LEFT JOIN categories c ON c.id = COALESCE(sc.category_id, i.category_id)
           LEFT JOIN brands b ON b.id = i.brand_id
          ${where}
          ORDER BY i.name`,
        args
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:items:create', async (_e, p) => {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      validateItem(p, true)

      // let itemCode = (p.itemCode || '').trim()
      // if (!itemCode) {
      //   const [[r]] = await conn.query(
      //     `SELECT COALESCE(MAX(CAST(item_code AS UNSIGNED)), 0) + 1 AS next FROM items`
      //   )
      //   itemCode = String(r.next).padStart(5, '0')
      // }

      let itemCode = (p.itemCode || '').trim()
      if (!itemCode) {
        const [rows] = await conn.query(
          `SELECT item_code FROM items WHERE item_code REGEXP '^[0-9]+$'`
        )
        const usedCodes = new Set(rows.map((r) => parseInt(r.item_code, 10)))
        let nextCode = 1
        while (usedCodes.has(nextCode)) {
          nextCode++
        }
        itemCode = String(nextCode).padStart(5, '0')
      }

      await assertBarcodeFree(conn, p.barcode || itemCode, 0)
      const categoryId = await itemCategoryId(conn, p)
      const [res] = await conn.query(
        `INSERT INTO items
           (item_code, name, description, category_id, sub_category_id, brand_id,
            purchase_price, selling_price, unit, size, pcs, reorder_quantity, low_stock_threshold,
            discount_percent, barcode, current_stock, average_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          itemCode,
          p.name.trim(),
          p.description || null,
          categoryId,
          p.subCategoryId,
          p.brandId || null,
          Number(p.purchasePrice) || 0,
          Number(p.sellingPrice) || 0,
          p.unit || 'Pcs',
          p.size || null,
          p.pcs || null,
          Number(p.reorderQuantity) || 0,
          // "Low Stock Alert (units)" from the item form — was never saved before, so no item
          // could ever show as low (only Excel import stored it).
          Math.max(0, Number(p.lowStockThreshold) || 0),
          Number(p.discountPercent) || 0,
          (p.barcode || itemCode).trim()
        ]
      )

      const itemId = res.insertId
      const openQty = Number(p.openingStock) || 0
      if (openQty > 0) {
        await postStockMovement(conn, {
          itemId,
          movementType: 'opening',
          quantityIn: openQty,
          unitCost: Number(p.purchasePrice) || 0,
          referenceType: 'opening'
        })
      }
      await conn.commit()
      return { ok: true, data: { id: itemId, item_code: itemCode } }
    } catch (err) {
      await conn.rollback()
      return { ok: false, error: friendlyItemError(err) }
    } finally {
      conn.release()
    }
  })

  ipcMain.handle('inventory:items:update', async (_e, p) => {
    try {
      validateItem(p, false)
      await assertBarcodeFree(pool, p.barcode, p.id)
      const categoryId = await itemCategoryId(pool, p)
      await pool.query(
        `UPDATE items SET
           name = ?, description = ?, category_id = ?, sub_category_id = ?, brand_id = ?,
           purchase_price = ?, selling_price = ?, unit = ?, size = ?, pcs = ?,
           reorder_quantity = ?, low_stock_threshold = ?, discount_percent = ?, barcode = ?
         WHERE id = ?`,
        [
          p.name.trim(),
          p.description || null,
          categoryId,
          p.subCategoryId,
          p.brandId || null,
          Number(p.purchasePrice) || 0,
          Number(p.sellingPrice) || 0,
          p.unit || 'Pcs',
          p.size || null,
          p.pcs || null,
          Number(p.reorderQuantity) || 0,
          Math.max(0, Number(p.lowStockThreshold) || 0), // was not saved on edit either
          Number(p.discountPercent) || 0,
          (p.barcode || '').trim(),
          p.id
        ]
      )
      return { ok: true, data: { id: p.id } }
    } catch (err) {
      return { ok: false, error: friendlyItemError(err) }
    }
  })

  ipcMain.handle('inventory:items:toggle', async (_e, { id, isActive }) => {
    try {
      await pool.query(`UPDATE items SET is_active = ? WHERE id = ?`, [
        isActive ? 1 : 0,
        id
      ])
      return { ok: true, data: { id } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(
    'inventory:items:adjust-stock',
    async (_e, { id, newQuantity, unitCost }) => {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const target = Number(newQuantity)
        if (Number.isNaN(target) || target < 0)
          throw new Error('Enter a valid quantity.')
        const prev = await getRunningBalance(conn, id)
        const diff = target - prev.qty
        if (diff !== 0) {
          await postStockMovement(conn, {
            itemId: id,
            movementType: 'adjustment',
            quantityIn: diff > 0 ? diff : 0,
            quantityOut: diff < 0 ? -diff : 0,
            unitCost: Number(unitCost) || prev.avgCost || 0,
            referenceType: 'adjustment'
          })
        }
        await conn.commit()
        return { ok: true, data: { id, newQuantity: target } }
      } catch (err) {
        await conn.rollback()
        return { ok: false, error: err.message }
      } finally {
        conn.release()
      }
    }
  )

  // Quick "set stock + prices" for one item — the Purchases page's Manage Stock & Prices
  // dialog. Runs as ONE transaction so a failed price write can never leave a stock move
  // behind (and vice versa). Stock always goes through postStockMovement so the ledger,
  // running balance, and weighted-average cost all stay consistent with every other path.
  ipcMain.handle(
    'inventory:items:update-stock-prices',
    async (_e, { id, newStock, purchasePrice, sellingPrice } = {}) => {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()

        const [[item]] = await conn.query(
          `SELECT id, name, unit FROM items WHERE id = ? AND is_active = 1`,
          [id]
        )
        if (!item) throw new Error('Item not found or inactive.')

        const pp = Number(purchasePrice)
        const sp = Number(sellingPrice)
        if (!Number.isFinite(pp) || pp < 0)
          throw new Error('Purchase price cannot be negative.')
        if (!Number.isFinite(sp) || !(sp > 0))
          throw new Error('Selling price must be more than 0.')

        await conn.query(
          `UPDATE items SET purchase_price = ?, selling_price = ? WHERE id = ?`,
          [pp, sp, id]
        )

        let stockChanged = false
        let fromQty = null
        let toQty = null

        // newStock may be omitted (price-only edit) — only touch stock when it was sent.
        if (newStock !== undefined && newStock !== null && newStock !== '') {
          const target = Number(newStock)
          if (!Number.isFinite(target) || target < 0)
            throw new Error('Stock quantity must be zero or more.')
          const prev = await getRunningBalance(conn, id)
          fromQty = Number(prev.qty)
          toQty = target
          const diff = target - fromQty
          // A no-op (same number typed) must NOT write a zero-diff ledger row.
          if (Math.abs(diff) > 1e-9) {
            await postStockMovement(conn, {
              itemId: id,
              movementType: 'adjustment',
              quantityIn: diff > 0 ? diff : 0,
              quantityOut: diff < 0 ? -diff : 0,
              // Count-correction cost basis = what the shelf already carries, not the
              // new purchase price (which is only the catalog value for future purchases).
              unitCost: prev.avgCost || 0,
              referenceType: 'adjustment'
            })
            stockChanged = true
          }
        }

        await conn.commit()
        return { ok: true, data: { id, stockChanged, fromQty, toQty } }
      } catch (err) {
        await conn.rollback()
        return { ok: false, error: err.message }
      } finally {
        conn.release()
      }
    }
  )

  // One item's lifetime stock story + a date-filterable movement list.
  //   Lifetime totals (always all-time): Opening, Purchased, Returned In, Adj In, Total In,
  //   Sold, Returned Out, Adj Out, Total Out — so the client can always see "how much did
  //   I ever buy" even when current_stock is 0.
  //   Movement list: every stock_ledger row with a human reference (PO-0002 / #1005 / SR-0003).
  ipcMain.handle(
    'inventory:items:history',
    async (_e, { id, from, to } = {}) => {
      try {
        const [[item]] = await pool.query(
          `SELECT id, item_code, name, size, unit, barcode, category_id, sub_category_id,
                current_stock, average_cost, purchase_price, selling_price
           FROM items WHERE id = ?`,
          [id]
        )
        if (!item) return { ok: false, error: 'Item not found.' }

        const [[totals]] = await pool.query(
          `SELECT
           COALESCE(SUM(CASE WHEN movement_type='opening'         THEN quantity_in  ELSE 0 END),0) AS opening_qty,
           COALESCE(SUM(CASE WHEN movement_type='purchase'        THEN quantity_in  ELSE 0 END),0) AS purchased_qty,
           COALESCE(SUM(CASE WHEN movement_type='sale_return'     THEN quantity_in  ELSE 0 END),0) AS return_in_qty,
           COALESCE(SUM(CASE WHEN movement_type='adjustment'      THEN quantity_in  ELSE 0 END),0) AS adj_in_qty,
           COALESCE(SUM(CASE WHEN movement_type='sale'            THEN quantity_out ELSE 0 END),0) AS sold_qty,
           COALESCE(SUM(CASE WHEN movement_type='purchase_return' THEN quantity_out ELSE 0 END),0) AS purchase_return_qty,
           COALESCE(SUM(CASE WHEN movement_type='adjustment'      THEN quantity_out ELSE 0 END),0) AS adj_out_qty,
           COALESCE(SUM(quantity_in),0)  AS total_in,
           COALESCE(SUM(quantity_out),0) AS total_out
         FROM stock_ledger WHERE item_id = ?`,
          [id]
        )

        const args = [id]
        let w = ''
        if (from) {
          w += ' AND sl.movement_date >= ?'
          args.push(from)
        }
        if (to) {
          w += ' AND sl.movement_date <= ?'
          args.push(to)
        }

        const [rows] = await pool.query(
          `SELECT sl.id, sl.movement_type, sl.reference_type, sl.reference_id,
                sl.quantity_in, sl.quantity_out, sl.unit_cost,
                sl.balance_qty, sl.balance_avg_cost,
                sl.movement_date, sl.created_at,
                CASE
                  WHEN sl.reference_type = 'purchase'           THEN po.serial_no
                  WHEN sl.reference_type = 'sale'               THEN CONCAT('#', s.invoice_no)
                  WHEN sl.reference_type = 'sale_edit_reversal' THEN CONCAT('#', s.invoice_no)
                  WHEN sl.reference_type = 'sale_return'        THEN sr.return_no
                  WHEN sl.reference_type = 'purchase_return'    THEN pr.return_no
                  ELSE NULL
                END AS reference_label
           FROM stock_ledger sl
           LEFT JOIN purchase_orders   po ON po.id = sl.reference_id AND sl.reference_type = 'purchase'
           LEFT JOIN sales              s ON s.id  = sl.reference_id AND sl.reference_type IN ('sale','sale_edit_reversal')
           LEFT JOIN sales_returns     sr ON sr.id = sl.reference_id AND sl.reference_type = 'sale_return'
           LEFT JOIN purchase_returns  pr ON pr.id = sl.reference_id AND sl.reference_type = 'purchase_return'
          WHERE sl.item_id = ? ${w}
          ORDER BY sl.movement_date DESC, sl.id DESC
          LIMIT 500`,
          args
        )

        const n = (v) => Number(v) || 0
        const summary = {
          opening: n(totals.opening_qty),
          purchased: n(totals.purchased_qty),
          return_in: n(totals.return_in_qty),
          adj_in: n(totals.adj_in_qty),
          total_in: n(totals.total_in),
          sold: n(totals.sold_qty),
          purchase_return: n(totals.purchase_return_qty),
          adj_out: n(totals.adj_out_qty),
          total_out: n(totals.total_out)
        }
        return {
          ok: true,
          data: { item, summary, rows, from: from || null, to: to || null }
        }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  ipcMain.handle('inventory:items:ledger', async (_e, { id }) => {
    try {
      const [rows] = await pool.query(
        `SELECT id, movement_type, quantity_in, quantity_out, unit_cost,
                balance_qty, balance_avg_cost, movement_date
           FROM stock_ledger
          WHERE item_id = ?
          ORDER BY id DESC
          LIMIT 200`,
        [id]
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:items:ensure-barcodes', async () => {
    try {
      const [res] = await pool.query(
        `UPDATE items SET barcode = item_code
          WHERE (barcode IS NULL OR barcode = '') AND is_active = 1`
      )
      return { ok: true, data: { updated: res.affectedRows } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // LOW_WHERE / THRESHOLD_SQL come from services/stock.alerts.js (one rule app-wide).

  ipcMain.handle('inventory:items:low-stock', async () => {
    try {
      const [rows] = await pool.query(
        `SELECT i.id, i.item_code, i.name, i.unit, i.size, i.pcs, i.current_stock,
                i.reorder_quantity, i.low_stock_threshold, i.average_cost, i.selling_price,
                (i.current_stock * i.average_cost) AS stock_value,
                ${THRESHOLD_SQL} AS threshold,
                sc.name AS sub_category, c.name AS category
           FROM items i
           LEFT JOIN sub_categories sc ON sc.id = i.sub_category_id
           LEFT JOIN categories c ON c.id = COALESCE(sc.category_id, i.category_id)
          WHERE ${LOW_WHERE}
          ORDER BY (i.current_stock - ${THRESHOLD_SQL}) ASC,
            i.current_stock ASC`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:items:low-stock-count', async () => {
    try {
      const [[r]] = await pool.query(
        `SELECT COUNT(*) AS n FROM items i WHERE ${LOW_WHERE}`
      )
      return { ok: true, data: { count: Number(r.n) } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ---------------- Excel import ----------------
  ipcMain.handle('inventory:items:import-template', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showSaveDialog(win, {
        title: 'Save Import Template',
        defaultPath: 'items-import-template.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      })
      if (result.canceled || !result.filePath)
        return { ok: true, data: { canceled: true } }
      const sample = [
        {
          Name: 'Example Shirt',
          Size: 'M',
          Pcs: 1,
          Category: 'MENS',
          SubCategory: 'SHIRT',
          Brand: 'Generic',
          ItemCode: '',
          PurchasePrice: 1200,
          SellingPrice: 1999,
          Unit: 'Pcs',
          ReorderQty: 2,
          LowStockThreshold: 0,
          Discount: 10,
          OpeningStock: 0,
          Barcode: ''
        }
      ]
      const ws = XLSX.utils.json_to_sheet(sample)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Items')
      XLSX.writeFile(wb, result.filePath)
      return { ok: true, data: { path: result.filePath } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:items:import', async () => {
    const conn = await pool.getConnection()
    try {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win, {
        title: 'Import Items from Excel',
        filters: [{ name: 'Spreadsheet', extensions: ['xlsx', 'xls', 'csv'] }],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths.length) {
        conn.release()
        return { ok: true, data: { canceled: true } }
      }

      const wb = XLSX.readFile(result.filePaths[0])
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const catCache = new Map()
      const subCache = new Map()
      const brandCache = new Map()

      const [[codeRow]] = await conn.query(
        `SELECT COALESCE(MAX(CAST(item_code AS UNSIGNED)), 0) AS mx FROM items`
      )
      let nextCode = codeRow.mx

      async function resolveCategory(name) {
        const key = name.toLowerCase()
        if (catCache.has(key)) return catCache.get(key)
        const [ex] = await conn.query(
          `SELECT id, code FROM categories WHERE name = ? LIMIT 1`,
          [name]
        )
        if (ex.length) {
          catCache.set(key, ex[0].id)
          return ex[0].id
        }
        const [[r]] = await conn.query(
          `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) + 1 AS next FROM categories`
        )
        const [res] = await conn.query(
          `INSERT INTO categories (code, name) VALUES (?, ?)`,
          [String(r.next), name]
        )
        catCache.set(key, res.insertId)
        return res.insertId
      }
      async function resolveSub(categoryId, name) {
        const key = categoryId + '::' + name.toLowerCase()
        if (subCache.has(key)) return subCache.get(key)
        const [ex] = await conn.query(
          `SELECT id FROM sub_categories WHERE category_id = ? AND name = ? LIMIT 1`,
          [categoryId, name]
        )
        if (ex.length) {
          subCache.set(key, ex[0].id)
          return ex[0].id
        }
        const [[r]] = await conn.query(
          `SELECT COALESCE(MAX(CAST(code AS UNSIGNED)), 0) AS mx FROM sub_categories WHERE category_id = ?`,
          [categoryId]
        )
        let code
        if (r.mx > 0) code = String(r.mx + 1)
        else {
          const [[c]] = await conn.query(
            `SELECT code FROM categories WHERE id = ?`,
            [categoryId]
          )
          code = String(Number(c.code) * 100 + 1)
        }
        const [res] = await conn.query(
          `INSERT INTO sub_categories (category_id, code, name) VALUES (?, ?, ?)`,
          [categoryId, code, name]
        )
        subCache.set(key, res.insertId)
        return res.insertId
      }
      async function resolveBrand(name) {
        if (!name) return null
        const key = name.toLowerCase()
        if (brandCache.has(key)) return brandCache.get(key)
        const [res] = await conn.query(
          `INSERT INTO brands (name) VALUES (?)
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
          [name]
        )
        brandCache.set(key, res.insertId)
        return res.insertId
      }

      let imported = 0
      const errors = []

      for (let idx = 0; idx < rawRows.length; idx++) {
        const n = normalizeRow(rawRows[idx])
        const name = String(pick(n, ['name', 'itemname', 'item'])).trim()
        const catName = String(pick(n, ['category', 'cat'])).trim()
        const subName = String(pick(n, ['subcategory', 'subcat'])).trim()
        if (!name || !catName || !subName) {
          errors.push(
            `Row ${idx + 2}: Name, Category and SubCategory are required.`
          )
          continue
        }
        try {
          await conn.beginTransaction()
          const categoryId = await resolveCategory(catName)
          const subCategoryId = await resolveSub(categoryId, subName)
          const brandId = await resolveBrand(String(pick(n, ['brand'])).trim())

          let itemCode = String(pick(n, ['itemcode', 'code'])).trim()
          if (!itemCode) {
            nextCode += 1
            itemCode = String(nextCode).padStart(5, '0')
          }

          const purchase =
            Number(pick(n, ['purchaseprice', 'purchase', 'cost'])) || 0
          const selling =
            Number(
              pick(n, ['sellingprice', 'saleprice', 'selling', 'price'])
            ) || 0
          const openQty =
            Number(pick(n, ['openingstock', 'stock', 'qty', 'quantity'])) || 0
          const lowStockThreshold =
            Number(pick(n, ['lowstockthreshold', 'lowstock'])) || 0
          const barcode = String(pick(n, ['barcode'])).trim() || itemCode
          const size = String(pick(n, ['size'])).trim() || null
          const pcs = Number(pick(n, ['pcs'])) || null

          const [res] = await conn.query(
            `INSERT INTO items
               (item_code, name, category_id, sub_category_id, brand_id,
                purchase_price, selling_price, unit, size, pcs, reorder_quantity, low_stock_threshold, discount_percent,
                barcode, current_stock, average_cost)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
              itemCode,
              name,
              categoryId || null,
              subCategoryId,
              brandId,
              purchase,
              selling,
              String(pick(n, ['unit'])).trim() || 'Pcs',
              size,
              pcs,
              Number(pick(n, ['reorderqty', 'reorder'])) || 0,
              lowStockThreshold,
              Number(pick(n, ['discount', 'discountpercent'])) || 0,
              barcode
            ]
          )

          if (openQty > 0) {
            await postStockMovement(conn, {
              itemId: res.insertId,
              movementType: 'opening',
              quantityIn: openQty,
              unitCost: purchase,
              referenceType: 'opening'
            })
          }
          await conn.commit()
          imported += 1
        } catch (rowErr) {
          await conn.rollback()
          errors.push(`Row ${idx + 2}: ${rowErr.message}`)
        }
      }

      conn.release()
      return {
        ok: true,
        data: { imported, skipped: errors.length, errors: errors.slice(0, 15) }
      }
    } catch (err) {
      conn.release()
      return { ok: false, error: err.message }
    }
  })
}
