-- 011 — Customer ledger backbone + salesmen + item size + credit limit
-- (address already exists on customers; discount_percent on items; due_date on sales)

-- (5/6/10) Append-only money trail per customer — the single source of history.
CREATE TABLE customer_ledger (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  entry_type ENUM('opening','credit_sale','repayment',
                  'return_credit_offset','return_cash_refund','adjustment') NOT NULL,
  reference_type VARCHAR(30) NULL,        -- 'sale' | 'return' | 'voucher'
  reference_id BIGINT UNSIGNED NULL,
  debit  DECIMAL(15,2) NOT NULL DEFAULT 0,  -- increases what customer owes us
  credit DECIMAL(15,2) NOT NULL DEFAULT 0,  -- decreases what customer owes us
  description VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cl_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_cl_customer (customer_id),
  INDEX idx_cl_date (entry_date)
) ENGINE=InnoDB;

-- (7) Credit limit — if a credit bill would exceed this, block it. 0 = no limit.
ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER current_balance;

-- (2) Salesmen managed in Admin Settings (separate from login users).
CREATE TABLE salesmen (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(50) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- (2) Which salesman handled each bill (independent of who typed it = created_by).
ALTER TABLE sales ADD COLUMN salesman_id INT UNSIGNED NULL AFTER created_by;
ALTER TABLE sales ADD CONSTRAINT fk_sale_salesman
  FOREIGN KEY (salesman_id) REFERENCES salesmen(id);

-- (11) Item size — optional; flows into stock valuation & barcode label.
ALTER TABLE items ADD COLUMN size VARCHAR(40) NULL AFTER unit;