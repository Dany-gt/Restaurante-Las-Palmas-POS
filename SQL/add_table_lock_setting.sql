-- Add column to lock tables to the original waiter
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS lock_tables_to_waiter BOOLEAN DEFAULT FALSE;

-- Update existing row
UPDATE system_settings SET lock_tables_to_waiter = FALSE WHERE id = 1;
