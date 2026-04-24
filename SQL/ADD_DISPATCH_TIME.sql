-- Agregamos la columna para registrar la hora de salida del repartidor
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE;

-- Opcional: Si usamos un Check Constraint para status, habría que actualizarlo
-- pero por lo general en este proyecto es TEXT libre o manejado en app.
-- Si existiera restricción:
-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
-- ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
-- CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled', 'delivering'));
