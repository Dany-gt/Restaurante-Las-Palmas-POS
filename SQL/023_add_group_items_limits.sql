-- ADD QUANTITY LIMITS TO GROUP ITEMS
-- Adds min_quantity and max_quantity columns to support per-item limits in order customization

ALTER TABLE public.group_items 
ADD COLUMN IF NOT EXISTS min_quantity INTEGER DEFAULT 0;

ALTER TABLE public.group_items 
ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 0;

-- Optional: Add a check constraint to ensure non-negative values
ALTER TABLE public.group_items 
ADD CONSTRAINT group_items_qty_check 
CHECK (min_quantity >= 0 AND max_quantity >= 0);
