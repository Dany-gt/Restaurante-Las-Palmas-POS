-- FORCE CACHE RELOAD
NOTIFY pgrst, 'reload schema';

-- 1. EMPEZAR PREPARACIÓN (FIXED UUID)
DROP FUNCTION IF EXISTS start_station_batch_v3(bigint, uuid); 
DROP FUNCTION IF EXISTS start_station_batch_v3(uuid, uuid);
DROP FUNCTION IF EXISTS start_station_batch_v3(uuid, uuid, uuid); 

CREATE OR REPLACE FUNCTION start_station_batch_v3(p_order_id uuid, p_station_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE order_items ui
    SET status = 'preparing',
        preparing_at = COALESCE(ui.preparing_at, now()),
        preparing_by = p_user_id
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND ui.status = 'pending'
      AND (
          p_station_id IS NULL 
          OR p.kitchen_station_id = p_station_id 
          OR p.kitchen_station_id IS NULL 
      );
END;
$$ LANGUAGE plpgsql;

-- 2. TERMINAR PREPARACIÓN / LISTO (FIXED UUID)
DROP FUNCTION IF EXISTS complete_station_batch_v3(bigint, uuid);
DROP FUNCTION IF EXISTS complete_station_batch_v3(uuid, uuid);
DROP FUNCTION IF EXISTS complete_station_batch_v3(uuid, uuid, uuid); 

CREATE OR REPLACE FUNCTION complete_station_batch_v3(p_order_id uuid, p_station_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE order_items ui
    SET status = 'ready',
        ready_at = COALESCE(ui.ready_at, now()),
        ready_by = p_user_id
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND ui.status IN ('pending', 'preparing')
      AND (
          p_station_id IS NULL 
          OR p.kitchen_station_id = p_station_id 
          OR p.kitchen_station_id IS NULL 
      );
END;
$$ LANGUAGE plpgsql;

-- 3. ENTREGAR / ARCHIVAR (FIXED UUID)
DROP FUNCTION IF EXISTS deliver_station_batch_v3(bigint, uuid);
DROP FUNCTION IF EXISTS deliver_station_batch_v3(uuid, uuid);
DROP FUNCTION IF EXISTS deliver_station_batch_v3(uuid, uuid, uuid); 

CREATE OR REPLACE FUNCTION deliver_station_batch_v3(p_order_id uuid, p_station_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS void AS $$
BEGIN
    UPDATE order_items ui
    SET status = 'delivered',
        ready_at = COALESCE(ui.ready_at, now()),
        delivered_by = p_user_id
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND ui.status != 'delivered'
      AND (
          p_station_id IS NULL 
          OR p.kitchen_station_id = p_station_id 
          OR p.kitchen_station_id IS NULL 
      );
END;
$$ LANGUAGE plpgsql;

-- FORCE CACHE RELOAD AGAIN
NOTIFY pgrst, 'reload schema';
