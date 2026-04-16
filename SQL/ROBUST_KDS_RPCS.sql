-- RPC ROBUSTOS PARA KDS (Soporta filtrado por estación o por orden completa)
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. EMPEZAR PREPARACIÓN
CREATE OR REPLACE FUNCTION start_station_batch_v3(p_order_id bigint, p_station_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE order_items ui
    SET status = 'preparing',
        preparing_at = COALESCE(ui.preparing_at, now())
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND ui.status = 'pending'
      AND (
          p_station_id IS NULL 
          OR p.kitchen_station_id = p_station_id 
          OR ui.kitchen_station_id = p_station_id
      );
END;
$$ LANGUAGE plpgsql;

-- 2. TERMINAR PREPARACIÓN (LISTO)
CREATE OR REPLACE FUNCTION complete_station_batch_v3(p_order_id bigint, p_station_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE order_items ui
    SET status = 'ready',
        ready_at = COALESCE(ui.ready_at, now())
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND ui.status IN ('pending', 'preparing')
      AND (
          p_station_id IS NULL 
          OR p.kitchen_station_id = p_station_id 
          OR ui.kitchen_station_id = p_station_id
      );
END;
$$ LANGUAGE plpgsql;

-- 3. ENTREGAR BATCH
CREATE OR REPLACE FUNCTION deliver_station_batch_v3(p_order_id bigint, p_station_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE order_items ui
    SET status = 'delivered',
        ready_at = COALESCE(ui.ready_at, now())
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND ui.status != 'delivered'
      AND (
          p_station_id IS NULL 
          OR p.kitchen_station_id = p_station_id 
          OR ui.kitchen_station_id = p_station_id
      );
END;
$$ LANGUAGE plpgsql;
