-- 003 — Product returns / refunds (logged separately from sales).
CREATE TABLE sales_returns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_no VARCHAR(30) NOT NULL,
  sale_id BIGINT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  return_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  refund_mode ENUM('cash','bank','credit_adjust') NOT NULL DEFAULT 'cash',
  refund_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  account_id INT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_return_no (return_no),
  CONSTRAINT fk_ret_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_ret_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_ret_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT fk_ret_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_ret_sale (sale_id),
  INDEX idx_ret_date (return_date)
) ENGINE=InnoDB;

CREATE TABLE sales_return_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT UNSIGNED NOT NULL,
  sale_item_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_reti_ret FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_reti_saleitem FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
  CONSTRAINT fk_reti_item FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_reti_ret (return_id)
) ENGINE=InnoDB;