-- ============================================
-- REFACTORIZACIÓN DE INVENTARIOS: ATOMICIDAD Y SINCRONIZACIÓN
-- RESTAURANTE LAS PALMAS POS
-- ============================================

-- 1. TRIGGER DE CONSUMO DE INVENTARIO (EXPLOSIÓN DE RECETAS)
-- Se dispara automáticamente al completar una orden (Venta Normal, Contingencia o Crédito)
CREATE OR REPLACE FUNCTION consume_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_order_item RECORD;
    v_recipe RECORD;
    v_consume_qty NUMERIC;
    v_unit_cost NUMERIC;
    v_balance NUMERIC;
    v_prod_name TEXT;
    v_has_recipe BOOLEAN;
BEGIN
    -- Se dispara cuando la orden pasa a 'completed'
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'completed')) THEN
        
        -- 1. Recorrer items de la orden
        FOR v_order_item IN 
            SELECT * FROM order_items WHERE order_id = NEW.id
        LOOP
            -- Obtener nombre del producto para el Kardex
            SELECT name INTO v_prod_name FROM products WHERE id = v_order_item.product_id;
            
            -- Verificar si tiene receta
            SELECT EXISTS (SELECT 1 FROM product_recipes WHERE product_id = v_order_item.product_id) INTO v_has_recipe;

            IF v_has_recipe THEN
                -- A. EXPLOSIÓN DE RECETA (Producto con múltiples insumos)
                FOR v_recipe IN 
                    SELECT * FROM product_recipes WHERE product_id = v_order_item.product_id
                LOOP
                    v_consume_qty := v_recipe.quantity * v_order_item.quantity;
                    
                    -- 1. Restar de existencias por sucursal
                    UPDATE inventory_item_branches
                    SET quantity = quantity - v_consume_qty
                    WHERE item_id = v_recipe.inventory_item_id AND branch_id = NEW.branch_id
                    RETURNING quantity INTO v_balance;

                    -- 2. Restar de existencia global
                    UPDATE inventory_items
                    SET quantity = quantity - v_consume_qty
                    WHERE id = v_recipe.inventory_item_id
                    RETURNING cost INTO v_unit_cost;

                    -- 3. Insertar registro en Kardex (SALIDA POR VENTA)
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
                        'SALIDA POR VENTA',
                        'VENTA ORDEN #' || COALESCE(NEW.order_number::text, NEW.id::text),
                        NEW.waiter_id,
                        'Cajero/Mesero',
                        'POS_SYSTEM',
                        0,
                        v_consume_qty,
                        COALESCE(v_balance, 0),
                        COALESCE(v_unit_cost, 0),
                        COALESCE(v_balance, 0) * COALESCE(v_unit_cost, 0),
                        'Consumo de ' || v_consume_qty || ' por venta de ' || v_order_item.quantity || ' ' || v_prod_name
                    );
                END LOOP;
            ELSE
                -- B. PRODUCTO SIMPLE (Si no tiene receta, se asume que no maneja inventario o es un error de configuración)
                -- Nota: Si se desea habilitar consumo directo 1:1, se requeriría una columna inventory_item_id en products.
                NULL;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Borrar trigger previo si existe
DROP TRIGGER IF EXISTS trg_consume_inventory_on_sale ON public.orders;

-- Crear el trigger para INSERT y UPDATE
CREATE TRIGGER trg_consume_inventory_on_sale
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION consume_inventory_on_sale();


-- 2. RPC PARA ANULACIÓN DE COMPRAS (INTEGRIDAD ATÓMICA)
-- Une en un solo bloque transaccional la reversión de stock global, local y kardex
CREATE OR REPLACE FUNCTION rpc_annul_purchase(p_purchase_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_purchase RECORD;
    v_item RECORD;
    v_revert_qty NUMERIC;
    v_current_stock_branch NUMERIC;
    v_user_name TEXT;
BEGIN
    -- 1. Bloquear registro para evitar condiciones de carrera (Concurrency control)
    SELECT * INTO v_purchase 
    FROM inventory_purchases 
    WHERE id = p_purchase_id 
    FOR UPDATE;

    IF v_purchase IS NULL THEN
        RAISE EXCEPTION 'Compra no encontrada';
    END IF;

    IF v_purchase.status = 'ANULADO' THEN
        RAISE EXCEPTION 'Esta compra ya ha sido anulada';
    END IF;

    -- Obtener nombre del usuario que anula
    SELECT COALESCE(full_name, name, 'Sistema') INTO v_user_name 
    FROM profiles 
    WHERE id = p_user_id;

    -- 2. Revertir inventario para cada ítem de la compra
    FOR v_item IN 
        SELECT * FROM inventory_purchase_items WHERE purchase_id = p_purchase_id
    LOOP
        -- Calcular cantidad total a revertir (Cantidad * Factor de Conversión)
        v_revert_qty := v_item.quantity * COALESCE(v_item.equivalence, 1);

        -- A. Restar de stock en sucursal (Usamos resta porque la anulación quita lo que entró)
        UPDATE inventory_item_branches
        SET quantity = quantity - v_revert_qty
        WHERE item_id = v_item.inventory_item_id 
          AND branch_id = v_purchase.branch_id
        RETURNING quantity INTO v_current_stock_branch;

        -- B. Restar de stock global (Corrección de Bug de Sincronización)
        UPDATE inventory_items
        SET quantity = quantity - v_revert_qty
        WHERE id = v_item.inventory_item_id;

        -- C. Registrar movimiento en Kardex de tipo ANULACION
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
            v_purchase.branch_id,
            v_item.inventory_item_id,
            'ANULACION DE COMPRA',
            'ANULACIÓN DOC: ' || v_purchase.doc_number,
            p_user_id,
            v_user_name,
            'RPC_SYSTEM',
            0,
            v_revert_qty,
            COALESCE(v_current_stock_branch, 0),
            v_item.unit_cost / COALESCE(v_item.equivalence, 1),
            COALESCE(v_current_stock_branch, 0) * (v_item.unit_cost / COALESCE(v_item.equivalence, 1)),
            'Reversión automática de compra anulada'
        );
    END LOOP;

    -- 3. Actualizar estado de la compra
    UPDATE inventory_purchases
    SET status = 'ANULADO',
        voided_by = v_user_name
    WHERE id = p_purchase_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
