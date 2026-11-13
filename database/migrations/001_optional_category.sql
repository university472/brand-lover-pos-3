-- 001 — Make product category optional (items can exist without a sub-category).
-- Changing nullability does NOT require dropping the FK; NULLs are allowed under a foreign key.
ALTER TABLE items MODIFY COLUMN sub_category_id INT UNSIGNED NULL;