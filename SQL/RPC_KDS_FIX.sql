-- Drop previous versions to avoid conflicts
DROP FUNCTION IF EXISTS start_station_items(bigint, uuid);
DROP FUNCTION IF EXISTS complete_station_items(bigint, uuid);

-- Función 1: Empezar a preparar SOLO los items de la estación actual
CREATE OR REPLACE FUNCTION start_station_items(p_order_id bigint, p_station_id uuid)
RETURNS void AS $$
BEGIN
  -- Actualiza items a 'preparing' y pone timestamp SOLO si coincide la estación
  UPDATE order_items
  SET status = 'preparing', preparing_at = now()
  FROM products
  WHERE order_items.product_id = products.id
  AND order_items.order_id = p_order_id
  AND products.kitchen_station_id = p_station_id -- FILTRO CRITICO
  AND order_items.status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Función 2: Entregar/Terminar SOLO los items de la estación actual
CREATE OR REPLACE FUNCTION complete_station_items(p_order_id bigint, p_station_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE order_items
  SET status = 'ready', finished_at = now() -- Asumo finished_at o ready_at, verificar esquema si falla
  FROM products
  WHERE order_items.product_id = products.id
  AND order_items.order_id = p_order_id
  AND products.kitchen_station_id = p_station_id
  AND order_items.status != 'ready' 
  AND order_items.status != 'delivered';
END;
$$ LANGUAGE plpgsql;
