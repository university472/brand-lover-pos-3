import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config()

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'brand_lover_pos',
    multipleStatements: true
  })
  console.log(
    '→ FULL RESET: clearing transactions + products + customers + vendors…'
  )
  await conn.query(`
    SET FOREIGN_KEY_CHECKS = 0;
    TRUNCATE TABLE sales_return_items;
    TRUNCATE TABLE sales_returns;
    TRUNCATE TABLE sale_items;
    TRUNCATE TABLE sales;
    TRUNCATE TABLE purchase_return_items;
    TRUNCATE TABLE purchase_returns;
    TRUNCATE TABLE purchase_bill_edits;
    TRUNCATE TABLE purchase_order_items;
    TRUNCATE TABLE purchase_orders;
    TRUNCATE TABLE vouchers;
    -- Customer udhaar history. It was NOT cleared before: customers are deleted below with
    -- FOREIGN_KEY_CHECKS = 0, so ON DELETE CASCADE never fired and their ledger rows were
    -- left behind as orphans. Because TRUNCATE sales restarts sale ids at 1, those orphan
    -- rows then pointed at NEW bills with the same id (wrong udhaar openings / statements).
    TRUNCATE TABLE customer_ledger;
    TRUNCATE TABLE vendor_ledger; -- vendor account book (vendors are deleted below)
    TRUNCATE TABLE stock_ledger;
    TRUNCATE TABLE held_bills;
    TRUNCATE TABLE items;
    TRUNCATE TABLE sub_categories;
    TRUNCATE TABLE categories;
    TRUNCATE TABLE brands;
    TRUNCATE TABLE expense_categories;
    DELETE FROM customers WHERE is_walk_in = 0;
    DELETE FROM vendors;
    SET FOREIGN_KEY_CHECKS = 1;

    -- reset balances on the remaining rows (walk-in customer, accounts)
    UPDATE accounts SET current_balance = opening_balance;
    UPDATE customers SET current_balance = opening_balance;

    -- expense_categories was truncated above; put back the defaults from migration 007 so the
    -- Payment / Expense page is not left with an empty category list.
    INSERT INTO expense_categories (name) VALUES
      ('General'), ('Utilities'), ('Salary'), ('Advance'), ('Guest / Hospitality'),
      ('Rent'), ('Transport'), ('Maintenance');
  `)
  await conn.end()
  console.log(
    '✔ Done. Everything cleared — products, customers, vendors, transactions all gone.'
  )
  console.log(
    '  Users, walk-in customer, accounts & company settings kept. Fresh start.'
  )
}
main().catch((e) => {
  console.error('✖ Reset failed:', e.message)
  process.exit(1)
})
