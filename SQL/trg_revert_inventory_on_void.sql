-- Función de Reversión de Inventario
CREATE OR REPLACE FUNCTION revert_inventory_on_void()
RETURNS TRIGGER AS $$
DECLARE
    v_order_item RECORD;
    v_recipe RECORD;
    v_revert_qty NUMERIC;
    v_unit_cost NUMERIC;
    v_balance NUMERIC;
    v_prod_name TEXT;
BEGIN
    -- Actuar cuando la orden pasa a 'cancelled' o 'void' desde cualquier estado que descuenta inventario
    IF (NEW.status = 'cancelled' OR NEW.status = 'void') AND (OLD.status != 'cancelled' AND OLD.status != 'void') THEN
        
        -- Si la orden estaba en un estado que no descuenta (opcional, dependiendo de cómo trabaje el sistema)
        -- Pero aquí asumimos que si se anuló y hubo movimiento previo, debemos revertir.
        
        -- Recorrer todos los productos de la orden
        FOR v_order_item IN 
            SELECT product_id, quantity 
            FROM order_items 
            WHERE order_id = NEW.id
        LOOP
            -- Recorrer la receta de cada producto
            FOR v_recipe IN 
                SELECT inventory_item_id, quantity 
                FROM product_recipes 
                WHERE product_id = v_order_item.product_id
            LOOP
                -- Cantidad total a devolver
                v_revert_qty := v_recipe.quantity * v_order_item.quantity;
                
                -- Devolver al inventario de la sucursal
                UPDATE inventory_item_branches
                SET quantity = quantity + v_revert_qty
                WHERE item_id = v_recipe.inventory_item_id
                  AND branch_id = NEW.branch_id
                RETURNING quantity INTO v_balance;

                IF v_balance IS NULL THEN
                   v_balance := v_revert_qty;
                END IF;
                  
                -- Devolver al inventario global
                UPDATE inventory_items
                SET quantity = quantity + v_revert_qty
                WHERE id = v_recipe.inventory_item_id
                RETURNING cost INTO v_unit_cost;

                IF v_unit_cost IS NULL THEN
                   v_unit_cost := 0;
                END IF;

                SELECT name INTO v_prod_name FROM products WHERE id = v_order_item.product_id;

                -- Insertar movimiento en Kardex
                INSERT INTO inventory_kardex (
                    branch_id,
                    item_id,
                    movement_type,
                    reference,
                    user_id,
                    user_name,
                    device,
                    quantity_in,
                    quantity_out,
                    balance,
                    unit_cost,
                    balance_value,
                    notes
                ) VALUES (
                    NEW.branch_id,
                    v_recipe.inventory_item_id,
                    'ANULACION',
                    'Anulación Orden #' || COALESCE(NEW.order_number::text, NEW.id::text),
                    NEW.cancelled_by, -- Quien anuló
                    'Admin/Caja',
                    'POS_TRIGGER',
                    v_revert_qty, -- Entrada
                    0,
                    v_balance,
                    v_unit_cost,
                    (v_balance * v_unit_cost),
                    'Reingreso por anulación de ' || v_order_item.quantity || ' ' || COALESCE(v_prod_name, 'Platillo')
                );
            END LOOP;
        END LOOP;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sobre la tabla orders
DROP TRIGGER IF EXISTS trg_revert_inventory_on_void ON public.orders;
CREATE TRIGGER trg_revert_inventory_on_void
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION revert_inventory_on_void();
