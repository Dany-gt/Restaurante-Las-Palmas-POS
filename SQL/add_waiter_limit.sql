-- Add max_active_orders_per_waiter column to system_settings
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS max_active_orders_per_waiter INTEGER DEFAULT 0;

-- Comment on column
COMMENT ON COLUMN system_settings.max_active_orders_per_waiter IS 'Maximum number of active orders a waiter can handle. 0 means unlimited.';
