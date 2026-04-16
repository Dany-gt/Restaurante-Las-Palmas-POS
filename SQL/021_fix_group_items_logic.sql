-- FIX GROUP ITEMS LOGIC: SUPPORT TEXTUAL NAMES
-- Corrects the error where groups were linked to inventory products instead of textual names

-- 1. Add item_name column and make product_id nullable
ALTER TABLE public.group_items 
ADD COLUMN IF NOT EXISTS item_name TEXT;

ALTER TABLE public.group_items 
ALTER COLUMN product_id DROP NOT NULL;

-- 2. Migrate existing data if item_name is empty (try to get from products)
-- This helps preserve existing configurations if possible
UPDATE public.group_items gi
SET item_name = p.name
FROM public.products p
WHERE gi.product_id = p.id
AND gi.item_name IS NULL;

-- 3. If product_id and item_name are both null, we might want a constraint 
-- but since we're in migration let's just ensure future inserts have at least one.
-- Actually, the UI will ensure item_name is filled.

-- Ensure RLS is still valid (it should be as we didn't drop the table)
