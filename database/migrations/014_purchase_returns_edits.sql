-- 014 — Purchase bill edits + returns to vendor (defective / short goods).
--   • vendor_ledger gets two entry types:
--       'return' = goods sent back to the vendor (we owe LESS → credit)
--       'refund' = the vendor paid us money back for a return (debit, cancels the return's
--                  effect on the balance because the money came to us instead)
--   • purchase_returns / purchase_return_items = the return documents (PR-0001 …)
--   • purchase_bill_edits = history of every bill edit (old total → new total, what, why)
ALTER TABLE vendor_ledger
  MODIFY COLUMN entry_type ENUM('opening','bill','payment','adjustment','return','refund') NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_returns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_no VARCHAR(30) NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  vendor_id INT UNSIGNED NOT NULL,
  return_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  settlement ENUM('deduct','refund','none') NOT NULL DEFAULT 'deduct',
  account_id INT UNSIGNED NULL,
  voucher_id BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_preturn_no (return_no),
  CONSTRAINT fk_pret_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_pret_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  INDEX idx_pret_po (purchase_order_id),
  INDEX idx_pret_date (return_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT UNSIGNED NOT NULL,
  po_item_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NULL,
  description VARCHAR(255) NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_preti_ret FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_preti_poitem FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id),
  INDEX idx_preti_ret (return_id),
  INDEX idx_preti_poitem (po_item_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_bill_edits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  old_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  new_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  reason VARCHAR(255) NULL,
  changes TEXT NULL,
  edited_by INT UNSIGNED NULL,
  edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pbe_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  INDEX idx_pbe_po (purchase_order_id)
) ENGINE=InnoDB;
