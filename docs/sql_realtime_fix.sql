-- =============================================================
-- LAS PALMAS POS — SQL REALTIME & PERFORMANCE FIX
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- ---------------------------------------------------------------
-- 1. HABILITAR REALTIME EN LAS TABLAS CLAVE
--    Supabase Realtime requiere que las tablas estén en la
--    publicación "supabase_realtime". Sin esto, los cambios de
--    order_id (traslados) NO llegan al cliente.
-- ---------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- ---------------------------------------------------------------
-- 2. HABILITAR REPLICA IDENTITY FULL EN order_items
--    Por defecto, Postgres solo envía la nueva fila (NEW) en
--    los eventos UPDATE, pero NO la fila anterior (OLD).
--    Con FULL, Supabase Realtime envía tanto OLD como NEW,
--    lo que permite detectar traslados (cambio de order_id).
-- ---------------------------------------------------------------
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE orders      REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------
-- 3. ÍNDICES DE RENDIMIENTO PARA CONSULTAS DE MESA
--    Cuando se abren cuentas con múltiples órdenes, la app
--    hace: SELECT * FROM order_items WHERE order_id IN (...)
--    Sin índice, Postgres hace un seq-scan. Con índice es O(log n).
-- ---------------------------------------------------------------

-- Índice principal: filtrar items por orden y excluir anulados
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_status
    ON order_items (order_id, status)
    WHERE status <> 'voided';

-- Índice para consultas por mesa (todas las órdenes activas de una mesa)
CREATE INDEX IF NOT EXISTS idx_orders_table_status
    ON orders (table_id, status)
    WHERE status NOT IN ('completed', 'cancelled');

-- Índice para detectar rápido si un order_item fue trasladado
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items (order_id);

-- ---------------------------------------------------------------
-- 4. FUNCIÓN RPC: transfer_order_item
--    Traslada un item de una cuenta a otra de forma atómica.
--    Úsala desde el cliente: supabase.rpc('transfer_order_item', {...})
--    Esto garantiza que no haya estado intermedio donde el item
--    existe en ninguna cuenta (o en las dos).
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_order_item(
    p_item_id     UUID,
    p_from_order  UUID,
    p_to_order    UUID,
    p_quantity    INT DEFAULT NULL  -- NULL = mover todo
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item        order_items%ROWTYPE;
    v_move_qty    INT;
    v_result      JSONB;
BEGIN
    -- Bloquear el item para evitar race conditions
    SELECT * INTO v_item
    FROM order_items
    WHERE id = p_item_id AND order_id = p_from_order
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Item no encontrado en la cuenta origen');
    END IF;

    v_move_qty := COALESCE(p_quantity, v_item.quantity);

    IF v_move_qty <= 0 OR v_move_qty > v_item.quantity THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Cantidad inválida');
    END IF;

    IF v_move_qty = v_item.quantity THEN
        -- Mover el item completo: solo cambiamos order_id
        UPDATE order_items
        SET order_id = p_to_order,
            updated_at = NOW()
        WHERE id = p_item_id;

        v_result := jsonb_build_object(
            'ok', true,
            'action', 'moved',
            'item_id', p_item_id,
            'from_order', p_from_order,
            'to_order', p_to_order
        );
    ELSE
        -- Mover solo una parte: reducir cantidad en origen e insertar nuevo en destino
        UPDATE order_items
        SET quantity = quantity - v_move_qty,
            updated_at = NOW()
        WHERE id = p_item_id;

        INSERT INTO order_items (
            order_id, product_id, quantity, unit_price, notes,
            status, is_sent, created_at, discount_percentage, discount_amount
        ) VALUES (
            p_to_order,
            v_item.product_id,
            v_move_qty,
            v_item.unit_price,
            v_item.notes,
            v_item.status,
            v_item.is_sent,
            NOW(),
            v_item.discount_percentage,
            v_item.discount_amount
        )
        RETURNING id INTO v_result;

        v_result := jsonb_build_object(
            'ok', true,
            'action', 'split',
            'original_item_id', p_item_id,
            'new_item_id', v_result,
            'from_order', p_from_order,
            'to_order', p_to_order,
            'moved_qty', v_move_qty
        );
    END IF;

    RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------
-- 5. GRANT de ejecución al rol autenticado de Supabase
-- ---------------------------------------------------------------
GRANT EXECUTE ON FUNCTION transfer_order_item(UUID, UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_order_item(UUID, UUID, UUID, INT) TO service_role;

-- ---------------------------------------------------------------
-- FIN DEL SCRIPT
-- ---------------------------------------------------------------
