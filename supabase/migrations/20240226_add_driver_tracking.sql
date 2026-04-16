-- Upgrade delivery_drivers for real-time tracking
ALTER TABLE public.delivery_drivers 
DROP COLUMN IF EXISTS google_location_link;

ALTER TABLE public.delivery_drivers 
ADD COLUMN IF NOT EXISTS last_lat NUMERIC,
ADD COLUMN IF NOT EXISTS last_lng NUMERIC,
ADD COLUMN IF NOT EXISTS last_update TIMESTAMPTZ DEFAULT NOW();

-- Enable Realtime for the table if not already enabled
-- Note: This requires superuser or specific permissions depending on Supabase setup
-- ALTER PUBLICATION supabase_realtime ADD TABLE delivery_drivers;

COMMENT ON COLUMN public.delivery_drivers.last_lat IS 'Last recorded latitude from mobile app';
COMMENT ON COLUMN public.delivery_drivers.last_lng IS 'Last recorded longitude from mobile app';
COMMENT ON COLUMN public.delivery_drivers.last_update IS 'Timestamp of the last GPS update';
