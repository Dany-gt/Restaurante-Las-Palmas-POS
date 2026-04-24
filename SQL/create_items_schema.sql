-- CREATE OPTIONS AND MODIFIERS ITEM TABLES

-- 1. Ensure option_groups exists (and add 'multi' if needed)
CREATE TABLE IF NOT EXISTS public.option_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    multi BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create 'options' table
CREATE TABLE IF NOT EXISTS public.options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.option_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create 'modifiers' table (in case it threw a cache error earlier)
CREATE TABLE IF NOT EXISTS public.modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read option_groups" ON public.option_groups FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all option_groups" ON public.option_groups FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read options" ON public.options FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all options" ON public.options FOR ALL TO public USING (true) WITH CHECK (true);

-- Drop existing if they exist so we can recreate broadly
DROP POLICY IF EXISTS "Allow public read modifiers" ON public.modifiers;
DROP POLICY IF EXISTS "Allow public all modifiers" ON public.modifiers;
CREATE POLICY "Allow public read modifiers" ON public.modifiers FOR SELECT TO public USING (true);
CREATE POLICY "Allow public all modifiers" ON public.modifiers FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable realtime (optional but recommended for these tables so admin updates show up immediately)
alter publication supabase_realtime add table option_groups;
alter publication supabase_realtime add table options;
alter publication supabase_realtime add table modifiers;
