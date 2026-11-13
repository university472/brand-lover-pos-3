-- 002 — Track how each sale was paid: cash, online, or credit.
ALTER TABLE sales
  ADD COLUMN payment_type ENUM('cash','online','credit') NOT NULL DEFAULT 'cash' AFTER invoice_type;