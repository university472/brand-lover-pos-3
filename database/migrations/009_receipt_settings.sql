-- 009 — Receipt header + payment QR (owner-editable).
ALTER TABLE companies
  ADD COLUMN receipt_header VARCHAR(150) NULL AFTER name,
  ADD COLUMN receipt_tagline VARCHAR(200) NULL AFTER receipt_header,
  ADD COLUMN receipt_footer VARCHAR(200) NULL AFTER receipt_tagline,
  ADD COLUMN payment_qr_data TEXT NULL AFTER receipt_footer;

UPDATE companies SET
  receipt_header = COALESCE(receipt_header, name),
  receipt_tagline = COALESCE(receipt_tagline, address),
  receipt_footer = COALESCE(receipt_footer, 'Thanks For Your Visit!')
WHERE id = 1;