-- SQL/022_optimize_group_items_ui.sql

-- Add display_name to group_items for custom labels different from technical item_name
ALTER TABLE public.group_items 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add color_code to group_items for customized button colors
ALTER TABLE public.group_items 
ADD COLUMN IF NOT EXISTS color_code TEXT;

-- Update display_name with item_name for existing records to ensure no empty labels
UPDATE public.group_items 
SET display_name = item_name 
WHERE display_name IS NULL;
