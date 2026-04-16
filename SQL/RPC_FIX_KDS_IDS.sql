-- FIX: Re-create RPC functions with correct UUID type for order_id
-- We DROP first to avoid conflicts like "cannot change name of input parameter"

-- 1. start_station_items
DROP FUNCTION IF EXISTS start_station_items(bigint, text);
DROP FUNCTION IF EXISTS start_station_items(uuid, text);

CREATE OR REPLACE FUNCTION start_station_items(
    p_order_id uuid,  -- Using correct UUID type
    p_station_id text
) RETURNS void AS $$
BEGIN
    UPDATE order_items
    SET 
        status = 'preparing', 
        preparing_at = now()
    FROM products
    WHERE 
        order_items.product_id = products.id
        AND order_items.order_id = p_order_id
        AND products.kitchen_station_id = p_station_id
        AND order_items.status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- 2. complete_station_items
DROP FUNCTION IF EXISTS complete_station_items(bigint, text);
DROP FUNCTION IF EXISTS complete_station_items(uuid, text);

CREATE OR REPLACE FUNCTION complete_station_items(
    p_order_id uuid, -- Using correct UUID type
    p_station_id text
) RETURNS void AS $$
BEGIN
    UPDATE order_items
    SET status = 'delivered'
    FROM products
    WHERE 
        order_items.product_id = products.id
        AND order_items.order_id = p_order_id
        AND products.kitchen_station_id = p_station_id
        AND order_items.status = 'ready';
END;
$$ LANGUAGE plpgsql;
