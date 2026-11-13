import pool from '../db/pool.js'

import { localToday } from './date.util.js'
// Append-only money trail per customer. `debit` = customer owes us more,
// `credit` = customer owes us less. Balance = SUM(debit - credit).
export async function postCustomerLedger(
  conn,
  {
    customerId,
    entryType,
    debit = 0,
    credit = 0,
    referenceType = null,
    referenceId = null,
    description = null,
    date = null,
    createdBy = null
  }
) {
  if (!customerId) return
  const d = date || localToday()
  await conn.query(
    `INSERT INTO customer_ledger
       (customer_id, entry_date, entry_type, reference_type, reference_id, debit, credit, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      d,
      entryType,
      referenceType,
      referenceId,
      +(Number(debit) || 0).toFixed(2),
      +(Number(credit) || 0).toFixed(2),
      description,
      createdBy
    ]
  )
}

// Optional: read-time balance from the ledger (for verification / backfill).
export async function getCustomerLedgerBalance(connOrPool, customerId) {
  const db = connOrPool || pool
  const [[r]] = await db.query(
    `SELECT COALESCE(SUM(debit - credit), 0) AS bal FROM customer_ledger WHERE customer_id = ?`,
    [customerId]
  )
  return +Number(r.bal).toFixed(2)
}
