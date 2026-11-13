-- 013 — Vendor account book (client requirement).
--   • A purchase bill can have typed product-type lines that are NOT inventory items
--     (e.g. "Kids shirts, qty 10, total 20,000") — item_id becomes optional.
--   • Each bill remembers whether it added stock (owner can tick "Add to stock"; old
--     purchase orders always did, hence default 1) and the vendor's own bill number.
--   • vendor_ledger = the vendor's running account, like customer_ledger:
--       debit  = we owe the vendor MORE (a bill)
--       credit = we owe the vendor LESS (a payment)
ALTER TABLE purchase_order_items MODIFY COLUMN item_id INT UNSIGNED NULL;

ALTER TABLE purchase_orders ADD COLUMN adds_stock TINYINT(1) NOT NULL DEFAULT 1 AFTER status;

ALTER TABLE purchase_orders ADD COLUMN vendor_bill_no VARCHAR(60) NULL AFTER serial_no;

CREATE TABLE IF NOT EXISTS vendor_ledger (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  entry_type ENUM('opening','bill','payment','adjustment') NOT NULL,
  reference_type VARCHAR(30) NULL,
  reference_id BIGINT UNSIGNED NULL,
  debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vl_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  INDEX idx_vl_vendor (vendor_id),
  INDEX idx_vl_date (entry_date)
) ENGINE=InnoDB;

-- Balances that existed before the ledger become one opening row, so ledger = balance.
INSERT INTO vendor_ledger (vendor_id, entry_date, entry_type, debit, credit, description)
SELECT v.id, CURDATE(), 'opening',
       GREATEST(v.current_balance, 0), GREATEST(-v.current_balance, 0),
       'Opening balance (before vendor ledger)'
  FROM vendors v
 WHERE v.current_balance <> 0
   AND NOT EXISTS (SELECT 1 FROM vendor_ledger l WHERE l.vendor_id = v.id);
