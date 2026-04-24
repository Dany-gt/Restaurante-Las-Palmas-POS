-- ==============================================================================
-- CORRECCIÓN Y COMPLEMENTACIÓN DE TRIGGERS PARA KARDEX UNIFICADO
-- Restaurante Las Palmas POS
-- Objetivo: Asegurar que ventas, compras y anulaciones registren en el Kardex
-- usando la nueva tabla 'product_branch_inventory' y la tabla 'products'.
-- ==============================================================================

BEGIN;

-- 1. FUNCIÓN DE CONSUMO DE INVENTARIO (VENTAS)
CREATE OR REPLACE FUNCTION public.consume_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_order_item RECORD;
    v_recipe RECORD;
    v_target_product_id UUID;
    v_consume_qty NUMERIC;
    v_unit_cost NUMERIC;
    v_balance NUMERIC;
    v_prod_name TEXT;
    v_has_recipe BOOLEAN;
BEGIN
    -- Se activa cuando la orden pasa a 'completed'
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'completed')) THEN
        
        -- Recorrer ítems de la orden
        FOR v_order_item IN SELECT * FROM public.order_items WHERE order_id = NEW.id LOOP
            
            -- Obtener info del producto
            SELECT name, inventory_item_id INTO v_prod_name, v_target_product_id 
            FROM public.products WHERE id = v_order_item.product_id;
            
            -- Verificar si tiene receta
            SELECT EXISTS (SELECT 1 FROM public.product_recipes WHERE product_id = v_order_item.product_id) INTO v_has_recipe;

            -- CASO A: EXPLOSIÓN DE RECETA (Insumos múltiples)
            IF v_has_recipe THEN
                FOR v_recipe IN SELECT * FROM public.product_recipes WHERE product_id = v_order_item.product_id LOOP
                    v_consume_qty := v_recipe.quantity * v_order_item.quantity;
                    
                    -- Actualizar Existencia en Sucursal (Nueva Tabla)
                    UPDATE public.product_branch_inventory 
                    SET quantity = quantity - v_consume_qty
                    WHERE product_id = v_recipe.inventory_item_id AND branch_id = NEW.branch_id
                    RETURNING quantity INTO v_balance;

                    -- Obtener Costo y Actualizar Existencia Global (En Products)
                    UPDATE public.products 
                    SET stock_actual = stock_actual - v_consume_qty 
                    WHERE id = v_recipe.inventory_item_id
                    RETURNING cost_price INTO v_unit_cost;

                    -- Registro en Kardex
                    INSERT INTO public.inventory_kardex (
                        branch_id, item_id, movement_type, reference, user_name, device, 
                        quantity_in, quantity_out, balance, unit_cost, balance_value, notes
                    ) VALUES (
                        NEW.branch_id, v_recipe.inventory_item_id, 'VENTA', 
                        'ORDEN #' || COALESCE(NEW.order_number::text, NEW.id::text), 
                        'Sistema', 'POS_TRIGGER', 
                        0, v_consume_qty, COALESCE(v_balance, 0), COALESCE(v_unit_cost, 0), 
                        COALESCE(v_balance, 0) * COALESCE(v_unit_cost, 0), 
                        'Consumo receta por venta de ' || v_order_item.quantity || ' ' || v_prod_name
                    );
                END LOOP;

            -- CASO B: CONSUMO DIRECTO (1:1)
            ELSIF v_target_product_id IS NOT NULL THEN
                v_consume_qty := v_order_item.quantity;

                UPDATE public.product_branch_inventory 
                SET quantity = quantity - v_consume_qty
                WHERE product_id = v_target_product_id AND branch_id = NEW.branch_id
                RETURNING quantity INTO v_balance;

                UPDATE public.products 
                SET stock_actual = stock_actual - v_consume_qty 
                WHERE id = v_target_product_id
                RETURNING cost_price INTO v_unit_cost;

                INSERT INTO public.inventory_kardex (
                    branch_id, item_id, movement_type, reference, user_name, device, 
                    quantity_in, quantity_out, balance, unit_cost, balance_value, notes
                ) VALUES (
                    NEW.branch_id, v_target_product_id, 'VENTA DIRECTA', 
                    'ORDEN #' || COALESCE(NEW.order_number::text, NEW.id::text), 
                    'Sistema', 'POS_TRIGGER', 
                    0, v_consume_qty, COALESCE(v_balance, 0), COALESCE(v_unit_cost, 0), 
                    COALESCE(v_balance, 0) * COALESCE(v_unit_cost, 0), 
                    'Venta de ' || v_prod_name
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FUNCIÓN PARA ANULACIÓN DE COMPRAS (COMPLEMENTADA)
CREATE OR REPLACE FUNCTION public.rpc_annul_purchase(p_purchase_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_purchase RECORD;
    v_item RECORD;
    v_revert_qty NUMERIC;
    v_balance NUMERIC;
    v_user_name TEXT;
    v_unit_cost NUMERIC;
BEGIN
    SELECT * INTO v_purchase FROM public.inventory_purchases WHERE id = p_purchase_id FOR UPDATE;
    IF v_purchase.status = 'ANULADO' THEN RETURN; END IF;

    SELECT COALESCE(full_name, name, 'Sistema') INTO v_user_name FROM public.profiles WHERE id = p_user_id;

    FOR v_item IN SELECT * FROM public.inventory_purchase_items WHERE purchase_id = p_purchase_id LOOP
        v_revert_qty := v_item.quantity * COALESCE(v_item.equivalence, 1);
        v_unit_cost := v_item.unit_cost / COALESCE(v_item.equivalence, 1);

        -- Revertir local (product_branch_inventory)
        UPDATE public.product_branch_inventory 
        SET quantity = quantity + v_revert_qty
        WHERE product_id = v_item.inventory_item_id AND branch_id = v_purchase.branch_id
        RETURNING quantity INTO v_balance;

        -- Revertir global (products)
        UPDATE public.products 
        SET stock_actual = stock_actual + v_revert_qty
        WHERE id = v_item.inventory_item_id;

        -- Registrar en Kardex
        INSERT INTO public.inventory_kardex (
            branch_id, item_id, movement_type, reference, user_id, user_name, device, 
            quantity_in, quantity_out, balance, unit_cost, balance_value, notes
        ) VALUES (
            v_purchase.branch_id, v_item.inventory_item_id, 'ANULACION DE COMPRA', 
            'ANULACIÓN DOC: ' || v_purchase.doc_number, p_user_id, v_user_name, 'RPC_SYSTEM', 
            0, v_revert_qty, COALESCE(v_balance, 0), v_unit_cost, 
            COALESCE(v_balance, 0) * v_unit_cost, 
            'Reversión automática por anulación'
        );
    END LOOP;

    UPDATE public.inventory_purchases SET status = 'ANULADO', voided_by = v_user_name WHERE id = p_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
