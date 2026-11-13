// // Low-stock helpers for the screens. Same rule as the backend (services/stock.alerts.js):
// //   alert level = "Low Stock Alert" (low_stock_threshold), or Reorder Qty when that is 0;
// //   an item is low when stock <= alert level (and a level is set).

// export const effectiveThreshold = (item) => {
//   const t = Number(item?.low_stock_threshold) || 0
//   return t > 0 ? t : Number(item?.reorder_quantity) || 0
// }

// // Cart lines that WILL be at/below their alert level once this bill is saved
// // (stock after sale = stock now − qty in the cart). The old check used the stock BEFORE the
// // sale, so selling the item down past its level showed no warning.
// export function lowAfterSale(cart) {
//   return cart
//     .map((l) => ({ ...l, after: Number(l.stock) - (Number(l.qty) || 0) }))
//     .filter((l) => l.threshold > 0 && l.after <= l.threshold)
// }

// // Tell the sidebar badge / Dashboard that stock changed (sale, edit, adjustment…) so they
// // refresh immediately instead of waiting for the next app start.
// export const STOCK_EVENT = 'pos:stock-changed'
// export const notifyStockChanged = () => {
//   try {
//     window.dispatchEvent(new Event(STOCK_EVENT))
//   } catch {
//     /* not in a browser (tests) */
//   }
// }

// Low-stock helpers for the screens. Same rule as the backend (services/stock.alerts.js):
//   alert level = "Low Stock Alert" (low_stock_threshold), or Reorder Qty when that is 0;
//   an item is low when stock <= alert level (and a level is set).

export const effectiveThreshold = (item) => {
  const t = Number(item?.low_stock_threshold) || 0
  return t > 0 ? t : Number(item?.reorder_quantity) || 0
}

// Cart lines that WILL be at/below their alert level once this bill is saved
// (stock after sale = stock now − qty in the cart). The old check used the stock BEFORE the
// sale, so selling the item down past its level showed no warning.
export function lowAfterSale(cart) {
  return cart
    .map((l) => ({ ...l, after: Number(l.stock) - (Number(l.qty) || 0) }))
    .filter((l) => l.threshold > 0 && l.after <= l.threshold)
}

// Tell the sidebar badge / Dashboard that stock changed (sale, edit, adjustment…) so they
// refresh immediately instead of waiting for the next app start.
export const STOCK_EVENT = 'pos:stock-changed'
export const notifyStockChanged = () => {
  try {
    window.dispatchEvent(new Event(STOCK_EVENT))
  } catch {
    /* not in a browser (tests) */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dismissed low-stock items
// Lets the user hide a low-stock alert they already know about (e.g. an item they
// intentionally keep at low stock). The dismissal is persisted in localStorage and
// survives restarts; it's automatically cleared once the item goes back above its
// alert level (see cleanupDismissedLowStock).
// ─────────────────────────────────────────────────────────────────────────────

export const LOW_STOCK_DISMISS_EVENT = 'low-stock-dismissed'

export function getDismissedLowStock() {
  try {
    return JSON.parse(localStorage.getItem('dismissedLowStock') || '[]')
  } catch {
    return []
  }
}

export function dismissLowStockItem(id) {
  const current = getDismissedLowStock()
  if (!current.includes(id)) {
    current.push(id)
    localStorage.setItem('dismissedLowStock', JSON.stringify(current))
    // Notify Sidebar and other components to update their badges
    window.dispatchEvent(new Event(LOW_STOCK_DISMISS_EVENT))
  }
}

// If an item goes back above its threshold, remove it from the dismissed list
// so a future alert will show again.
export function cleanupDismissedLowStock(activeLowItems) {
  const current = getDismissedLowStock()
  if (!current.length) return

  const activeIds = new Set(activeLowItems.map((i) => i.id))
  const next = current.filter((id) => activeIds.has(id))

  if (next.length !== current.length) {
    localStorage.setItem('dismissedLowStock', JSON.stringify(next))
    window.dispatchEvent(new Event(LOW_STOCK_DISMISS_EVENT))
  }
}
