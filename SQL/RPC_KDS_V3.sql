-- FIX: Rename functions to _v3 to avoid "Ambiguous Function" (PGRST203) errors entirely.
-- AND FIX: Change p_station_id from text to uuid to match DB column type (Fixes operator does not exist: uuid = text)

-- 1. start_station_items_v3
-- Drop old _v3 variant (which was (uuid, text))
DROP FUNCTION IF EXISTS start_station_items_v3(uuid, text);

CREATE OR REPLACE FUNCTION start_station_items_v3(
    p_order_id uuid,
    p_station_id uuid -- Changed from text to uuid
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

-- 2. complete_station_items_v3
-- Drop old _v3 variant (which was (uuid, text))
DROP FUNCTION IF EXISTS complete_station_items_v3(uuid, text);

CREATE OR REPLACE FUNCTION complete_station_items_v3(
    p_order_id uuid,
    p_station_id uuid -- Changed from text to uuid
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

-- 3. PERMISSIONS (CRITICAL)
-- Note: Permission syntax requires correct types in signature
GRANT EXECUTE ON FUNCTION start_station_items_v3(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION start_station_items_v3(uuid, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION complete_station_items_v3(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_station_items_v3(uuid, uuid) TO service_role;
