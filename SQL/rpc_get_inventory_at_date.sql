-- Función para obtener existencias en una fecha específica
-- Basada en el historial de movimientos de Kardex
CREATE OR REPLACE FUNCTION rpc_get_inventory_at_date(p_branch_id UUID, p_target_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (
    item_id UUID,
    quantity NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        k.item_id,
        COALESCE(SUM(k.quantity_in - k.quantity_out), 0) as quantity
    FROM inventory_kardex k
    WHERE k.branch_id = p_branch_id
      AND k.created_at <= p_target_date
    GROUP BY k.item_id;
END;
$$ LANGUAGE plpgsql;
