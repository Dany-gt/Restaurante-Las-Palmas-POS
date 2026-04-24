-- Function to start all items for a specific station in an order
CREATE OR REPLACE FUNCTION start_station_items(
  p_order_id bigint, 
  p_station_id text
) RETURNS void AS $$
BEGIN
  -- Actualizar solo los items que pertenecen a la estación solicitada
  -- Hacemos un JOIN implícito con products para verificar la estación
  UPDATE order_items
  SET 
    status = 'preparing', -- Changed from 'en_preparacion' to match 'preparing' used in KitchenView.tsx types
    preparing_at = now()
  FROM products
  WHERE 
    order_items.product_id = products.id
    AND order_items.order_id = p_order_id
    AND products.kitchen_station_id = p_station_id
    AND order_items.status = 'pending';
END;
$$ LANGUAGE plpgsql;
