-- ==============================================================================
-- CONSOLIDACIÓN DE TRIGGER DE INVENTARIO (RECETAS + VÍNCULO DIRECTO)
-- Fecha: 17/03/2026
-- Objetivo: Evitar duplicidad y permitir consumo de productos sin receta (Cervezas)
-- ==============================================================================

BEGIN;

-- 1. LIMPIEZA TOTAL DE TRIGGERS PREVIOS (Para evitar duplicidad)
DROP TRIGGER IF EXISTS trg_consume_inventory_on_sale ON public.orders;
DROP TRIGGER IF EXISTS trg_inventory_consumption ON public.orders;

-- 2. FUNCIÓN DE CONSUMO UNIFICADA
CREATE OR REPLACE FUNCTION public.consume_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_order_item RECORD;
    v_recipe RECORD;
    v_inventory_item_id UUID;
    v_consume_qty NUMERIC;
    v_unit_cost NUMERIC;
    v_balance NUMERIC;
    v_prod_name TEXT;
    v_has_recipe BOOLEAN;
BEGIN
    -- Se activa SOLO cuando la orden pasa a 'completed'
    -- Y nos aseguramos de que sea la primera vez que pasa a este estado en este movimiento
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'completed')) THEN
        
        -- Iterar sobre cada ítem de la orden
        FOR v_order_item IN SELECT * FROM order_items WHERE order_id = NEW.id LOOP
            
            -- Obtener info del producto
            SELECT name, inventory_item_id INTO v_prod_name, v_inventory_item_id 
            FROM products WHERE id = v_order_item.product_id;
            
            -- Verificar si tiene receta
            SELECT EXISTS (SELECT 1 FROM product_recipes WHERE product_id = v_order_item.product_id) INTO v_has_recipe;

            -- CASO A: SI TIENE RECETA (Explosión de insumos)
            IF v_has_recipe THEN
                FOR v_recipe IN SELECT * FROM product_recipes WHERE product_id = v_order_item.product_id LOOP
                    v_consume_qty := v_recipe.quantity * v_order_item.quantity;
                    
                    -- Actualizar Existencia en Sucursal
                    UPDATE inventory_item_branches 
                    SET quantity = quantity - v_consume_qty
                    WHERE item_id = v_recipe.inventory_item_id AND branch_id = NEW.branch_id
                    RETURNING quantity INTO v_balance;

                    -- Actualizar Existencia Global y obtener costo
                    UPDATE inventory_items 
                    SET quantity = quantity - v_consume_qty 
                    WHERE id = v_recipe.inventory_item_id
                    RETURNING cost INTO v_unit_cost;

                    -- Registrar en Kardex
                    INSERT INTO inventory_kardex (
                        branch_id, item_id, movement_type, reference, user_id, user_name, device, 
                        quantity_in, quantity_out, balance, unit_cost, balance_value, notes
                    ) VALUES (
                        NEW.branch_id, v_recipe.inventory_item_id, 'VENTA', 
                        'ORDEN #' || COALESCE(NEW.order_number::text, NEW.id::text), 
                        NEW.waiter_id, 'Sistema', 'POS_TRIGGER', 
                        0, v_consume_qty, COALESCE(v_balance, 0), COALESCE(v_unit_cost, 0), 
                        COALESCE(v_balance, 0) * COALESCE(v_unit_cost, 0), 
                        'Consumo receta por venta de ' || v_order_item.quantity || ' ' || v_prod_name
                    );
                END LOOP;

            -- CASO B: VÍNCULO DIRECTO (Para cervezas, gaseosas, etc. que no llevan receta)
            -- Se usa la columna inventory_item_id de la tabla de productos
            ELSIF v_inventory_item_id IS NOT NULL THEN
                v_consume_qty := v_order_item.quantity; -- Proporción 1:1

                -- Actualizar Existencia en Sucursal
                UPDATE inventory_item_branches 
                SET quantity = quantity - v_consume_qty
                WHERE item_id = v_inventory_item_id AND branch_id = NEW.branch_id
                RETURNING quantity INTO v_balance;

                -- Actualizar Existencia Global
                UPDATE inventory_items 
                SET quantity = quantity - v_consume_qty 
                WHERE id = v_inventory_item_id
                RETURNING cost INTO v_unit_cost;

                -- Registrar en Kardex
                INSERT INTO inventory_kardex (
                    branch_id, item_id, movement_type, reference, user_id, user_name, device, 
                    quantity_in, quantity_out, balance, unit_cost, balance_value, notes
                ) VALUES (
                    NEW.branch_id, v_inventory_item_id, 'VENTA', 
                    'ORDEN #' || COALESCE(NEW.order_number::text, NEW.id::text), 
                    NEW.waiter_id, 'Sistema', 'POS_TRIGGER', 
                    0, v_consume_qty, COALESCE(v_balance, 0), COALESCE(v_unit_cost, 0), 
                    COALESCE(v_balance, 0) * COALESCE(v_unit_cost, 0), 
                    'Venta directa de ' || v_prod_name
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-CREACIÓN DEL TRIGGER ÚNICO
CREATE TRIGGER trg_consume_inventory_on_sale
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION consume_inventory_on_sale();

COMMIT;

SELECT 'CORRECCIÓN APLICADA: Trigger unificado con soporte para recetas y productos directos habilitado.' as status;
