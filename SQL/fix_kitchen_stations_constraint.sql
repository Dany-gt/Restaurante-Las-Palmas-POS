-- Fix constraint for kitchen_stations device_type
-- Frontend sends: 'PRINTER', 'KDS', 'BOTH', 'NONE'
-- Database currently only accepts: 'KDS', 'PRINTER'

BEGIN;

-- 1. Drop existing constraint if it exists (name might vary, so we try the standard naming or just alter the type)
-- Attempt to drop the specific constraint usually named kitchen_stations_device_type_check
ALTER TABLE public.kitchen_stations DROP CONSTRAINT IF EXISTS kitchen_stations_device_type_check;

-- 2. Add the correct constraint
ALTER TABLE public.kitchen_stations 
ADD CONSTRAINT kitchen_stations_device_type_check 
CHECK (device_type IN ('KDS', 'PRINTER', 'BOTH', 'NONE'));

COMMIT;

-- Verify
SELECT 'Constraint updated successfully' as result;
