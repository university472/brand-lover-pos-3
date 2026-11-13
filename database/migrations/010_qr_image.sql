-- 010 — Switch payment QR from text to an uploaded image (base64).
-- Reason: owner uploads a PNG/JPG of the QR from Admin Settings,
--         we store it as a data URL in MEDIUMTEXT (up to ~16MB).

ALTER TABLE companies
  ADD COLUMN payment_qr_image MEDIUMTEXT NULL AFTER payment_qr_data;

-- Optional: backfill from the old text column if you already had any
-- text-only QR (won't help for actual images, but keeps history intact)
-- UPDATE companies SET payment_qr_image = NULL WHERE id = 1;