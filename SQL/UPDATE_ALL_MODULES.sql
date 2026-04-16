-- ==============================================================================
-- RESTAURANTE LAS PALMAS POS - SCRIPT MAESTRO DE ACTUALIZACIÓN (VERSIÓN FINAL)
-- Este script actualiza todos los módulos: DESPACHO, CUENTAS POR COBRAR y ESTADOS
-- Fecha: 29/01/2026
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. ACTUALIZACIONES PARA MÓDULO DE DESPACHO (DELIVERY / PARA LLEVAR)
-- Asegurar que la tabla 'orders' tenga las columnas necesarias para el nuevo diseño.
-- ==============================================================================

-- Agregar tipo de orden si no existe (TAKEOUT, DELIVERY, DINE_IN)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'DINE_IN';

-- Agregar campos de cliente para Delivery/Takout (si no están vinculados a customer_id)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Agregar dirección para Delivery
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Crear índices para búsquedas rápidas en el módulo de despacho
CREATE INDEX IF NOT EXISTS idx_orders_dispatch_type ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);

-- ==============================================================================
-- 2. ACTUALIZACIÓN DE ESTADOS (PERMITIR ANULACIONES)
-- ==============================================================================

-- Si existe una restricción (constraint) sobre el estado, la eliminamos y recreamos
-- para asegurar que 'cancelled' sea un estado válido.
DO $$ 
BEGIN
    -- Intentar eliminar constraint de check si existe (el nombre puede variar, se intenta uno común)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
    END IF;
    
    -- Agregar la constraint actualizada permitiendo 'cancelled'
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo actualizar la constraint orders_status_check, verifique manualmente si es necesario.';
END $$;


-- ==============================================================================
-- 3. SISTEMA COMPLETO DE CUENTAS POR COBRAR (CRÉDITOS)
-- Incluye Vistas, Funciones, Triggers y Correcciones de compatibilidad
-- ==============================================================================

-- 3.1. Asegurar columna created_by en credit_transactions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.credit_transactions 
        ADD COLUMN created_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- 3.2. Vista Principal (Resumen de Deudores)
CREATE OR REPLACE VIEW public.receivables_summary AS
SELECT 
    c.id,
    c.name as customer_name,
    c.nit as client_nit,
    c.phone as telephone,
    c.credit_limit as limite_credito,
    c.authorized_discount as descuento,
    c.current_balance as saldo,
    c.email,
    c.address,
    c.created_at as fecha_registro,
    -- Información adicional de transacciones
    COUNT(DISTINCT ct.id) FILTER (WHERE ct.type = 'CHARGE') as total_cargos,
    COUNT(DISTINCT ct.id) FILTER (WHERE ct.type = 'PAYMENT') as total_pagos,
    COALESCE(SUM(ct.amount) FILTER (WHERE ct.type = 'CHARGE'), 0) as total_vendido,
    COALESCE(SUM(ct.amount) FILTER (WHERE ct.type = 'PAYMENT'), 0) as total_abonado,
    MAX(ct.created_at) FILTER (WHERE ct.type = 'PAYMENT') as ultimo_pago,
    MAX(ct.created_at) FILTER (WHERE ct.type = 'CHARGE') as ultimo_cargo
FROM 
    public.customers c
LEFT JOIN 
    public.credit_transactions ct ON c.id = ct.customer_id
WHERE 
    c.credit_limit > 0  -- Solo mostrar clientes con crédito autorizado
GROUP BY 
    c.id, c.name, c.nit, c.phone, c.credit_limit, 
    c.authorized_discount, c.current_balance, c.email, 
    c.address, c.created_at
ORDER BY 
    c.current_balance DESC, c.name ASC;

-- 3.3. Vista Detallada (Historial)
CREATE OR REPLACE VIEW public.receivables_transactions_detail AS
SELECT 
    ct.id as transaction_id,
    ct.customer_id,
    c.name as customer_name,
    c.nit as client_nit,
    c.phone as telephone,
    ct.order_id,
    ct.type as transaction_type,
    ct.amount as monto,
    ct.description as descripcion,
    ct.created_at as fecha_transaccion,
    p.name as created_by_user,
    -- Información de la orden si existe
    o.total as order_total,
    o.status as order_status,
    o.payment_method
FROM 
    public.credit_transactions ct
INNER JOIN 
    public.customers c ON ct.customer_id = c.id
LEFT JOIN 
    public.orders o ON ct.order_id = o.id
LEFT JOIN 
    public.profiles p ON ct.created_by = p.id
ORDER BY 
    ct.created_at DESC;

-- 3.4. Función para Registro Automático de Ventas al Crédito
CREATE OR REPLACE FUNCTION public.register_credit_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si la orden fue pagada al crédito y tiene customer_id
    IF NEW.payment_method = 'AL CRÉDITO' AND NEW.customer_id IS NOT NULL THEN
        
        -- 1. Actualizar el saldo del cliente
        UPDATE public.customers
        SET current_balance = COALESCE(current_balance, 0) + NEW.total
        WHERE id = NEW.customer_id;
        
        -- 2. Registrar la transacción de cargo
        INSERT INTO public.credit_transactions (
            customer_id,
            order_id,
            type,
            amount,
            description,
            created_by
        ) VALUES (
            NEW.customer_id,
            NEW.id,
            'CHARGE',
            NEW.total,
            'Venta al crédito - Total: Q' || NEW.total::TEXT,
            NEW.waiter_id
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.5. Trigger en Tabla Orders
DROP TRIGGER IF EXISTS trigger_register_credit_sale ON public.orders;
CREATE TRIGGER trigger_register_credit_sale
    AFTER INSERT OR UPDATE OF status, payment_method ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND NEW.payment_method = 'AL CRÉDITO')
    EXECUTE FUNCTION public.register_credit_sale();

-- 3.6. Función para Registrar Abonos (Pagos)
CREATE OR REPLACE FUNCTION public.register_credit_payment(
    p_customer_id UUID,
    p_amount DECIMAL(10,2),
    p_payment_method TEXT,
    p_description TEXT,
    p_created_by UUID
)
RETURNS JSON AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
    v_transaction_id UUID;
BEGIN
    -- Obtener saldo actual
    SELECT current_balance INTO v_current_balance
    FROM public.customers
    WHERE id = p_customer_id;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cliente no encontrado'
        );
    END IF;
    
    -- Calcular nuevo saldo
    v_new_balance := v_current_balance - p_amount;
    
    IF v_new_balance < 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'El abono excede el saldo pendiente'
        );
    END IF;
    
    -- Actualizar saldo del cliente
    UPDATE public.customers
    SET current_balance = v_new_balance
    WHERE id = p_customer_id;
    
    -- Registrar transacción de pago
    INSERT INTO public.credit_transactions (
        customer_id,
        type,
        amount,
        description,
        created_by
    ) VALUES (
        p_customer_id,
        'PAYMENT',
        p_amount,
        COALESCE(p_description, 'Abono - ' || p_payment_method),
        p_created_by
    ) RETURNING id INTO v_transaction_id;
    
    RETURN json_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'previous_balance', v_current_balance,
        'payment_amount', p_amount,
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql;

-- 3.7. Insertar Datos de Ejemplo (Seguro contra duplicados)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE name = 'HOTEL LAS PALMAS') THEN
        INSERT INTO public.customers (name, nit, phone, email, address, credit_limit, authorized_discount, current_balance)
        VALUES ('HOTEL LAS PALMAS', '12345678-9', '5555-1234', 'hotelpalmas@example.com', 'Zona 10, Ciudad', 50000.00, 5.00, 0.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE name = 'MUNICIPALIDAD GUATEMALTECA') THEN
        INSERT INTO public.customers (name, nit, phone, email, address, credit_limit, authorized_discount, current_balance)
        VALUES ('MUNICIPALIDAD GUATEMALTECA', '987654321-0', '5555-5678', 'municipalidad@example.com', 'Centro Cívico', 100000.00, 10.00, 0.00);
    END IF;
END $$;

COMMIT;

SELECT '✅ OPERACIÓN COMPLETADA: Sistema de Despacho, Anulaciones y Créditos actualizado exitosamente.' as status;
