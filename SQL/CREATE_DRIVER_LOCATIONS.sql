-- Create table for storing latest driver locations
CREATE TABLE IF NOT EXISTS public.driver_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(driver_id) -- One entry per driver, we just update it
);

-- Enable RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read locations (for Dispatch View)
CREATE POLICY "Enable read access for all users" ON public.driver_locations
    FOR SELECT USING (true);

-- Allow authenticated users (drivers logging in via simple auth or just public for now for simplicity of the 'link' approach) to insert/update
-- Ideally we'd secure this, but for this 'simple link' approach we might need to allow public insert if we don't have driver auth flow yet.
-- For now, let's assume the POS user is authenticated, but the DRIVER on the phone might not be logged in as a system user. 
-- To keep it simple as requested ("Enlace de Rastreo"), we'll allow public update for now, or use an edge function.
-- Let's stick to public insert/update for simplicity of the prototype, scoped to valid driver IDs.
CREATE POLICY "Enable insert/update for public with valid driver_id" ON public.driver_locations
    FOR ALL USING (true) WITH CHECK (true);

-- realtime
alter publication supabase_realtime add table public.driver_locations;
