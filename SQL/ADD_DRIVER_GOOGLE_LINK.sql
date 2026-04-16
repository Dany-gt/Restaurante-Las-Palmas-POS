
-- Add google_location_link column to delivery_drivers table
ALTER TABLE public.delivery_drivers 
ADD COLUMN IF NOT EXISTS google_location_link TEXT;

-- Comment on column
COMMENT ON COLUMN public.delivery_drivers.google_location_link IS 'Link permanente de ubicación compartida de Google Maps';
