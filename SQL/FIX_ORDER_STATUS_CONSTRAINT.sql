-- Drop the existing constraint (name might vary, trying standard naming convention)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the updated constraint including 'delivering'
ALTER TABLE orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled', 'delivering'));
