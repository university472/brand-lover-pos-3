-- 007 — Expense categories + tie expense vouchers to a category & optional payee.
CREATE TABLE expense_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE vouchers
  ADD COLUMN expense_category_id INT UNSIGNED NULL AFTER reference,
  ADD COLUMN payee VARCHAR(150) NULL AFTER expense_category_id,
  ADD CONSTRAINT fk_voucher_expcat FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id);

-- A few common defaults (shop can add more from the UI).
INSERT INTO expense_categories (name) VALUES
  ('General'), ('Utilities'), ('Salary'), ('Advance'), ('Guest / Hospitality'), ('Rent'), ('Transport'), ('Maintenance');