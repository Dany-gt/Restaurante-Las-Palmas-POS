-- Migration to add soft locking to tables
-- This allows a waiter to "own" a table from the moment they enter, 
-- even before an order is officially created in the DB.

ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance on lock checks
CREATE INDEX IF NOT EXISTS idx_tables_locked_by ON public.tables(locked_by);

-- Refresh schema cache (implicit in many tools, but good to note)
COMMENT ON COLUMN public.tables.locked_by IS 'Profile ID of the waiter currently viewing/editing this table (soft lock)';
COMMENT ON COLUMN public.tables.locked_at IS 'Timestamp when the soft lock was acquired';
