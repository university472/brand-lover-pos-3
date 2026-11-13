-- 005 — Held (parked) bills: full cart snapshot, resumed later. No stock/account impact.
CREATE TABLE held_bills (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(120) NULL,
  customer_id INT UNSIGNED NULL,
  customer_name VARCHAR(150) NULL,
  payment_type ENUM('cash','online','credit') NOT NULL DEFAULT 'cash',
  item_count INT UNSIGNED NOT NULL DEFAULT 0,
  net_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  snapshot JSON NOT NULL,
  held_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_held_user FOREIGN KEY (held_by) REFERENCES users(id),
  INDEX idx_held_by (held_by)
) ENGINE=InnoDB;