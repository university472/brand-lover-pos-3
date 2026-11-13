// ONE low-stock rule for the whole app (Low Stock page, sidebar badge, Dashboard alert,
// Counter Sale alert after a sale):
//   alert level = items.low_stock_threshold, or items.reorder_quantity when that is 0
//   an item is LOW when it is active, has an alert level, and current_stock <= alert level
// (Items with neither set are never "low" — the owner sets the level per item.)

export const THRESHOLD_SQL =
  'CASE WHEN i.low_stock_threshold > 0 THEN i.low_stock_threshold ELSE i.reorder_quantity END'

export const LOW_WHERE = `i.is_active = 1 AND (${THRESHOLD_SQL}) > 0
  AND i.current_stock <= (${THRESHOLD_SQL})`

// Which of these items are low RIGHT NOW (e.g. just after a sale reduced their stock).
export async function lowStockAmong(db, itemIds) {
  const ids = [...new Set((itemIds || []).filter(Boolean))]
  if (!ids.length) return []
  const [rows] = await db.query(
    `SELECT i.id, i.item_code, i.name, i.unit, i.current_stock, ${THRESHOLD_SQL} AS threshold
       FROM items i
      WHERE i.id IN (?) AND ${LOW_WHERE}
      ORDER BY i.current_stock ASC`,
    [ids]
  )
  return rows.map((r) => ({
    id: r.id,
    itemCode: r.item_code,
    name: r.name,
    unit: r.unit,
    stock: Number(r.current_stock),
    threshold: Number(r.threshold)
  }))
}
