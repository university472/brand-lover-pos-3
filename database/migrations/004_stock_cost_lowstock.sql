-- 004 — Higher precision for weighted-avg cost + per-product low-stock threshold.
ALTER TABLE items
  MODIFY COLUMN average_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  ADD COLUMN low_stock_threshold DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER reorder_quantity;

ALTER TABLE stock_ledger
  MODIFY COLUMN unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  MODIFY COLUMN balance_avg_cost DECIMAL(15,4) NOT NULL DEFAULT 0;