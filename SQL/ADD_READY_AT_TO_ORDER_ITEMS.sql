-- Add ready_at column to track when production finishes
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE;

-- Add a hint to the user to run this in Supabase
COMMENT ON COLUMN order_items.ready_at IS 'Fecha y hora en que se terminó de preparar el item';
