-- Function to start items. Supports specific station or ALL items if station is NULL.
CREATE OR REPLACE FUNCTION start_station_items(
  p_order_id bigint, 
  p_station_id uuid DEFAULT NULL -- Made optional and UUID to match schema
) RETURNS void AS $$
BEGIN
  IF p_station_id IS NOT NULL THEN
    -- Start items for SPECIFIC STATION
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
  ELSE
    -- Start ALL ITEMS in the order (for "Overall View")
    UPDATE order_items
    SET 
      status = 'preparing',
      preparing_at = now()
    WHERE 
      order_items.order_id = p_order_id
      AND order_items.status = 'pending';
  END IF;
END;
$$ LANGUAGE plpgsql;
