-- Merchants can list their business under several categories (e.g. hair AND
-- nails). category_id stays as the primary category — it still drives
-- `industry`, the admin list, and every reader that only knows one category —
-- and category_ids holds the full set, primary first. Serializers union the
-- two, so a row whose category_id is changed elsewhere (admin edit, seed
-- script) without touching category_ids still lists its primary category.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS category_ids JSONB NOT NULL DEFAULT '[]';

UPDATE businesses
   SET category_ids = jsonb_build_array(category_id)
 WHERE category_ids = '[]'::jsonb;
