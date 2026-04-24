-- SQL/024_add_item_level_limits.sql

-- Add min_quantity and max_quantity to group_items
ALTER TABLE public.group_items 
ADD COLUMN IF NOT EXISTS min_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 0;

-- Update existing items to have a default limit of 0 (unlimited for existing logic)
-- Actually DEFAULT 0 is already set.

-- Add comment for documentation
COMMENT ON COLUMN public.group_items.min_quantity IS 'Minimum quantity allowed for this specific ingredient in a group selection.';
COMMENT ON COLUMN public.group_items.max_quantity IS 'Maximum quantity allowed for this specific ingredient. 0 means interpreted by group or unlimited.';
