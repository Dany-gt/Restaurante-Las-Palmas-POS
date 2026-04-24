-- SQL/023_layered_navigation_schema.sql

-- Add group_prompt to option_groups (Screen level 1 button text)
ALTER TABLE public.option_groups 
ADD COLUMN IF NOT EXISTS group_prompt VARCHAR(255);

-- Add group_prompt to modifier_groups (Screen level 1 button text)
ALTER TABLE public.modifier_groups 
ADD COLUMN IF NOT EXISTS group_prompt VARCHAR(255);

-- Add sort_order to group_items for visual ordering
ALTER TABLE public.group_items 
ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Populate default values for group_prompt using the current name
UPDATE public.option_groups 
SET group_prompt = name 
WHERE group_prompt IS NULL;

UPDATE public.modifier_groups 
SET group_prompt = name 
WHERE group_prompt IS NULL;
