-- 008 — Link purchase payment vouchers to their PO for reporting.
ALTER TABLE vouchers
  ADD COLUMN purchase_order_id BIGINT UNSIGNED NULL AFTER sale_id,
  ADD CONSTRAINT fk_voucher_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);