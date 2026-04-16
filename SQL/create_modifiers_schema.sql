-- CREATE MODIFIER TABLES

CREATE TABLE IF NOT EXISTS public.modifier_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_modifier_groups (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, group_id)
);

-- Note: We also create product_modifiers for specific one-off modifier assignment if needed, 
-- but normally assigning the group is enough for 'Términos de carne'.
CREATE TABLE IF NOT EXISTS public.product_modifiers (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    modifier_id UUID REFERENCES public.modifiers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (product_id, modifier_id)
);

-- RLS
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read modifier_groups" ON public.modifier_groups FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all modifier_groups" ON public.modifier_groups FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read modifiers" ON public.modifiers FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all modifiers" ON public.modifiers FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read product_modifier_groups" ON public.product_modifier_groups FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all product_modifier_groups" ON public.product_modifier_groups FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read product_modifiers" ON public.product_modifiers FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all product_modifiers" ON public.product_modifiers FOR ALL TO public USING (true) WITH CHECK (true);
