-- 006 — Link a sale's receipt voucher to its sale, so edits/cancels reverse it reliably.
ALTER TABLE vouchers
  ADD COLUMN sale_id BIGINT UNSIGNED NULL AFTER reference,
  ADD CONSTRAINT fk_voucher_sale FOREIGN KEY (sale_id) REFERENCES sales(id);