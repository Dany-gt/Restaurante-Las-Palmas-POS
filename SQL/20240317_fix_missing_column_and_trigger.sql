-- 1. AGREGAR COLUMNA FALTANTE A PRODUCTS (Para vínculo directo 1:1)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id);

COMMENT ON COLUMN public.products.inventory_item_id IS 'Vínculo directo opcional con un ítem de inventario (para bebidas o productos que no requieren receta compleja)';

-- 2. RE-APLICAR TRIGGER CORREGIDO PARA CONSUMO DE INVENTARIO
CREATE OR REPLACE FUNCTION consume_inventory_on_sale()
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
    -- Se activa cuando el status pasa a 'completed'
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'completed')) THEN
        
        FOR v_order_item IN SELECT * FROM order_items WHERE order_id = NEW.id LOOP
            -- Obtener nombre del producto
            SELECT name INTO v_prod_name FROM products WHERE id = v_order_item.product_id;
            
            -- CASO A: EXPLOSIÓN POR RECETAS (product_recipes)
            SELECT EXISTS (SELECT 1 FROM product_recipes WHERE product_id = v_order_item.product_id) INTO v_has_recipe;

            IF v_has_recipe THEN
                FOR v_recipe IN SELECT * FROM product_recipes WHERE product_id = v_order_item.product_id LOOP
                    v_consume_qty := v_recipe.quantity * v_order_item.quantity;
                    
                    -- Descontar sucursal
                    UPDATE inventory_item_branches SET quantity = quantity - v_consume_qty
                    WHERE item_id = v_recipe.inventory_item_id AND branch_id = NEW.branch_id
                    RETURNING quantity INTO v_balance;

                    -- Descontar global
                    UPDATE inventory_items SET quantity = quantity - v_consume_qty WHERE id = v_recipe.inventory_item_id
                    RETURNING cost INTO v_unit_cost;

                    -- Kardex
                    INSERT INTO inventory_kardex (branch_id, item_id, movement_type, reference, user_id, user_name, device, quantity_in, quantity_out, balance, unit_cost, balance_value, notes)
                    VALUES (NEW.branch_id, v_recipe.inventory_item_id, 'SALIDA POR VENTA', 'ORDEN #' || COALESCE(NEW.order_number::text, NEW.id::text), NEW.waiter_id, 'Sistema', 'POS_TRIGGER', 0, v_consume_qty, COALESCE(v_balance, 0), COALESCE(v_unit_cost, 0), COALESCE(v_balance, 0) * COALESCE(v_unit_cost, 0), 'Consumo receta por venta de ' || v_order_item.quantity || ' ' || v_prod_name);
                END LOOP;
            
            -- CASO B: VÍNCULO DIRECTO (Si no hay receta, usamos la columna inventory_item_id de products)
            ELSE
                SELECT inventory_item_id INTO v_inventory_item_id FROM products WHERE id = v_order_item.product_id;
                
                IF v_inventory_item_id IS NOT NULL THEN
                    v_consume_qty := v_order_item.quantity; -- Proporción 1:1
                    
                    UPDATE inventory_item_branches SET quantity = quantity - v_consume_qty
                    WHERE item_id = v_inventory_item_id AND branch_id = NEW.branch_id
                    RETURNING quantity INTO v_balance;

                    UPDATE inventory_items SET quantity = quantity - v_consume_qty WHERE id = v_inventory_item_id
                    RETURNING cost INTO v_unit_cost;

                    INSERT INTO inventory_kardex (branch_id, item_id, movement_type, reference, user_id, user_name, device, quantity_in, quantity_out, balance, unit_cost, balance_value, notes)
                    VALUES (NEW.branch_id, v_inventory_item_id, 'SALIDA POR VENTA', 'ORDEN #' || COALESCE(NEW.order_number::text, NEW.id::text), NEW.waiter_id, 'Sistema', 'POS_TRIGGER', 0, v_consume_qty, COALESCE(v_balance, 0), COALESCE(v_unit_cost, 0), COALESCE(v_balance, 0) * COALESCE(v_unit_cost, 0), 'Venta directa de ' || v_prod_name);
                END IF;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reiniciar trigger
DROP TRIGGER IF EXISTS trg_consume_inventory_on_sale ON public.orders;
CREATE TRIGGER trg_consume_inventory_on_sale
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION consume_inventory_on_sale();
