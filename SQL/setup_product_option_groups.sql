-- Ensure product_option_groups table exists first
CREATE TABLE IF NOT EXISTS public.product_option_groups (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.option_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, group_id)
);

-- RLS for product_option_groups
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read product_option_groups" ON public.product_option_groups;
DROP POLICY IF EXISTS "Allow public all product_option_groups" ON public.product_option_groups;
CREATE POLICY "Allow public read product_option_groups" ON public.product_option_groups FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all product_option_groups" ON public.product_option_groups FOR ALL TO public USING (true) WITH CHECK (true);

-- Add min and max selection constraints to Option Groups and their product relationships
ALTER TABLE public.option_groups ADD COLUMN IF NOT EXISTS min_selection INTEGER DEFAULT 0;
ALTER TABLE public.option_groups ADD COLUMN IF NOT EXISTS max_selection INTEGER DEFAULT 1;

ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS min_selection INTEGER DEFAULT 0;
ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS max_selection INTEGER DEFAULT 1;
