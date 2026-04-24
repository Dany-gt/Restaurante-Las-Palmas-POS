-- SQL PARA FORZAR LA LÓGICA DE TIEMPOS EN KDS
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Asegurar que las columnas existen y son correctas
-- ALTER TABLE order_items ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ;
-- ALTER TABLE order_items ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- 2. Función Atómica para EMPEZAR Preparación (Detiene cronómetro de LLEGADA)
CREATE OR REPLACE FUNCTION start_station_batch_v2(p_order_id bigint, p_station_id uuid)
RETURNS void AS $$
DECLARE
    now_server TIMESTAMPTZ := now();
BEGIN
    UPDATE order_items ui
    SET 
        status = 'preparing',
        preparing_at = COALESCE(ui.preparing_at, now_server)
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND p.kitchen_station_id = p_station_id
      AND ui.status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- 3. Función Atómica para TERMINAR Preparación (Detiene cronómetro de PREPARACIÓN)
CREATE OR REPLACE FUNCTION complete_station_batch_v2(p_order_id bigint, p_station_id uuid)
RETURNS void AS $$
DECLARE
    now_server TIMESTAMPTZ := now();
BEGIN
    UPDATE order_items ui
    SET 
        status = 'ready',
        ready_at = COALESCE(ui.ready_at, now_server)
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND p.kitchen_station_id = p_station_id
      AND ui.status IN ('pending', 'preparing');
END;
$$ LANGUAGE plpgsql;

-- 4. Función para RETORNAR un ítem (Limpia tiempos para reiniciar)
CREATE OR REPLACE FUNCTION reset_item_status_v2(p_item_id uuid, p_target_status text)
RETURNS void AS $$
BEGIN
    UPDATE order_items
    SET 
        status = p_target_status,
        ready_at = CASE WHEN p_target_status = 'ready' THEN ready_at ELSE NULL END,
        preparing_at = CASE WHEN p_target_status IN ('preparing', 'ready') THEN preparing_at ELSE NULL END
    WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;
