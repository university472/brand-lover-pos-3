// import { useEffect, useState, useCallback, useRef } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { inventoryApi } from '../api/ipc.js'
// import Icon from '../components/Icons.jsx'
// import Modal from '../components/Modal.jsx'
// import Barcode from '../components/Barcode.jsx'
// import { useHotkeys } from '../hooks/useHotkeys.js'
// import { printNow } from '../utils/print.js'
// import { notifyStockChanged } from '../utils/lowStock.js'

// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
// const fmtCost = (n) =>
//   'Rs. ' +
//   Number(n || 0).toLocaleString('en-PK', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2
//   })

// const emptyItem = {
//   itemCode: '',
//   name: '',
//   size: '',
//   pcs: '',
//   description: '',
//   brandId: '',
//   purchasePrice: '',
//   sellingPrice: '',
//   unit: 'Pcs',
//   reorderQuantity: '',
//   lowStockThreshold: '',
//   discountPercent: '',
//   barcode: '',
//   openingStock: ''
// }

// export default function Inventory() {
//   const navigate = useNavigate()
//   const [categories, setCategories] = useState([])
//   const [subcategories, setSubcategories] = useState([])
//   const [brands, setBrands] = useState([])
//   const [items, setItems] = useState([])

//   const [selCat, setSelCat] = useState(null)
//   const [selSub, setSelSub] = useState(null)
//   const [search, setSearch] = useState('')
//   const [viewMode, setViewMode] = useState('all')
//   // list deactivated items instead, so they can be switched back on
//   const [showInactive, setShowInactive] = useState(false)
//   const [modalCatId, setModalCatId] = useState('')
//   const [modalSubcats, setModalSubcats] = useState([])

//   const [modal, setModal] = useState(null)
//   const [form, setForm] = useState(emptyItem)
//   const [nameInput, setNameInput] = useState('')
//   const [adjustQty, setAdjustQty] = useState('')
//   const [busy, setBusy] = useState(false)
//   const [error, setError] = useState('')
//   const [notice, setNotice] = useState('')
//   const searchRef = useRef(null)

//   const loadCategories = useCallback(async () => {
//     const cats = await inventoryApi.categories.list()
//     setCategories(cats)
//     return cats
//   }, [])

//   const loadItems = useCallback(async () => {
//     const params = { search, showInactive }
//     if (viewMode === 'cat') {
//       params.categoryId = selCat?.id
//       params.subCategoryId = selSub?.id
//     } else if (viewMode === 'uncat') {
//       params.uncategorized = true
//     }
//     const data = await inventoryApi.items.list(params)
//     setItems(data)
//   }, [viewMode, selCat, selSub, search, showInactive])

//   useEffect(() => {
//     ;(async () => {
//       try {
//         await loadCategories()
//         setBrands(await inventoryApi.brands.list())
//       } catch (e) {
//         setError(e.message)
//       }
//     })()
//   }, [loadCategories])

//   useEffect(() => {
//     ;(async () => {
//       if (!selCat) {
//         setSubcategories([])
//         return
//       }
//       try {
//         setSubcategories(
//           await inventoryApi.subcategories.list({ categoryId: selCat.id })
//         )
//       } catch (e) {
//         setError(e.message)
//       }
//     })()
//   }, [selCat])

//   useEffect(() => {
//     loadItems().catch((e) => setError(e.message))
//   }, [loadItems])

//   useEffect(() => {
//     if (modal?.type !== 'item') return
//     ;(async () => {
//       if (!modalCatId) {
//         setModalSubcats([])
//         return
//       }
//       try {
//         setModalSubcats(
//           await inventoryApi.subcategories.list({ categoryId: modalCatId })
//         )
//       } catch (e) {
//         setError(e.message)
//       }
//     })()
//   }, [modalCatId, modal])

//   // A dialog opening or closing starts with a clean slate — an old error ("Item name is
//   // required.") must not stay on the page after the dialog is gone.
//   useEffect(() => {
//     setError('')
//   }, [modal])

//   const flash = (msg) => {
//     setNotice(msg)
//     setTimeout(() => setNotice(''), 4000)
//   }

//   const openNameModal = (type, mode = 'create', data = null) => {
//     setNameInput(data?.name || '')
//     setError('')
//     setModal({ type, mode, data })
//   }

//   const saveName = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const { type, mode, data } = modal
//       if (type === 'category') {
//         if (mode === 'edit')
//           await inventoryApi.categories.update({ id: data.id, name: nameInput })
//         else await inventoryApi.categories.create({ name: nameInput })
//         await loadCategories()
//       } else if (type === 'subcategory') {
//         if (mode === 'edit')
//           await inventoryApi.subcategories.update({
//             id: data.id,
//             name: nameInput
//           })
//         else
//           await inventoryApi.subcategories.create({
//             categoryId: selCat.id,
//             name: nameInput
//           })
//         setSubcategories(
//           await inventoryApi.subcategories.list({ categoryId: selCat.id })
//         )
//       }
//       setModal(null)
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const openItemModal = async (mode, item = null) => {
//     setError('')
//     if (mode === 'create') {
//       let code = ''
//       try {
//         code = (await inventoryApi.items.nextCode()).code
//       } catch {
//         /* offline */
//       }
//       setForm({
//         ...emptyItem,
//         itemCode: code,
//         barcode: code,
//         subCategoryId: selSub?.id || ''
//       })
//       setModalCatId(selCat?.id ? String(selCat.id) : '')
//     } else {
//       setForm({
//         id: item.id,
//         itemCode: item.item_code,
//         name: item.name,
//         size: item.size || '',
//         pcs: item.pcs || '',
//         description: item.description || '',
//         brandId: item.brand_id || '',
//         purchasePrice: item.purchase_price,
//         sellingPrice: item.selling_price,
//         unit: item.unit,
//         reorderQuantity: item.reorder_quantity,
//         lowStockThreshold: item.low_stock_threshold ?? '',
//         discountPercent: item.discount_percent,
//         barcode: item.barcode || '',
//         subCategoryId: item.sub_category_id || ''
//       })
//       setModalCatId(item.category_id ? String(item.category_id) : '')
//     }
//     setModal({ type: 'item', mode, data: item })
//   }

//   const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }))

//   const saveItem = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const payload = {
//         ...form,
//         size: form.size,
//         pcs: form.pcs,
//         // the Category chosen in the form is saved even without a Sub-category
//         categoryId: modalCatId ? Number(modalCatId) : null,
//         subCategoryId: form.subCategoryId || null
//       }
//       if (modal.mode === 'create') {
//         await inventoryApi.items.create(payload)
//       } else {
//         await inventoryApi.items.update(payload)
//       }
//       setModal(null)
//       notifyStockChanged() // alert level / stock may have changed → refresh low-stock badge
//       await loadItems()
//       await loadCategories()
//       if (selCat) {
//         setSubcategories(
//           await inventoryApi.subcategories.list({ categoryId: selCat.id })
//         )
//       }
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const deactivateItem = async (item) => {
//     if (
//       !window.confirm(
//         `Deactivate "${item.name}"? It will be hidden from lists.`
//       )
//     )
//       return
//     try {
//       await inventoryApi.items.toggle({ id: item.id, isActive: false })
//       await loadItems()
//     } catch (e) {
//       setError(e.message)
//     }
//   }
//   const activateItem = async (item) => {
//     try {
//       await inventoryApi.items.toggle({ id: item.id, isActive: true })
//       await loadItems()
//       flash(`"${item.name}" is active again.`)
//     } catch (e) {
//       setError(e.message)
//     }
//   }

//   const openAdjust = (item) => {
//     setAdjustQty('')
//     setError('')
//     setModal({ type: 'adjust', mode: 'edit', data: item })
//   }

//   const saveAdjust = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const delta = Number(adjustQty)
//       if (adjustQty === '' || Number.isNaN(delta)) {
//         setError('Enter a valid quantity.')
//         setBusy(false)
//         return
//       }
//       const target = Number(modal.data.current_stock) + delta
//       if (target < 0) {
//         setError('Resulting stock cannot be negative.')
//         setBusy(false)
//         return
//       }
//       await inventoryApi.items.adjustStock({
//         id: modal.data.id,
//         newQuantity: target
//       })
//       setModal(null)
//       notifyStockChanged()
//       await loadItems()
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const importExcel = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const r = await inventoryApi.items.importExcel()
//       if (!r.canceled) {
//         await loadCategories()
//         await loadItems()
//         flash(
//           `Imported ${r.imported} item(s)` +
//             (r.skipped ? `, ${r.skipped} skipped.` : '.')
//         )
//         if (r.errors?.length)
//           setError('Some rows skipped:\n' + r.errors.join('\n'))
//       }
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }
//   const downloadTemplate = async () => {
//     try {
//       const r = await inventoryApi.items.importTemplate()
//       if (!r.canceled) flash('Template saved.')
//     } catch (e) {
//       setError(e.message)
//     }
//   }

//   useHotkeys(
//     {
//       f2: () => searchRef.current?.focus(),
//       f5: () => {
//         if (busy) return
//         loadItems().catch((e) => setError(e.message))
//         loadCategories().catch((e) => setError(e.message))
//       },
//       f8: () => {
//         if (busy || modal) return
//         openItemModal('create')
//       },
//       f9: () => {
//         if (busy || !modal) return
//         if (modal.type === 'item') saveItem()
//         else if (modal.type === 'category' || modal.type === 'subcategory')
//           saveName()
//         else if (modal.type === 'adjust') saveAdjust()
//       },
//       p: () => printNow(),
//       escape: () => {
//         if (modal) setModal(null)
//       },
//       delete: () => {}
//     },
//     [busy, modal, viewMode, selCat, selSub]
//   )

//   return (
//     <div className="inv-layout">
//       <div className="inv-pane">
//         <div className="inv-pane-head">
//           <span>Categories</span>
//           <button
//             className="btn-icon"
//             onClick={() => openNameModal('category')}
//             title="Add category"
//           >
//             <Icon name="plus" size={16} />
//           </button>
//         </div>
//         <div className="inv-list">
//           <div
//             className={
//               'inv-list-item inv-pin' + (viewMode === 'all' ? ' active' : '')
//             }
//             onClick={() => {
//               setViewMode('all')
//               setSelCat(null)
//               setSelSub(null)
//             }}
//           >
//             <div className="ili-text">
//               <strong>All Items</strong>
//               <span>every product</span>
//             </div>
//           </div>
//           <div
//             className={
//               'inv-list-item inv-pin' + (viewMode === 'uncat' ? ' active' : '')
//             }
//             onClick={() => {
//               setViewMode('uncat')
//               setSelCat(null)
//               setSelSub(null)
//             }}
//           >
//             <div className="ili-text">
//               <strong>Uncategorized</strong>
//               <span>no category</span>
//             </div>
//           </div>

//           {categories.length === 0 && (
//             <div className="inv-empty">No categories yet</div>
//           )}
//           {categories.map((c) => (
//             <div
//               key={c.id}
//               className={
//                 'inv-list-item' +
//                 (viewMode === 'cat' && selCat?.id === c.id ? ' active' : '')
//               }
//               onClick={() => {
//                 setViewMode('cat')
//                 setSelCat(c)
//                 setSelSub(null)
//                 setSearch('')
//               }}
//             >
//               <div className="ili-text">
//                 <strong>{c.name}</strong>
//                 <span>{c.sub_count} sub-cat</span>
//               </div>
//               <button
//                 className="ili-edit"
//                 onClick={(e) => {
//                   e.stopPropagation()
//                   openNameModal('category', 'edit', c)
//                 }}
//               >
//                 <Icon name="edit" size={14} />
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="inv-pane">
//         <div className="inv-pane-head">
//           <span>Sub-categories</span>
//           <button
//             className="btn-icon"
//             disabled={!selCat}
//             onClick={() => openNameModal('subcategory')}
//             title="Add sub-category"
//           >
//             <Icon name="plus" size={16} />
//           </button>
//         </div>
//         <div className="inv-list">
//           {!selCat && <div className="inv-empty">Pick a category</div>}
//           {selCat && subcategories.length === 0 && (
//             <div className="inv-empty">No sub-categories</div>
//           )}
//           {subcategories.map((s) => (
//             <div
//               key={s.id}
//               className={
//                 'inv-list-item' + (selSub?.id === s.id ? ' active' : '')
//               }
//               onClick={() => setSelSub(s)}
//             >
//               <div className="ili-text">
//                 <strong>{s.name}</strong>
//                 <span>{s.item_count} items</span>
//               </div>
//               <button
//                 className="ili-edit"
//                 onClick={(e) => {
//                   e.stopPropagation()
//                   openNameModal('subcategory', 'edit', s)
//                 }}
//               >
//                 <Icon name="edit" size={14} />
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="inv-items panel">
//         <div className="inv-toolbar">
//           <div className="search-box">
//             <Icon name="search" size={16} />
//             <input
//               ref={searchRef}
//               placeholder="Search name / code / barcode  (F2)"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>
//           <div className="toolbar-actions">
//             <label className="bc-check" title="Show the items you deactivated, to switch them back on">
//               <input
//                 type="checkbox"
//                 checked={showInactive}
//                 onChange={(e) => setShowInactive(e.target.checked)}
//               />{' '}
//               Show inactive
//             </label>
//             <button
//               className="btn-sm ghost"
//               onClick={() => navigate('/barcodes')}
//             >
//               <Icon name="barcode" size={15} /> Print Barcodes
//             </button>
//             <button
//               className="btn-sm primary"
//               onClick={() => openItemModal('create')}
//             >
//               <Icon name="plus" size={15} /> Add Item
//             </button>
//           </div>
//         </div>

//         {notice && <div className="inv-notice">{notice}</div>}
//         {/* while a dialog is open its own error shows there — not twice */}
//         {error && !modal && (
//           <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
//             {error}
//           </div>
//         )}

//         <div className="inv-context">
//           {viewMode === 'all' && <span>All products</span>}
//           {viewMode === 'uncat' && <span>Uncategorized products</span>}
//           {viewMode === 'cat' && selCat && (
//             <span>
//               {selCat.name}
//               {selSub ? ` › ${selSub.name}` : ' › All sub-categories'}
//             </span>
//           )}
//         </div>

//         <div className="table-scroll">
//           <table className="data-table">
//             <thead>
//               <tr>
//                 <th>Code</th>
//                 <th>Name</th>
//                 <th>Size</th>
//                 <th>Pcs</th>
//                 <th>Brand</th>
//                 <th className="num">Purchase</th>
//                 <th className="num">Selling</th>
//                 <th className="num">Stock</th>
//                 <th className="num">Avg Cost</th>
//                 <th className="num">Value</th>
//                 <th className="num">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {items.length === 0 ? (
//                 <tr>
//                   <td colSpan="11" className="empty">
//                     No items to show
//                   </td>
//                 </tr>
//               ) : (
//                 items.map((it) => {
//                   const threshold =
//                     Number(it.low_stock_threshold) > 0
//                       ? Number(it.low_stock_threshold)
//                       : Number(it.reorder_quantity)
//                   const low =
//                     threshold > 0 && Number(it.current_stock) <= threshold
//                   return (
//                     <tr key={it.id}>
//                       <td>{it.item_code}</td>
//                       <td>{it.name}</td>
//                       <td>{it.size || '—'}</td>
//                       <td>{it.pcs || '—'}</td>
//                       <td>{it.brand || '—'}</td>
//                       <td className="num">{fmt(it.purchase_price)}</td>
//                       <td className="num">{fmt(it.selling_price)}</td>
//                       <td className="num">
//                         <span className={'stock-pill' + (low ? ' low' : '')}>
//                           {Number(it.current_stock).toLocaleString('en-PK')}
//                         </span>
//                       </td>
//                       <td className="num">{fmtCost(it.average_cost)}</td>
//                       <td className="num">{fmt(it.stock_value)}</td>
//                       <td className="num">
//                         <div className="table-actions">
//                           <button
//                             className="btn-icon"
//                             title="Print label"
//                             onClick={() =>
//                               navigate('/barcodes', {
//                                 state: { itemId: it.id }
//                               })
//                             }
//                           >
//                             <Icon name="barcode" size={15} />
//                           </button>
//                           <button
//                             className="btn-icon"
//                             title="Edit"
//                             onClick={() => openItemModal('edit', it)}
//                           >
//                             <Icon name="edit" size={15} />
//                           </button>
//                           <button
//                             className="btn-icon"
//                             title="Adjust stock"
//                             onClick={() => openAdjust(it)}
//                           >
//                             <Icon name="adjust" size={15} />
//                           </button>
//                           {showInactive ? (
//                             <button
//                               className="btn-icon"
//                               title="Activate (show in lists and sales again)"
//                               onClick={() => activateItem(it)}
//                             >
//                               <Icon name="check" size={15} />
//                             </button>
//                           ) : (
//                             <button
//                               className="btn-icon danger"
//                               title="Deactivate"
//                               onClick={() => deactivateItem(it)}
//                             >
//                               <Icon name="trash" size={15} />
//                             </button>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   )
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>

//         <div className="hotkey-hint">
//           <span>
//             <kbd>F2</kbd> Search
//           </span>
//           <span>
//             <kbd>F5</kbd> Refresh
//           </span>
//           <span>
//             <kbd>F8</kbd> Add Item
//           </span>
//           <span>
//             <kbd>F9</kbd> Save
//           </span>
//           <span>
//             <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
//           </span>
//           <span>
//             <kbd>Esc</kbd> Close
//           </span>
//         </div>
//       </div>

//       {modal?.type === 'category' && (
//         <Modal
//           title={modal.mode === 'edit' ? 'Edit Category' : 'New Category'}
//           onClose={() => setModal(null)}
//           width={420}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveName}
//                 disabled={busy}
//               >
//                 Save
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <label className="field">
//             <span>Name</span>
//             <input
//               value={nameInput}
//               autoFocus
//               onChange={(e) => setNameInput(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && saveName()}
//               placeholder="e.g. MENS"
//             />
//           </label>
//           <p className="muted-text">Code is generated automatically.</p>
//         </Modal>
//       )}

//       {modal?.type === 'subcategory' && (
//         <Modal
//           title={
//             modal.mode === 'edit'
//               ? 'Edit Sub-category'
//               : `New Sub-category in ${selCat?.name}`
//           }
//           onClose={() => setModal(null)}
//           width={420}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveName}
//                 disabled={busy}
//               >
//                 Save
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <label className="field">
//             <span>Name</span>
//             <input
//               value={nameInput}
//               autoFocus
//               onChange={(e) => setNameInput(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && saveName()}
//               placeholder="e.g. SHIRT"
//             />
//           </label>
//           <p className="muted-text">Code is generated automatically.</p>
//         </Modal>
//       )}

//       {modal?.type === 'item' && (
//         <Modal
//           title={
//             modal.mode === 'edit' ? `Edit Item — ${form.name}` : 'Add New Item'
//           }
//           onClose={() => setModal(null)}
//           width={640}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveItem}
//                 disabled={busy}
//               >
//                 {busy ? 'Saving…' : 'Save Item'}
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <div className="form-grid">
//             <label className="field">
//               <span>Item Code</span>
//               <input
//                 value={form.itemCode}
//                 onChange={(e) => setF('itemCode', e.target.value)}
//                 disabled={modal.mode === 'edit'}
//               />
//             </label>
//             <label className="field">
//               <span>Barcode</span>
//               <input
//                 value={form.barcode}
//                 onChange={(e) => setF('barcode', e.target.value)}
//               />
//             </label>
//             <label className="field span2">
//               <span>Item Name</span>
//               <input
//                 value={form.name}
//                 autoFocus
//                 onChange={(e) => setF('name', e.target.value)}
//                 placeholder="e.g. Mens Pant"
//               />
//             </label>
//             <div className="field span2 bc-preview-field">
//               <span>Barcode Preview</span>
//               <div className="bc-preview">
//                 <Barcode
//                   value={form.barcode || form.itemCode}
//                   height={44}
//                   width={1.6}
//                   fontSize={13}
//                 />
//               </div>
//             </div>
//             <label className="field">
//               <span>
//                 Category <em className="hint-em">(optional)</em>
//               </span>
//               <select
//                 value={modalCatId}
//                 onChange={(e) => {
//                   setModalCatId(e.target.value)
//                   setF('subCategoryId', '')
//                 }}
//               >
//                 <option value="">— None —</option>
//                 {categories.map((c) => (
//                   <option key={c.id} value={c.id}>
//                     {c.name}
//                   </option>
//                 ))}
//               </select>
//             </label>
//             <label className="field">
//               <span>
//                 Sub-category <em className="hint-em">(optional)</em>
//               </span>
//               <select
//                 value={form.subCategoryId}
//                 disabled={!modalCatId}
//                 onChange={(e) => setF('subCategoryId', e.target.value)}
//               >
//                 <option value="">— None —</option>
//                 {modalSubcats.map((s) => (
//                   <option key={s.id} value={s.id}>
//                     {s.name}
//                   </option>
//                 ))}
//               </select>
//             </label>
//             <label className="field">
//               <span>Brand</span>
//               <select
//                 value={form.brandId}
//                 onChange={(e) => setF('brandId', e.target.value)}
//               >
//                 <option value="">— None —</option>
//                 {brands.map((b) => (
//                   <option key={b.id} value={b.id}>
//                     {b.name}
//                   </option>
//                 ))}
//               </select>
//             </label>
//             <label className="field">
//               <span>Unit</span>
//               <input
//                 value={form.unit}
//                 onChange={(e) => setF('unit', e.target.value)}
//                 placeholder="Pcs"
//               />
//             </label>
//             <label className="field">
//               <span>Size</span>
//               <input
//                 value={form.size}
//                 onChange={(e) => setF('size', e.target.value)}
//                 placeholder="e.g. 34-38 / M / L"
//               />
//             </label>
//             <label className="field">
//               <span>Pcs</span>
//               <input
//                 value={form.pcs}
//                 onChange={(e) => setF('pcs', e.target.value)}
//                 placeholder="e.g. 5 pcs"
//               />
//             </label>
//             <label className="field">
//               <span>Purchase Price</span>
//               <input
//                 type="number"
//                 value={form.purchasePrice}
//                 onChange={(e) => setF('purchasePrice', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>Selling Price</span>
//               <input
//                 type="number"
//                 value={form.sellingPrice}
//                 onChange={(e) => setF('sellingPrice', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>Discount %</span>
//               <input
//                 type="number"
//                 value={form.discountPercent}
//                 onChange={(e) => setF('discountPercent', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>Reorder Qty</span>
//               <input
//                 type="number"
//                 value={form.reorderQuantity}
//                 onChange={(e) => setF('reorderQuantity', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>
//                 Low Stock Alert <em className="hint-em">(units)</em>
//               </span>
//               <input
//                 type="number"
//                 min="0"
//                 value={form.lowStockThreshold}
//                 onChange={(e) => setF('lowStockThreshold', e.target.value)}
//                 placeholder="e.g. 10"
//               />
//             </label>
//             {modal.mode === 'create' && (
//               <label className="field span2">
//                 <span>Opening Stock</span>
//                 <input
//                   type="number"
//                   value={form.openingStock}
//                   onChange={(e) => setF('openingStock', e.target.value)}
//                   placeholder="0"
//                 />
//                 <em className="hint-em">
//                   Opening cost is taken from Purchase Price automatically.
//                 </em>
//               </label>
//             )}
//             {modal.mode === 'edit' && (
//               <div className="field span2 derived-box">
//                 <div>
//                   <span>Current Stock</span>
//                   <strong>
//                     {Number(modal.data.current_stock).toLocaleString('en-PK')}{' '}
//                     {modal.data.unit}
//                   </strong>
//                 </div>
//                 <div>
//                   <span>Avg Cost</span>
//                   <strong>{fmtCost(modal.data.average_cost)}</strong>
//                 </div>
//                 <div>
//                   <span>Stock Value</span>
//                   <strong>
//                     {fmt(
//                       Number(modal.data.current_stock) *
//                         Number(modal.data.average_cost)
//                     )}
//                   </strong>
//                 </div>
//                 <em className="hint-em">
//                   Derived from the stock ledger — change stock via Purchase or
//                   Adjust, not here.
//                 </em>
//               </div>
//             )}
//             <label className="field span2">
//               <span>Description</span>
//               <input
//                 value={form.description}
//                 onChange={(e) => setF('description', e.target.value)}
//               />
//             </label>
//           </div>
//         </Modal>
//       )}

//       {modal?.type === 'adjust' && (
//         <Modal
//           title={`Adjust Stock — ${modal.data.name}`}
//           onClose={() => setModal(null)}
//           width={420}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveAdjust}
//                 disabled={busy}
//               >
//                 Apply
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <p className="muted-text">
//             Current stock:{' '}
//             <strong>
//               {Number(modal.data.current_stock).toLocaleString('en-PK')}
//             </strong>{' '}
//             {modal.data.unit}
//           </p>
//           <label className="field">
//             <span>
//               Quantity to Add{' '}
//               <em className="hint-em">
//                 (kam karne ke liye minus laga dein, e.g. -5)
//               </em>
//             </span>
//             <input
//               type="number"
//               value={adjustQty}
//               autoFocus
//               placeholder="e.g. 10"
//               onChange={(e) => setAdjustQty(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && saveAdjust()}
//             />
//           </label>
//           {adjustQty !== '' && !Number.isNaN(Number(adjustQty)) && (
//             <p className="muted-text">
//               New total:{' '}
//               <strong>
//                 {(
//                   Number(modal.data.current_stock) + Number(adjustQty)
//                 ).toLocaleString('en-PK')}
//               </strong>{' '}
//               {modal.data.unit}
//             </p>
//           )}
//           <p className="muted-text">
//             The difference is posted to the stock ledger as an adjustment.
//           </p>
//         </Modal>
//       )}
//     </div>
//   )
// }

// import { useEffect, useState, useCallback, useRef } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { inventoryApi } from '../api/ipc.js'
// import Icon from '../components/Icons.jsx'
// import Modal from '../components/Modal.jsx'
// import Barcode from '../components/Barcode.jsx'
// import ProductHistoryModal from '../components/ProductHistoryModal.jsx'
// import { useHotkeys } from '../hooks/useHotkeys.js'
// import { printNow } from '../utils/print.js'
// import { notifyStockChanged } from '../utils/lowStock.js'

// const fmt = (n) =>
//   'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
// const fmtCost = (n) =>
//   'Rs. ' +
//   Number(n || 0).toLocaleString('en-PK', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2
//   })

// const emptyItem = {
//   itemCode: '',
//   name: '',
//   size: '',
//   pcs: '',
//   description: '',
//   brandId: '',
//   purchasePrice: '',
//   sellingPrice: '',
//   unit: 'Pcs',
//   reorderQuantity: '',
//   lowStockThreshold: '',
//   discountPercent: '',
//   barcode: '',
//   openingStock: ''
// }

// export default function Inventory() {
//   const navigate = useNavigate()
//   const [categories, setCategories] = useState([])
//   const [subcategories, setSubcategories] = useState([])
//   const [brands, setBrands] = useState([])
//   const [items, setItems] = useState([])

//   const [selCat, setSelCat] = useState(null)
//   const [selSub, setSelSub] = useState(null)
//   const [search, setSearch] = useState('')
//   const [viewMode, setViewMode] = useState('all')
//   // list deactivated items instead, so they can be switched back on
//   const [showInactive, setShowInactive] = useState(false)
//   const [modalCatId, setModalCatId] = useState('')
//   const [modalSubcats, setModalSubcats] = useState([])

//   const [modal, setModal] = useState(null)
//   const [form, setForm] = useState(emptyItem)
//   const [nameInput, setNameInput] = useState('')
//   const [adjustQty, setAdjustQty] = useState('')
//   const [busy, setBusy] = useState(false)
//   const [error, setError] = useState('')
//   const [notice, setNotice] = useState('')
//   // Product Stock & Purchase History modal — the item whose history is shown.
//   const [historyItem, setHistoryItem] = useState(null)
//   const searchRef = useRef(null)
//   const nameInputRef = useRef(null) // <-- Add this

//   const loadCategories = useCallback(async () => {
//     const cats = await inventoryApi.categories.list()
//     setCategories(cats)
//     return cats
//   }, [])

//   const loadItems = useCallback(async () => {
//     const params = { search, showInactive }
//     if (viewMode === 'cat') {
//       params.categoryId = selCat?.id
//       params.subCategoryId = selSub?.id
//     } else if (viewMode === 'uncat') {
//       params.uncategorized = true
//     }
//     const data = await inventoryApi.items.list(params)
//     setItems(data)
//   }, [viewMode, selCat, selSub, search, showInactive])

//   useEffect(() => {
//     ;(async () => {
//       try {
//         await loadCategories()
//         setBrands(await inventoryApi.brands.list())
//       } catch (e) {
//         setError(e.message)
//       }
//     })()
//   }, [loadCategories])

//   useEffect(() => {
//     ;(async () => {
//       if (!selCat) {
//         setSubcategories([])
//         return
//       }
//       try {
//         setSubcategories(
//           await inventoryApi.subcategories.list({ categoryId: selCat.id })
//         )
//       } catch (e) {
//         setError(e.message)
//       }
//     })()
//   }, [selCat])

//   useEffect(() => {
//     loadItems().catch((e) => setError(e.message))
//   }, [loadItems])

//   useEffect(() => {
//     if (modal?.type !== 'item') return
//     ;(async () => {
//       if (!modalCatId) {
//         setModalSubcats([])
//         return
//       }
//       try {
//         setModalSubcats(
//           await inventoryApi.subcategories.list({ categoryId: modalCatId })
//         )
//       } catch (e) {
//         setError(e.message)
//       }
//     })()
//   }, [modalCatId, modal])

//   // A dialog opening or closing starts with a clean slate — an old error ("Item name is
//   // required.") must not stay on the page after the dialog is gone.
//   // A dialog opening or closing starts with a clean slate...
//   useEffect(() => {
//     setError('')
//   }, [modal])

//   // Force focus on the Name input when the item modal opens
//   // Force focus on the Name input when the item modal opens
//   // Force focus on the Name input when the item modal opens
//   useEffect(() => {
//     if (modal?.type === 'item') {
//       // Slight delay to let the native window.confirm dialog fully close
//       const t = setTimeout(() => {
//         // 1. Aggressive trick to wake up the Electron window OS focus
//         window.blur()
//         window.focus()

//         // 2. Focus the input and force select
//         requestAnimationFrame(() => {
//           if (nameInputRef.current) {
//             nameInputRef.current.focus()
//             nameInputRef.current.select() // Highlights text, forcing OS to render the cursor
//           }
//         })
//       }, 150)

//       return () => clearTimeout(t)
//     }
//   }, [modal])

//   const flash = (msg) => {
//     setNotice(msg)
//     setTimeout(() => setNotice(''), 4000)
//   }

//   const openNameModal = (type, mode = 'create', data = null) => {
//     setNameInput(data?.name || '')
//     setError('')
//     setModal({ type, mode, data })
//   }

//   const saveName = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const { type, mode, data } = modal
//       if (type === 'category') {
//         if (mode === 'edit')
//           await inventoryApi.categories.update({ id: data.id, name: nameInput })
//         else await inventoryApi.categories.create({ name: nameInput })
//         await loadCategories()
//       } else if (type === 'subcategory') {
//         if (mode === 'edit')
//           await inventoryApi.subcategories.update({
//             id: data.id,
//             name: nameInput
//           })
//         else
//           await inventoryApi.subcategories.create({
//             categoryId: selCat.id,
//             name: nameInput
//           })
//         setSubcategories(
//           await inventoryApi.subcategories.list({ categoryId: selCat.id })
//         )
//       }
//       setModal(null)
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const openItemModal = async (mode, item = null) => {
//     setError('')
//     if (mode === 'create') {
//       let code = ''
//       try {
//         code = (await inventoryApi.items.nextCode()).code
//       } catch {
//         /* offline */
//       }
//       setForm({
//         ...emptyItem,
//         itemCode: code,
//         barcode: code,
//         subCategoryId: selSub?.id || ''
//       })
//       setModalCatId(selCat?.id ? String(selCat.id) : '')
//     } else {
//       setForm({
//         id: item.id,
//         itemCode: item.item_code,
//         name: item.name,
//         size: item.size || '',
//         pcs: item.pcs || '',
//         description: item.description || '',
//         brandId: item.brand_id || '',
//         purchasePrice: item.purchase_price,
//         sellingPrice: item.selling_price,
//         unit: item.unit,
//         reorderQuantity: item.reorder_quantity,
//         lowStockThreshold: item.low_stock_threshold ?? '',
//         discountPercent: item.discount_percent,
//         barcode: item.barcode || '',
//         subCategoryId: item.sub_category_id || ''
//       })
//       setModalCatId(item.category_id ? String(item.category_id) : '')
//     }
//     setModal({ type: 'item', mode, data: item })
//   }

//   const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }))

//   // NEW: typing in Item Code auto-syncs the Barcode field so the two stay together
//   // when the user overrides the auto-generated code (e.g. 00007 → 14725).
//   const setItemCode = (val) => {
//     setForm((f) => ({
//       ...f,
//       itemCode: val,
//       barcode: val // Auto-sync barcode when code changes
//     }))
//   }

//   const saveItem = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const payload = {
//         ...form,
//         size: form.size,
//         pcs: form.pcs,
//         // the Category chosen in the form is saved even without a Sub-category
//         categoryId: modalCatId ? Number(modalCatId) : null,
//         subCategoryId: form.subCategoryId || null
//       }
//       if (modal.mode === 'create') {
//         await inventoryApi.items.create(payload)
//       } else {
//         await inventoryApi.items.update(payload)
//       }
//       setModal(null)
//       notifyStockChanged() // alert level / stock may have changed → refresh low-stock badge
//       await loadItems()
//       await loadCategories()
//       if (selCat) {
//         setSubcategories(
//           await inventoryApi.subcategories.list({ categoryId: selCat.id })
//         )
//       }
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const deactivateItem = async (item) => {
//     if (
//       !window.confirm(
//         `Deactivate "${item.name}"? It will be hidden from lists.`
//       )
//     )
//       return
//     try {
//       await inventoryApi.items.toggle({ id: item.id, isActive: false })
//       await loadItems()
//     } catch (e) {
//       setError(e.message)
//     }
//   }
//   const activateItem = async (item) => {
//     try {
//       await inventoryApi.items.toggle({ id: item.id, isActive: true })
//       await loadItems()
//       flash(`"${item.name}" is active again.`)
//     } catch (e) {
//       setError(e.message)
//     }
//   }

//   const openAdjust = (item) => {
//     setAdjustQty('')
//     setError('')
//     setModal({ type: 'adjust', mode: 'edit', data: item })
//   }

//   const saveAdjust = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const delta = Number(adjustQty)
//       if (adjustQty === '' || Number.isNaN(delta)) {
//         setError('Enter a valid quantity.')
//         setBusy(false)
//         return
//       }
//       const target = Number(modal.data.current_stock) + delta
//       if (target < 0) {
//         setError('Resulting stock cannot be negative.')
//         setBusy(false)
//         return
//       }
//       await inventoryApi.items.adjustStock({
//         id: modal.data.id,
//         newQuantity: target
//       })
//       setModal(null)
//       notifyStockChanged()
//       await loadItems()
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }

//   const importExcel = async () => {
//     setBusy(true)
//     setError('')
//     try {
//       const r = await inventoryApi.items.importExcel()
//       if (!r.canceled) {
//         await loadCategories()
//         await loadItems()
//         flash(
//           `Imported ${r.imported} item(s)` +
//             (r.skipped ? `, ${r.skipped} skipped.` : '.')
//         )
//         if (r.errors?.length)
//           setError('Some rows skipped:\n' + r.errors.join('\n'))
//       }
//     } catch (e) {
//       setError(e.message)
//     } finally {
//       setBusy(false)
//     }
//   }
//   const downloadTemplate = async () => {
//     try {
//       const r = await inventoryApi.items.importTemplate()
//       if (!r.canceled) flash('Template saved.')
//     } catch (e) {
//       setError(e.message)
//     }
//   }

//   useHotkeys(
//     {
//       f2: () => searchRef.current?.focus(),
//       f5: () => {
//         if (busy) return
//         loadItems().catch((e) => setError(e.message))
//         loadCategories().catch((e) => setError(e.message))
//       },
//       f8: () => {
//         if (busy || modal) return
//         openItemModal('create')
//       },
//       f9: () => {
//         if (busy || !modal) return
//         if (modal.type === 'item') saveItem()
//         else if (modal.type === 'category' || modal.type === 'subcategory')
//           saveName()
//         else if (modal.type === 'adjust') saveAdjust()
//       },
//       p: () => printNow(),
//       escape: () => {
//         if (historyItem) setHistoryItem(null)
//         else if (modal) setModal(null)
//       },
//       delete: () => {}
//     },
//     [busy, modal, viewMode, selCat, selSub, historyItem]
//   )

//   return (
//     <div className="inv-layout">
//       <div className="inv-pane">
//         <div className="inv-pane-head">
//           <span>Categories</span>
//           <button
//             className="btn-icon"
//             onClick={() => openNameModal('category')}
//             title="Add category"
//           >
//             <Icon name="plus" size={16} />
//           </button>
//         </div>
//         <div className="inv-list">
//           <div
//             className={
//               'inv-list-item inv-pin' + (viewMode === 'all' ? ' active' : '')
//             }
//             onClick={() => {
//               setViewMode('all')
//               setSelCat(null)
//               setSelSub(null)
//             }}
//           >
//             <div className="ili-text">
//               <strong>All Items</strong>
//               <span>every product</span>
//             </div>
//           </div>
//           <div
//             className={
//               'inv-list-item inv-pin' + (viewMode === 'uncat' ? ' active' : '')
//             }
//             onClick={() => {
//               setViewMode('uncat')
//               setSelCat(null)
//               setSelSub(null)
//             }}
//           >
//             <div className="ili-text">
//               <strong>Uncategorized</strong>
//               <span>no category</span>
//             </div>
//           </div>

//           {categories.length === 0 && (
//             <div className="inv-empty">No categories yet</div>
//           )}
//           {categories.map((c) => (
//             <div
//               key={c.id}
//               className={
//                 'inv-list-item' +
//                 (viewMode === 'cat' && selCat?.id === c.id ? ' active' : '')
//               }
//               onClick={() => {
//                 setViewMode('cat')
//                 setSelCat(c)
//                 setSelSub(null)
//                 setSearch('')
//               }}
//             >
//               <div className="ili-text">
//                 <strong>{c.name}</strong>
//                 <span>{c.sub_count} sub-cat</span>
//               </div>
//               <button
//                 className="ili-edit"
//                 onClick={(e) => {
//                   e.stopPropagation()
//                   openNameModal('category', 'edit', c)
//                 }}
//               >
//                 <Icon name="edit" size={14} />
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="inv-pane">
//         <div className="inv-pane-head">
//           <span>Sub-categories</span>
//           <button
//             className="btn-icon"
//             disabled={!selCat}
//             onClick={() => openNameModal('subcategory')}
//             title="Add sub-category"
//           >
//             <Icon name="plus" size={16} />
//           </button>
//         </div>
//         <div className="inv-list">
//           {!selCat && <div className="inv-empty">Pick a category</div>}
//           {selCat && subcategories.length === 0 && (
//             <div className="inv-empty">No sub-categories</div>
//           )}
//           {subcategories.map((s) => (
//             <div
//               key={s.id}
//               className={
//                 'inv-list-item' + (selSub?.id === s.id ? ' active' : '')
//               }
//               onClick={() => setSelSub(s)}
//             >
//               <div className="ili-text">
//                 <strong>{s.name}</strong>
//                 <span>{s.item_count} items</span>
//               </div>
//               <button
//                 className="ili-edit"
//                 onClick={(e) => {
//                   e.stopPropagation()
//                   openNameModal('subcategory', 'edit', s)
//                 }}
//               >
//                 <Icon name="edit" size={14} />
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="inv-items panel">
//         <div className="inv-toolbar">
//           <div className="search-box">
//             <Icon name="search" size={16} />
//             <input
//               ref={searchRef}
//               placeholder="Search name / code / barcode  (F2)"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>
//           <div className="toolbar-actions">
//             <label
//               className="bc-check"
//               title="Show the items you deactivated, to switch them back on"
//             >
//               <input
//                 type="checkbox"
//                 checked={showInactive}
//                 onChange={(e) => setShowInactive(e.target.checked)}
//               />{' '}
//               Show inactive
//             </label>
//             <button
//               className="btn-sm ghost"
//               onClick={() => navigate('/barcodes')}
//             >
//               <Icon name="barcode" size={15} /> Print Barcodes
//             </button>
//             <button
//               className="btn-sm primary"
//               onClick={() => openItemModal('create')}
//             >
//               <Icon name="plus" size={15} /> Add Item
//             </button>
//           </div>
//         </div>

//         {notice && <div className="inv-notice">{notice}</div>}
//         {/* while a dialog is open its own error shows there — not twice */}
//         {error && !modal && (
//           <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
//             {error}
//           </div>
//         )}

//         <div className="inv-context">
//           {viewMode === 'all' && <span>All products</span>}
//           {viewMode === 'uncat' && <span>Uncategorized products</span>}
//           {viewMode === 'cat' && selCat && (
//             <span>
//               {selCat.name}
//               {selSub ? ` › ${selSub.name}` : ' › All sub-categories'}
//             </span>
//           )}
//         </div>

//         <div className="table-scroll">
//           <table className="data-table">
//             <thead>
//               <tr>
//                 <th>Code</th>
//                 <th>Name</th>
//                 <th>Size</th>
//                 <th>Pcs</th>
//                 <th>Brand</th>
//                 <th className="num">Purchase</th>
//                 <th className="num">Selling</th>
//                 <th className="num">Stock</th>
//                 <th className="num">Avg Cost</th>
//                 <th className="num">Value</th>
//                 <th className="num">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {items.length === 0 ? (
//                 <tr>
//                   <td colSpan="11" className="empty">
//                     No items to show
//                   </td>
//                 </tr>
//               ) : (
//                 items.map((it) => {
//                   const threshold =
//                     Number(it.low_stock_threshold) > 0
//                       ? Number(it.low_stock_threshold)
//                       : Number(it.reorder_quantity)
//                   const low =
//                     threshold > 0 && Number(it.current_stock) <= threshold
//                   return (
//                     <tr key={it.id}>
//                       <td>{it.item_code}</td>
//                       <td>{it.name}</td>
//                       <td>{it.size || '—'}</td>
//                       <td>{it.pcs || '—'}</td>
//                       <td>{it.brand || '—'}</td>
//                       <td className="num">{fmt(it.purchase_price)}</td>
//                       <td className="num">{fmt(it.selling_price)}</td>
//                       <td className="num">
//                         <span className={'stock-pill' + (low ? ' low' : '')}>
//                           {Number(it.current_stock).toLocaleString('en-PK')}
//                         </span>
//                       </td>
//                       <td className="num">{fmtCost(it.average_cost)}</td>
//                       <td className="num">{fmt(it.stock_value)}</td>
//                       <td className="num">
//                         <div className="table-actions">
//                           <button
//                             className="btn-icon"
//                             title="Print label"
//                             onClick={() =>
//                               navigate('/barcodes', {
//                                 state: { itemId: it.id }
//                               })
//                             }
//                           >
//                             <Icon name="barcode" size={15} />
//                           </button>
//                           <button
//                             className="btn-icon"
//                             title="Edit"
//                             onClick={() => openItemModal('edit', it)}
//                           >
//                             <Icon name="edit" size={15} />
//                           </button>
//                           <button
//                             className="btn-icon"
//                             title="Stock & purchase history"
//                             onClick={() => setHistoryItem(it)}
//                           >
//                             <Icon name="book" size={15} />
//                           </button>
//                           <button
//                             className="btn-icon"
//                             title="Adjust stock"
//                             onClick={() => openAdjust(it)}
//                           >
//                             <Icon name="adjust" size={15} />
//                           </button>
//                           {showInactive ? (
//                             <button
//                               className="btn-icon"
//                               title="Activate (show in lists and sales again)"
//                               onClick={() => activateItem(it)}
//                             >
//                               <Icon name="check" size={15} />
//                             </button>
//                           ) : (
//                             <button
//                               className="btn-icon danger"
//                               title="Deactivate"
//                               onClick={() => deactivateItem(it)}
//                             >
//                               <Icon name="trash" size={15} />
//                             </button>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   )
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>

//         <div className="hotkey-hint">
//           <span>
//             <kbd>F2</kbd> Search
//           </span>
//           <span>
//             <kbd>F5</kbd> Refresh
//           </span>
//           <span>
//             <kbd>F8</kbd> Add Item
//           </span>
//           <span>
//             <kbd>F9</kbd> Save
//           </span>
//           <span>
//             <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
//           </span>
//           <span>
//             <kbd>Esc</kbd> Close
//           </span>
//         </div>
//       </div>

//       {modal?.type === 'category' && (
//         <Modal
//           title={modal.mode === 'edit' ? 'Edit Category' : 'New Category'}
//           onClose={() => setModal(null)}
//           width={420}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveName}
//                 disabled={busy}
//               >
//                 Save
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <label className="field">
//             <span>Name</span>
//             <input
//               value={nameInput}
//               autoFocus
//               onChange={(e) => setNameInput(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && saveName()}
//               placeholder="e.g. MENS"
//             />
//           </label>
//           <p className="muted-text">Code is generated automatically.</p>
//         </Modal>
//       )}

//       {modal?.type === 'subcategory' && (
//         <Modal
//           title={
//             modal.mode === 'edit'
//               ? 'Edit Sub-category'
//               : `New Sub-category in ${selCat?.name}`
//           }
//           onClose={() => setModal(null)}
//           width={420}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveName}
//                 disabled={busy}
//               >
//                 Save
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <label className="field">
//             <span>Name</span>
//             <input
//               value={nameInput}
//               autoFocus
//               onChange={(e) => setNameInput(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && saveName()}
//               placeholder="e.g. SHIRT"
//             />
//           </label>
//           <p className="muted-text">Code is generated automatically.</p>
//         </Modal>
//       )}

//       {modal?.type === 'item' && (
//         <Modal
//           title={
//             modal.mode === 'edit' ? `Edit Item — ${form.name}` : 'Add New Item'
//           }
//           onClose={() => setModal(null)}
//           width={640}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveItem}
//                 disabled={busy}
//               >
//                 {busy ? 'Saving…' : 'Save Item'}
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <div className="form-grid">
//             <label className="field">
//               <span>Item Code</span>
//               <input
//                 value={form.itemCode}
//                 onChange={(e) => setItemCode(e.target.value)}
//                 disabled={modal.mode === 'edit'}
//               />
//             </label>
//             <label className="field">
//               <span>Barcode</span>
//               <input
//                 value={form.barcode}
//                 onChange={(e) => setF('barcode', e.target.value)}
//               />
//             </label>
//             <label className="field span2">
//               <span>Item Name</span>
//               <input
//                 ref={nameInputRef}
//                 value={form.name}
//                 onChange={(e) => setF('name', e.target.value)}
//                 placeholder="e.g. Mens Pant"
//               />
//             </label>
//             <div className="field span2 bc-preview-field">
//               <span>Barcode Preview</span>
//               <div className="bc-preview">
//                 <Barcode
//                   value={form.barcode || form.itemCode}
//                   height={44}
//                   width={1.6}
//                   fontSize={13}
//                 />
//               </div>
//             </div>
//             <label className="field">
//               <span>
//                 Category <em className="hint-em">(optional)</em>
//               </span>
//               <select
//                 value={modalCatId}
//                 onChange={(e) => {
//                   setModalCatId(e.target.value)
//                   setF('subCategoryId', '')
//                 }}
//               >
//                 <option value="">— None —</option>
//                 {categories.map((c) => (
//                   <option key={c.id} value={c.id}>
//                     {c.name}
//                   </option>
//                 ))}
//               </select>
//             </label>
//             <label className="field">
//               <span>
//                 Sub-category <em className="hint-em">(optional)</em>
//               </span>
//               <select
//                 value={form.subCategoryId}
//                 disabled={!modalCatId}
//                 onChange={(e) => setF('subCategoryId', e.target.value)}
//               >
//                 <option value="">— None —</option>
//                 {modalSubcats.map((s) => (
//                   <option key={s.id} value={s.id}>
//                     {s.name}
//                   </option>
//                 ))}
//               </select>
//             </label>
//             <label className="field">
//               <span>Brand</span>
//               <select
//                 value={form.brandId}
//                 onChange={(e) => setF('brandId', e.target.value)}
//               >
//                 <option value="">— None —</option>
//                 {brands.map((b) => (
//                   <option key={b.id} value={b.id}>
//                     {b.name}
//                   </option>
//                 ))}
//               </select>
//             </label>
//             <label className="field">
//               <span>Unit</span>
//               <input
//                 value={form.unit}
//                 onChange={(e) => setF('unit', e.target.value)}
//                 placeholder="Pcs"
//               />
//             </label>
//             <label className="field">
//               <span>Size</span>
//               <input
//                 value={form.size}
//                 onChange={(e) => setF('size', e.target.value)}
//                 placeholder="e.g. 34-38 / M / L"
//               />
//             </label>
//             <label className="field">
//               <span>Pcs</span>
//               <input
//                 value={form.pcs}
//                 onChange={(e) => setF('pcs', e.target.value)}
//                 placeholder="e.g. 5 pcs"
//               />
//             </label>
//             <label className="field">
//               <span>Purchase Price</span>
//               <input
//                 type="number"
//                 value={form.purchasePrice}
//                 onChange={(e) => setF('purchasePrice', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>Selling Price</span>
//               <input
//                 type="number"
//                 value={form.sellingPrice}
//                 onChange={(e) => setF('sellingPrice', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>Discount %</span>
//               <input
//                 type="number"
//                 value={form.discountPercent}
//                 onChange={(e) => setF('discountPercent', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>Reorder Qty</span>
//               <input
//                 type="number"
//                 value={form.reorderQuantity}
//                 onChange={(e) => setF('reorderQuantity', e.target.value)}
//               />
//             </label>
//             <label className="field">
//               <span>
//                 Low Stock Alert <em className="hint-em">(units)</em>
//               </span>
//               <input
//                 type="number"
//                 min="0"
//                 value={form.lowStockThreshold}
//                 onChange={(e) => setF('lowStockThreshold', e.target.value)}
//                 placeholder="e.g. 10"
//               />
//             </label>
//             {modal.mode === 'create' && (
//               <label className="field span2">
//                 <span>Opening Stock</span>
//                 <input
//                   type="number"
//                   value={form.openingStock}
//                   onChange={(e) => setF('openingStock', e.target.value)}
//                   placeholder="0"
//                 />
//                 <em className="hint-em">
//                   Opening cost is taken from Purchase Price automatically.
//                 </em>
//               </label>
//             )}
//             {modal.mode === 'edit' && (
//               <div className="field span2 derived-box">
//                 <div>
//                   <span>Current Stock</span>
//                   <strong>
//                     {Number(modal.data.current_stock).toLocaleString('en-PK')}{' '}
//                     {modal.data.unit}
//                   </strong>
//                 </div>
//                 <div>
//                   <span>Avg Cost</span>
//                   <strong>{fmtCost(modal.data.average_cost)}</strong>
//                 </div>
//                 <div>
//                   <span>Stock Value</span>
//                   <strong>
//                     {fmt(
//                       Number(modal.data.current_stock) *
//                         Number(modal.data.average_cost)
//                     )}
//                   </strong>
//                 </div>
//                 <em className="hint-em">
//                   Derived from the stock ledger — change stock via Purchase or
//                   Adjust, not here.
//                 </em>
//               </div>
//             )}
//             <label className="field span2">
//               <span>Description</span>
//               <input
//                 value={form.description}
//                 onChange={(e) => setF('description', e.target.value)}
//               />
//             </label>
//           </div>
//         </Modal>
//       )}

//       {modal?.type === 'adjust' && (
//         <Modal
//           title={`Adjust Stock — ${modal.data.name}`}
//           onClose={() => setModal(null)}
//           width={420}
//           footer={
//             <>
//               <button className="btn-secondary" onClick={() => setModal(null)}>
//                 Cancel
//               </button>
//               <button
//                 className="btn-primary"
//                 onClick={saveAdjust}
//                 disabled={busy}
//               >
//                 Apply
//               </button>
//             </>
//           }
//         >
//           {error && <div className="login-error">{error}</div>}
//           <p className="muted-text">
//             Current stock:{' '}
//             <strong>
//               {Number(modal.data.current_stock).toLocaleString('en-PK')}
//             </strong>{' '}
//             {modal.data.unit}
//           </p>
//           <label className="field">
//             <span>
//               Quantity to Add{' '}
//               <em className="hint-em">
//                 (kam karne ke liye minus laga dein, e.g. -5)
//               </em>
//             </span>
//             <input
//               type="number"
//               value={adjustQty}
//               autoFocus
//               placeholder="e.g. 10"
//               onChange={(e) => setAdjustQty(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && saveAdjust()}
//             />
//           </label>
//           {adjustQty !== '' && !Number.isNaN(Number(adjustQty)) && (
//             <p className="muted-text">
//               New total:{' '}
//               <strong>
//                 {(
//                   Number(modal.data.current_stock) + Number(adjustQty)
//                 ).toLocaleString('en-PK')}
//               </strong>{' '}
//               {modal.data.unit}
//             </p>
//           )}
//           <p className="muted-text">
//             The difference is posted to the stock ledger as an adjustment.
//           </p>
//         </Modal>
//       )}

//       {historyItem && (
//         <ProductHistoryModal
//           itemId={historyItem.id}
//           onClose={() => setHistoryItem(null)}
//           onSaved={() => loadItems()}
//         />
//       )}
//     </div>
//   )
// }

import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { inventoryApi } from '../api/ipc.js'
import Icon from '../components/Icons.jsx'
import Modal from '../components/Modal.jsx'
import Barcode from '../components/Barcode.jsx'
import ProductHistoryModal from '../components/ProductHistoryModal.jsx'
import { useHotkeys } from '../hooks/useHotkeys.js'
import { printNow } from '../utils/print.js'
import { notifyStockChanged } from '../utils/lowStock.js'

const fmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })
const fmtCost = (n) =>
  'Rs. ' +
  Number(n || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const emptyItem = {
  itemCode: '',
  name: '',
  size: '',
  pcs: '',
  description: '',
  brandId: '',
  purchasePrice: '',
  sellingPrice: '',
  unit: 'Pcs',
  reorderQuantity: '',
  lowStockThreshold: '',
  discountPercent: '',
  barcode: '',
  openingStock: ''
}

export default function Inventory() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [brands, setBrands] = useState([])
  const [items, setItems] = useState([])

  const [selCat, setSelCat] = useState(null)
  const [selSub, setSelSub] = useState(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('all')
  // list deactivated items instead, so they can be switched back on
  const [showInactive, setShowInactive] = useState(false)
  const [modalCatId, setModalCatId] = useState('')
  const [modalSubcats, setModalSubcats] = useState([])

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyItem)
  const [nameInput, setNameInput] = useState('')
  const [adjustQty, setAdjustQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Product Stock & Purchase History modal — the item whose history is shown.
  const [historyItem, setHistoryItem] = useState(null)
  const searchRef = useRef(null)
  const nameInputRef = useRef(null)

  const loadCategories = useCallback(async () => {
    const cats = await inventoryApi.categories.list()
    setCategories(cats)
    return cats
  }, [])

  const loadItems = useCallback(async () => {
    const params = { search, showInactive }
    if (viewMode === 'cat') {
      params.categoryId = selCat?.id
      params.subCategoryId = selSub?.id
    } else if (viewMode === 'uncat') {
      params.uncategorized = true
    }
    const data = await inventoryApi.items.list(params)
    setItems(data)
  }, [viewMode, selCat, selSub, search, showInactive])

  useEffect(() => {
    ;(async () => {
      try {
        await loadCategories()
        setBrands(await inventoryApi.brands.list())
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [loadCategories])

  useEffect(() => {
    ;(async () => {
      if (!selCat) {
        setSubcategories([])
        return
      }
      try {
        setSubcategories(
          await inventoryApi.subcategories.list({ categoryId: selCat.id })
        )
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [selCat])

  useEffect(() => {
    loadItems().catch((e) => setError(e.message))
  }, [loadItems])

  useEffect(() => {
    if (modal?.type !== 'item') return
    ;(async () => {
      if (!modalCatId) {
        setModalSubcats([])
        return
      }
      try {
        setModalSubcats(
          await inventoryApi.subcategories.list({ categoryId: modalCatId })
        )
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [modalCatId, modal])

  // A dialog opening or closing starts with a clean slate — an old error ("Item name is
  // required.") must not stay on the page after the dialog is gone.
  useEffect(() => {
    setError('')
  }, [modal])

  // Force focus on the Name input when the item modal opens
  useEffect(() => {
    if (modal?.type === 'item') {
      // Slight delay to let the native window.confirm dialog fully close
      const t = setTimeout(() => {
        // 1. Aggressive trick to wake up the Electron window OS focus
        window.blur()
        window.focus()

        // 2. Focus the input and force select
        requestAnimationFrame(() => {
          if (nameInputRef.current) {
            nameInputRef.current.focus()
            nameInputRef.current.select() // Highlights text, forcing OS to render the cursor
          }
        })
      }, 150)

      return () => clearTimeout(t)
    }
  }, [modal])

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 4000)
  }

  const openNameModal = (type, mode = 'create', data = null) => {
    setNameInput(data?.name || '')
    setError('')
    setModal({ type, mode, data })
  }

  const saveName = async () => {
    setBusy(true)
    setError('')
    try {
      const { type, mode, data } = modal
      if (type === 'category') {
        if (mode === 'edit')
          await inventoryApi.categories.update({ id: data.id, name: nameInput })
        else await inventoryApi.categories.create({ name: nameInput })
        await loadCategories()
      } else if (type === 'subcategory') {
        if (mode === 'edit')
          await inventoryApi.subcategories.update({
            id: data.id,
            name: nameInput
          })
        else
          await inventoryApi.subcategories.create({
            categoryId: selCat.id,
            name: nameInput
          })
        setSubcategories(
          await inventoryApi.subcategories.list({ categoryId: selCat.id })
        )
      }
      setModal(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openItemModal = async (mode, item = null) => {
    setError('')
    let codeWarning = ''
    if (mode === 'create') {
      let code = ''
      try {
        // Ask the backend for the next auto code
        const res = await inventoryApi.items.nextCode()
        code = res.code
      } catch (e) {
        // Backend/DB error — tell the user so they can type the code manually
        codeWarning =
          'Automatic code generate nahi ho saka. Baraye meharbani manually likhein.'
      }
      setForm({
        ...emptyItem,
        itemCode: code,
        barcode: code,
        subCategoryId: selSub?.id || ''
      })
      setModalCatId(selCat?.id ? String(selCat.id) : '')
    } else {
      setForm({
        id: item.id,
        itemCode: item.item_code,
        name: item.name,
        size: item.size || '',
        pcs: item.pcs || '',
        description: item.description || '',
        brandId: item.brand_id || '',
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        unit: item.unit,
        reorderQuantity: item.reorder_quantity,
        lowStockThreshold: item.low_stock_threshold ?? '',
        discountPercent: item.discount_percent,
        barcode: item.barcode || '',
        subCategoryId: item.sub_category_id || ''
      })
      setModalCatId(item.category_id ? String(item.category_id) : '')
    }
    setModal({ type: 'item', mode, data: item })
    // Show the warning AFTER the modal-open effect has cleared stale errors,
    // so it doesn't get wiped by that effect.
    if (codeWarning) setTimeout(() => setError(codeWarning), 0)
  }

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Typing in Item Code auto-syncs the Barcode field so the two stay together
  // when the user overrides the auto-generated code (e.g. 00007 → 14725).
  const setItemCode = (val) => {
    setForm((f) => ({
      ...f,
      itemCode: val,
      barcode: val // Auto-sync barcode when code changes
    }))
  }

  const saveItem = async () => {
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...form,
        size: form.size,
        pcs: form.pcs,
        // the Category chosen in the form is saved even without a Sub-category
        categoryId: modalCatId ? Number(modalCatId) : null,
        subCategoryId: form.subCategoryId || null
      }
      if (modal.mode === 'create') {
        await inventoryApi.items.create(payload)
      } else {
        await inventoryApi.items.update(payload)
      }
      setModal(null)
      notifyStockChanged() // alert level / stock may have changed → refresh low-stock badge
      await loadItems()
      await loadCategories()
      if (selCat) {
        setSubcategories(
          await inventoryApi.subcategories.list({ categoryId: selCat.id })
        )
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const deactivateItem = async (item) => {
    if (
      !window.confirm(
        `Deactivate "${item.name}"? It will be hidden from lists.`
      )
    )
      return
    try {
      await inventoryApi.items.toggle({ id: item.id, isActive: false })
      await loadItems()
    } catch (e) {
      setError(e.message)
    }
  }
  const activateItem = async (item) => {
    try {
      await inventoryApi.items.toggle({ id: item.id, isActive: true })
      await loadItems()
      flash(`"${item.name}" is active again.`)
    } catch (e) {
      setError(e.message)
    }
  }

  const openAdjust = (item) => {
    setAdjustQty('')
    setError('')
    setModal({ type: 'adjust', mode: 'edit', data: item })
  }

  const saveAdjust = async () => {
    setBusy(true)
    setError('')
    try {
      const delta = Number(adjustQty)
      if (adjustQty === '' || Number.isNaN(delta)) {
        setError('Enter a valid quantity.')
        setBusy(false)
        return
      }
      const target = Number(modal.data.current_stock) + delta
      if (target < 0) {
        setError('Resulting stock cannot be negative.')
        setBusy(false)
        return
      }
      await inventoryApi.items.adjustStock({
        id: modal.data.id,
        newQuantity: target
      })
      setModal(null)
      notifyStockChanged()
      await loadItems()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const importExcel = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await inventoryApi.items.importExcel()
      if (!r.canceled) {
        await loadCategories()
        await loadItems()
        flash(
          `Imported ${r.imported} item(s)` +
            (r.skipped ? `, ${r.skipped} skipped.` : '.')
        )
        if (r.errors?.length)
          setError('Some rows skipped:\n' + r.errors.join('\n'))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const downloadTemplate = async () => {
    try {
      const r = await inventoryApi.items.importTemplate()
      if (!r.canceled) flash('Template saved.')
    } catch (e) {
      setError(e.message)
    }
  }

  useHotkeys(
    {
      f2: () => searchRef.current?.focus(),
      f5: () => {
        if (busy) return
        loadItems().catch((e) => setError(e.message))
        loadCategories().catch((e) => setError(e.message))
      },
      f8: () => {
        if (busy || modal) return
        openItemModal('create')
      },
      f9: () => {
        if (busy || !modal) return
        if (modal.type === 'item') saveItem()
        else if (modal.type === 'category' || modal.type === 'subcategory')
          saveName()
        else if (modal.type === 'adjust') saveAdjust()
      },
      p: () => printNow(),
      escape: () => {
        if (historyItem) setHistoryItem(null)
        else if (modal) setModal(null)
      },
      delete: () => {}
    },
    [busy, modal, viewMode, selCat, selSub, historyItem]
  )

  return (
    <div className="inv-layout">
      <div className="inv-pane">
        <div className="inv-pane-head">
          <span>Categories</span>
          <button
            className="btn-icon"
            onClick={() => openNameModal('category')}
            title="Add category"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <div className="inv-list">
          <div
            className={
              'inv-list-item inv-pin' + (viewMode === 'all' ? ' active' : '')
            }
            onClick={() => {
              setViewMode('all')
              setSelCat(null)
              setSelSub(null)
            }}
          >
            <div className="ili-text">
              <strong>All Items</strong>
              <span>every product</span>
            </div>
          </div>
          <div
            className={
              'inv-list-item inv-pin' + (viewMode === 'uncat' ? ' active' : '')
            }
            onClick={() => {
              setViewMode('uncat')
              setSelCat(null)
              setSelSub(null)
            }}
          >
            <div className="ili-text">
              <strong>Uncategorized</strong>
              <span>no category</span>
            </div>
          </div>

          {categories.length === 0 && (
            <div className="inv-empty">No categories yet</div>
          )}
          {categories.map((c) => (
            <div
              key={c.id}
              className={
                'inv-list-item' +
                (viewMode === 'cat' && selCat?.id === c.id ? ' active' : '')
              }
              onClick={() => {
                setViewMode('cat')
                setSelCat(c)
                setSelSub(null)
                setSearch('')
              }}
            >
              <div className="ili-text">
                <strong>{c.name}</strong>
                <span>{c.sub_count} sub-cat</span>
              </div>
              <button
                className="ili-edit"
                onClick={(e) => {
                  e.stopPropagation()
                  openNameModal('category', 'edit', c)
                }}
              >
                <Icon name="edit" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="inv-pane">
        <div className="inv-pane-head">
          <span>Sub-categories</span>
          <button
            className="btn-icon"
            disabled={!selCat}
            onClick={() => openNameModal('subcategory')}
            title="Add sub-category"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <div className="inv-list">
          {!selCat && <div className="inv-empty">Pick a category</div>}
          {selCat && subcategories.length === 0 && (
            <div className="inv-empty">No sub-categories</div>
          )}
          {subcategories.map((s) => (
            <div
              key={s.id}
              className={
                'inv-list-item' + (selSub?.id === s.id ? ' active' : '')
              }
              onClick={() => setSelSub(s)}
            >
              <div className="ili-text">
                <strong>{s.name}</strong>
                <span>{s.item_count} items</span>
              </div>
              <button
                className="ili-edit"
                onClick={(e) => {
                  e.stopPropagation()
                  openNameModal('subcategory', 'edit', s)
                }}
              >
                <Icon name="edit" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="inv-items panel">
        <div className="inv-toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              placeholder="Search name / code / barcode  (F2)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <label
              className="bc-check"
              title="Show the items you deactivated, to switch them back on"
            >
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />{' '}
              Show inactive
            </label>
            <button
              className="btn-sm ghost"
              onClick={() => navigate('/barcodes')}
            >
              <Icon name="barcode" size={15} /> Print Barcodes
            </button>
            <button
              className="btn-sm primary"
              onClick={() => openItemModal('create')}
            >
              <Icon name="plus" size={15} /> Add Item
            </button>
          </div>
        </div>

        {notice && <div className="inv-notice">{notice}</div>}
        {/* while a dialog is open its own error shows there — not twice */}
        {error && !modal && (
          <div className="login-error" style={{ whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}

        <div className="inv-context">
          {viewMode === 'all' && <span>All products</span>}
          {viewMode === 'uncat' && <span>Uncategorized products</span>}
          {viewMode === 'cat' && selCat && (
            <span>
              {selCat.name}
              {selSub ? ` › ${selSub.name}` : ' › All sub-categories'}
            </span>
          )}
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Size</th>
                <th>Pcs</th>
                <th>Brand</th>
                <th className="num">Purchase</th>
                <th className="num">Selling</th>
                <th className="num">Stock</th>
                <th className="num">Avg Cost</th>
                <th className="num">Value</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="11" className="empty">
                    No items to show
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const threshold =
                    Number(it.low_stock_threshold) > 0
                      ? Number(it.low_stock_threshold)
                      : Number(it.reorder_quantity)
                  const low =
                    threshold > 0 && Number(it.current_stock) <= threshold
                  return (
                    <tr key={it.id}>
                      <td>{it.item_code}</td>
                      <td>{it.name}</td>
                      <td>{it.size || '—'}</td>
                      <td>{it.pcs || '—'}</td>
                      <td>{it.brand || '—'}</td>
                      <td className="num">{fmt(it.purchase_price)}</td>
                      <td className="num">{fmt(it.selling_price)}</td>
                      <td className="num">
                        <span className={'stock-pill' + (low ? ' low' : '')}>
                          {Number(it.current_stock).toLocaleString('en-PK')}
                        </span>
                      </td>
                      <td className="num">{fmtCost(it.average_cost)}</td>
                      <td className="num">{fmt(it.stock_value)}</td>
                      <td className="num">
                        <div className="table-actions">
                          <button
                            className="btn-icon"
                            title="Print label"
                            onClick={() =>
                              navigate('/barcodes', {
                                state: { itemId: it.id }
                              })
                            }
                          >
                            <Icon name="barcode" size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Edit"
                            onClick={() => openItemModal('edit', it)}
                          >
                            <Icon name="edit" size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Stock & purchase history"
                            onClick={() => setHistoryItem(it)}
                          >
                            <Icon name="book" size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Adjust stock"
                            onClick={() => openAdjust(it)}
                          >
                            <Icon name="adjust" size={15} />
                          </button>
                          {showInactive ? (
                            <button
                              className="btn-icon"
                              title="Activate (show in lists and sales again)"
                              onClick={() => activateItem(it)}
                            >
                              <Icon name="check" size={15} />
                            </button>
                          ) : (
                            <button
                              className="btn-icon danger"
                              title="Deactivate"
                              onClick={() => deactivateItem(it)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="hotkey-hint">
          <span>
            <kbd>F2</kbd> Search
          </span>
          <span>
            <kbd>F5</kbd> Refresh
          </span>
          <span>
            <kbd>F8</kbd> Add Item
          </span>
          <span>
            <kbd>F9</kbd> Save
          </span>
          <span>
            <kbd>Ctrl</kbd>+<kbd>P</kbd> Print
          </span>
          <span>
            <kbd>Esc</kbd> Close
          </span>
        </div>
      </div>

      {modal?.type === 'category' && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit Category' : 'New Category'}
          onClose={() => setModal(null)}
          width={420}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveName}
                disabled={busy}
              >
                Save
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <label className="field">
            <span>Name</span>
            <input
              value={nameInput}
              autoFocus
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              placeholder="e.g. MENS"
            />
          </label>
          <p className="muted-text">Code is generated automatically.</p>
        </Modal>
      )}

      {modal?.type === 'subcategory' && (
        <Modal
          title={
            modal.mode === 'edit'
              ? 'Edit Sub-category'
              : `New Sub-category in ${selCat?.name}`
          }
          onClose={() => setModal(null)}
          width={420}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveName}
                disabled={busy}
              >
                Save
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <label className="field">
            <span>Name</span>
            <input
              value={nameInput}
              autoFocus
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              placeholder="e.g. SHIRT"
            />
          </label>
          <p className="muted-text">Code is generated automatically.</p>
        </Modal>
      )}

      {modal?.type === 'item' && (
        <Modal
          title={
            modal.mode === 'edit' ? `Edit Item — ${form.name}` : 'Add New Item'
          }
          onClose={() => setModal(null)}
          width={640}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveItem}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save Item'}
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <div className="form-grid">
            <label className="field">
              <span>Item Code</span>
              <input
                value={form.itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                disabled={modal.mode === 'edit'}
              />
            </label>
            <label className="field">
              <span>Barcode</span>
              <input
                value={form.barcode}
                onChange={(e) => setF('barcode', e.target.value)}
              />
            </label>
            <label className="field span2">
              <span>Item Name</span>
              <input
                ref={nameInputRef}
                value={form.name}
                onChange={(e) => setF('name', e.target.value)}
                placeholder="e.g. Mens Pant"
              />
            </label>
            <div className="field span2 bc-preview-field">
              <span>Barcode Preview</span>
              <div className="bc-preview">
                <Barcode
                  value={form.barcode || form.itemCode}
                  height={44}
                  width={1.6}
                  fontSize={13}
                />
              </div>
            </div>
            <label className="field">
              <span>
                Category <em className="hint-em">(optional)</em>
              </span>
              <select
                value={modalCatId}
                onChange={(e) => {
                  setModalCatId(e.target.value)
                  setF('subCategoryId', '')
                }}
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
              <span>
                Sub-category <em className="hint-em">(optional)</em>
              </span>
              <select
                value={form.subCategoryId}
                disabled={!modalCatId}
                onChange={(e) => setF('subCategoryId', e.target.value)}
              >
                <option value="">— None —</option>
                {modalSubcats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Brand</span>
              <select
                value={form.brandId}
                onChange={(e) => setF('brandId', e.target.value)}
              >
                <option value="">— None —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Unit</span>
              <input
                value={form.unit}
                onChange={(e) => setF('unit', e.target.value)}
                placeholder="Pcs"
              />
            </label>
            <label className="field">
              <span>Size</span>
              <input
                value={form.size}
                onChange={(e) => setF('size', e.target.value)}
                placeholder="e.g. 34-38 / M / L"
              />
            </label>
            <label className="field">
              <span>Pcs</span>
              <input
                value={form.pcs}
                onChange={(e) => setF('pcs', e.target.value)}
                placeholder="e.g. 5 pcs"
              />
            </label>
            <label className="field">
              <span>Purchase Price</span>
              <input
                type="number"
                value={form.purchasePrice}
                onChange={(e) => setF('purchasePrice', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Selling Price</span>
              <input
                type="number"
                value={form.sellingPrice}
                onChange={(e) => setF('sellingPrice', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Discount %</span>
              <input
                type="number"
                value={form.discountPercent}
                onChange={(e) => setF('discountPercent', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Reorder Qty</span>
              <input
                type="number"
                value={form.reorderQuantity}
                onChange={(e) => setF('reorderQuantity', e.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Low Stock Alert <em className="hint-em">(units)</em>
              </span>
              <input
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) => setF('lowStockThreshold', e.target.value)}
                placeholder="e.g. 10"
              />
            </label>
            {modal.mode === 'create' && (
              <label className="field span2">
                <span>Opening Stock</span>
                <input
                  type="number"
                  value={form.openingStock}
                  onChange={(e) => setF('openingStock', e.target.value)}
                  placeholder="0"
                />
                <em className="hint-em">
                  Opening cost is taken from Purchase Price automatically.
                </em>
              </label>
            )}
            {modal.mode === 'edit' && (
              <div className="field span2 derived-box">
                <div>
                  <span>Current Stock</span>
                  <strong>
                    {Number(modal.data.current_stock).toLocaleString('en-PK')}{' '}
                    {modal.data.unit}
                  </strong>
                </div>
                <div>
                  <span>Avg Cost</span>
                  <strong>{fmtCost(modal.data.average_cost)}</strong>
                </div>
                <div>
                  <span>Stock Value</span>
                  <strong>
                    {fmt(
                      Number(modal.data.current_stock) *
                        Number(modal.data.average_cost)
                    )}
                  </strong>
                </div>
                <em className="hint-em">
                  Derived from the stock ledger — change stock via Purchase or
                  Adjust, not here.
                </em>
              </div>
            )}
            <label className="field span2">
              <span>Description</span>
              <input
                value={form.description}
                onChange={(e) => setF('description', e.target.value)}
              />
            </label>
          </div>
        </Modal>
      )}

      {modal?.type === 'adjust' && (
        <Modal
          title={`Adjust Stock — ${modal.data.name}`}
          onClose={() => setModal(null)}
          width={420}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={saveAdjust}
                disabled={busy}
              >
                Apply
              </button>
            </>
          }
        >
          {error && <div className="login-error">{error}</div>}
          <p className="muted-text">
            Current stock:{' '}
            <strong>
              {Number(modal.data.current_stock).toLocaleString('en-PK')}
            </strong>{' '}
            {modal.data.unit}
          </p>
          <label className="field">
            <span>
              Quantity to Add{' '}
              <em className="hint-em">
                (kam karne ke liye minus laga dein, e.g. -5)
              </em>
            </span>
            <input
              type="number"
              value={adjustQty}
              autoFocus
              placeholder="e.g. 10"
              onChange={(e) => setAdjustQty(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveAdjust()}
            />
          </label>
          {adjustQty !== '' && !Number.isNaN(Number(adjustQty)) && (
            <p className="muted-text">
              New total:{' '}
              <strong>
                {(
                  Number(modal.data.current_stock) + Number(adjustQty)
                ).toLocaleString('en-PK')}
              </strong>{' '}
              {modal.data.unit}
            </p>
          )}
          <p className="muted-text">
            The difference is posted to the stock ledger as an adjustment.
          </p>
        </Modal>
      )}

      {historyItem && (
        <ProductHistoryModal
          itemId={historyItem.id}
          onClose={() => setHistoryItem(null)}
          onSaved={() => loadItems()}
        />
      )}
    </div>
  )
}
