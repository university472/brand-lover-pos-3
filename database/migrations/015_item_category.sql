-- 015 — An item can belong to a Category without a Sub-category.
-- Before, only sub_category_id was stored, so choosing just a Category was silently lost.
ALTER TABLE items ADD COLUMN category_id INT UNSIGNED NULL AFTER description;
ALTER TABLE items ADD INDEX idx_items_category (category_id);
-- Back-fill existing items from their sub-category.
UPDATE items i JOIN sub_categories sc ON sc.id = i.sub_category_id
   SET i.category_id = sc.category_id
 WHERE i.category_id IS NULL;
