-- Add min and max selection constraints to Option Groups and their product relationships
ALTER TABLE public.option_groups ADD COLUMN IF NOT EXISTS min_selection INTEGER DEFAULT 0;
ALTER TABLE public.option_groups ADD COLUMN IF NOT EXISTS max_selection INTEGER DEFAULT 1;

ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS min_selection INTEGER DEFAULT 0;
ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS max_selection INTEGER DEFAULT 1;
