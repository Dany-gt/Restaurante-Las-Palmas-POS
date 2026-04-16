-- ==============================================================================
-- SCRIPT: ACTUALIZAR NÚMEROS DE ORDEN EXISTENTES Y CONFIGURAR SECUENCIA
-- ==============================================================================

-- 1. Asegurar que existe la tabla de secuencias
CREATE TABLE IF NOT EXISTS public.system_sequences (
    seq_name TEXT PRIMARY KEY,
    current_value BIGINT DEFAULT 0
);

-- 2. Asegurar que la columna existe en la tabla orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number BIGINT;

-- 3. ASIGNAR NÚMEROS A ÓRDENES ANTIGUAS (Backfill)
-- Esto ordenará las órdenes por fecha y les asignará números correlativos comenzando virtualmente
-- Si quieres resetear todo y empezar de 100 con lo existente, este bloque lo hace.

DO $$
DECLARE
    r RECORD;
    counter BIGINT := 0; -- Iniciar contador, cambiar a 99 si quisieras que la primera vieja sea la 100
BEGIN
    -- Recorrer órdenes que NO tienen número, ordenadas por fecha
    FOR r IN SELECT id FROM public.orders WHERE order_number IS NULL ORDER BY created_at ASC LOOP
        counter := counter + 1;
        UPDATE public.orders SET order_number = counter WHERE id = r.id;
    END LOOP;
END $$;

-- 4. ACTUALIZAR EL VALOR DE LA SECUENCIA PARA NUEVAS ÓRDENES
-- Ponemos la secuencia en el valor Máximo actual, o en 99 si no hay órdenes, para que la siguiente sea +1
DO $$
DECLARE
    max_val BIGINT;
BEGIN
    SELECT COALESCE(MAX(order_number), 99) INTO max_val FROM public.orders;
    
    -- Si el máximo es menor a 99 (ej. rellenamos 5 órdenes: 1,2,3,4,5), forzamos a 99 para que la nueva sea 100
    IF max_val < 99 THEN
        max_val := 99;
    END IF;

    -- Actualizar tabla de secuencias
    INSERT INTO public.system_sequences (seq_name, current_value)
    VALUES ('order_number', max_val)
    ON CONFLICT (seq_name) 
    DO UPDATE SET current_value = EXCLUDED.current_value;
END $$;

-- 5. VERIFICAR QUE EL TRIGGER ESTÉ CREADO (Para futuras órdenes)
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val BIGINT;
BEGIN
    IF NEW.order_number IS NULL THEN
        UPDATE public.system_sequences
        SET current_value = current_value + 1
        WHERE seq_name = 'order_number'
        RETURNING current_value INTO next_val;
        
        NEW.order_number := next_val;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;
CREATE TRIGGER trg_assign_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

-- 6. INDEXAR PARA RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

SELECT 'Órdenes actualizadas correctamente. Secuencia ajustada.' as mensaje;
