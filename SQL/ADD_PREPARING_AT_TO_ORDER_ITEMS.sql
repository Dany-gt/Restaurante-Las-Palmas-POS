-- Add preparing_at column to track when production starts
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP WITH TIME ZONE;

-- Add a hint to the user to run this in Supabase
COMMENT ON COLUMN order_items.preparing_at IS 'Fecha y hora en que se inició la preparación del item';
