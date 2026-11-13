// import pool from '../db/pool.js'

// // Latest running balance for an item, read from the ledger tail.
// export async function getRunningBalance(conn, itemId) {
//   const [rows] = await conn.query(
//     `SELECT balance_qty, balance_avg_cost
//        FROM stock_ledger
//       WHERE item_id = ?
//       ORDER BY id DESC
//       LIMIT 1`,
//     [itemId]
//   )
//   if (rows.length === 0) return { qty: 0, avgCost: 0 }
//   return {
//     qty: Number(rows[0].balance_qty),
//     avgCost: Number(rows[0].balance_avg_cost)
//   }
// }

// // Post one stock movement, recompute weighted-average cost, and sync the item row.
// // Use inside a transaction (pass the transaction connection as `conn`).
// export async function postStockMovement(
//   conn,
//   {
//     itemId,
//     movementType, // opening | purchase | sale | sale_return | purchase_return | adjustment
//     quantityIn = 0,
//     quantityOut = 0,
//     unitCost = 0,
//     referenceType = null,
//     referenceId = null,
//     movementDate = null
//   }
// ) {
//   const qtyIn = Number(quantityIn) || 0
//   const qtyOut = Number(quantityOut) || 0
//   const cost = Number(unitCost) || 0
//   const date = movementDate || localToday()

//   const prev = await getRunningBalance(conn, itemId)
//   const newQty = prev.qty + qtyIn - qtyOut

//   // Weighted average only moves on an inflow that carries a cost.
//   let newAvg = prev.avgCost
//   if (qtyIn > 0 && cost > 0) {
//     const totalValue = prev.qty * prev.avgCost + qtyIn * cost
//     const totalQty = prev.qty + qtyIn
//     newAvg = totalQty > 0 ? totalValue / totalQty : cost
//   }
//   if (newQty <= 0) newAvg = prev.avgCost || cost || 0

//   await conn.query(
//     `INSERT INTO stock_ledger
//        (item_id, movement_type, reference_type, reference_id,
//         quantity_in, quantity_out, unit_cost, balance_qty, balance_avg_cost, movement_date)
//      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//     [
//       itemId,
//       movementType,
//       referenceType,
//       referenceId,
//       qtyIn,
//       qtyOut,
//       cost,
//       newQty,
//       Number(newAvg.toFixed(2)),
//       date
//     ]
//   )

//   await conn.query(
//     `UPDATE items SET current_stock = ?, average_cost = ? WHERE id = ?`,
//     [newQty, Number(newAvg.toFixed(2)), itemId]
//   )

//   return { qty: newQty, avgCost: newAvg }
// }


import pool from '../db/pool.js'

import { localToday } from './date.util.js'
// Latest running balance for an item, read from the ledger tail.
export async function getRunningBalance(conn, itemId) {
  const [rows] = await conn.query(
    `SELECT balance_qty, balance_avg_cost
       FROM stock_ledger
      WHERE item_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [itemId]
  )
  if (rows.length === 0) return { qty: 0, avgCost: 0 }
  return {
    qty: Number(rows[0].balance_qty),
    avgCost: Number(rows[0].balance_avg_cost)
  }
}

// Post one stock movement, recompute weighted-average cost, and sync the item row.
// Use inside a transaction (pass the transaction connection as `conn`).
export async function postStockMovement(
  conn,
  {
    itemId,
    movementType, // opening | purchase | sale | sale_return | purchase_return | adjustment
    quantityIn = 0,
    quantityOut = 0,
    unitCost = 0,
    referenceType = null,
    referenceId = null,
    movementDate = null
  }
) {
  const qtyIn = Number(quantityIn) || 0
  const qtyOut = Number(quantityOut) || 0
  const cost = Number(unitCost) || 0
  const date = movementDate || localToday()

  const prev = await getRunningBalance(conn, itemId)
  const newQty = prev.qty + qtyIn - qtyOut

  // Stock can never go below zero — a sale, purchase return, purchase-bill delete/edit or
  // any other outflow larger than what is on hand is refused (same rule as Adjust Stock).
  if (qtyOut > 0 && newQty < -0.0001) {
    const [[it]] = await conn.query(`SELECT name, unit FROM items WHERE id = ?`, [itemId])
    const left = Math.max(0, +prev.qty.toFixed(2))
    throw new Error(
      `Not enough stock for "${it?.name || 'item'}" — only ${left} ${it?.unit || ''} left.`.replace(
        /\s+\./,
        '.'
      )
    )
  }

  // Weighted average only moves on an inflow that carries a cost.
  let newAvg = prev.avgCost
  if (qtyIn > 0 && cost > 0) {
    const totalValue = prev.qty * prev.avgCost + qtyIn * cost
    const totalQty = prev.qty + qtyIn
    newAvg = totalQty > 0 ? totalValue / totalQty : cost
  }
  if (newQty <= 0) newAvg = prev.avgCost || cost || 0

  await conn.query(
    `INSERT INTO stock_ledger
       (item_id, movement_type, reference_type, reference_id,
        quantity_in, quantity_out, unit_cost, balance_qty, balance_avg_cost, movement_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      itemId,
      movementType,
      referenceType,
      referenceId,
      qtyIn,
      qtyOut,
      cost,
      newQty,
      Number(newAvg.toFixed(4)),
      date
    ]
  )

  await conn.query(
    `UPDATE items SET current_stock = ?, average_cost = ? WHERE id = ?`,
    [newQty, Number(newAvg.toFixed(4)), itemId]
  )

  return { qty: newQty, avgCost: newAvg }
}