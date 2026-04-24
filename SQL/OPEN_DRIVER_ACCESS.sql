-- Allow public read access to delivery_drivers so the tracking page can show the driver's name
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.delivery_drivers
    FOR SELECT USING (true);
