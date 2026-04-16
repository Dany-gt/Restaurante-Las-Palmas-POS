-- RPC PARA ENTREGAR (Marcar como 'delivered' y detener PREPARACIÓN si no se ha detenido)
CREATE OR REPLACE FUNCTION deliver_station_batch_v2(p_order_id bigint, p_station_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE order_items ui
    SET status = 'delivered',
        ready_at = COALESCE(ui.ready_at, now())
    FROM products p
    WHERE ui.product_id = p.id
      AND ui.order_id = p_order_id
      AND p.kitchen_station_id = p_station_id
      AND ui.status != 'delivered';
END;
$$ LANGUAGE plpgsql;
