-- Add columns for Hybrid Printing System
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS requires_printing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS print_status TEXT DEFAULT 'pending'; -- 'pending', 'printed', 'failed'

-- Create index for faster polling
CREATE INDEX IF NOT EXISTS idx_orders_requires_printing ON orders(requires_printing) WHERE requires_printing = TRUE;
