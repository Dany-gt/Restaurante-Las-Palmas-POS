-- ==============================================================================
-- ACTUALIZACIÓN: INICIALIZAR NÚMERO DE ORDEN DESDE 100
-- ==============================================================================

-- 1. Asegurar que la tabla de secuencias existe (por si no se corrió el anterior)
CREATE TABLE IF NOT EXISTS public.system_sequences (
    seq_name TEXT PRIMARY KEY,
    current_value BIGINT DEFAULT 0
);

-- 2. Establecer el valor inicial en 99
-- De esta forma, la PRIMERA orden que se genere será la 100 (99 + 1).
-- Si ya existen órdenes y el contador va más avanzado (ej: 105), NO lo bajará.
INSERT INTO public.system_sequences (seq_name, current_value)
VALUES ('order_number', 99)
ON CONFLICT (seq_name) 
DO UPDATE SET current_value = 99
WHERE public.system_sequences.current_value < 99;

-- 3. Verificación (Opcional)
SELECT * FROM public.system_sequences WHERE seq_name = 'order_number';

-- ==============================================================================
-- El trigger 'trg_assign_order_number' creado anteriormente se encargará
-- de sumar +1 automáticamente a partir de este valor (100, 101, 102...)
-- ==============================================================================
