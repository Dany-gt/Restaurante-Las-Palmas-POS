-- ==============================================================================
-- RESTAURANTE LAS PALMAS POS - SISTEMA DE CUENTAS POR COBRAR
-- Este script crea la estructura completa para gestionar créditos comerciales
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. VISTA PRINCIPAL DE CUENTAS POR COBRAR
-- Esta vista combina datos de customers con credit_transactions para mostrar
-- todas las columnas necesarias: Nombre, Cliente, Teléfono, Límite, Descuento, Saldo
-- ==============================================================================

-- Primero, agregar columna created_by a credit_transactions si no existe
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

-- ==============================================================================
-- 2. VISTA DETALLADA DE TRANSACCIONES DE CRÉDITO
-- Muestra el historial completo de cargos y abonos por cliente
-- ==============================================================================

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

-- ==============================================================================
-- 3. FUNCIÓN PARA REGISTRAR VENTA AL CRÉDITO (AUTOMÁTICA DESDE CAJA)
-- Esta función se ejecuta automáticamente cuando se hace un cobro al crédito
-- ==============================================================================

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
            NEW.waiter_id  -- Usar waiter_id que sí existe
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 4. TRIGGER PARA REGISTRAR AUTOMÁTICAMENTE VENTAS AL CRÉDITO
-- Se activa cuando una orden se completa con pago al crédito
-- ==============================================================================

DROP TRIGGER IF EXISTS trigger_register_credit_sale ON public.orders;
CREATE TRIGGER trigger_register_credit_sale
    AFTER INSERT OR UPDATE OF status, payment_method ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND NEW.payment_method = 'AL CRÉDITO')
    EXECUTE FUNCTION public.register_credit_sale();

-- ==============================================================================
-- 5. FUNCIÓN PARA REGISTRAR ABONO/PAGO
-- ==============================================================================

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

-- ==============================================================================
-- 6. ÍNDICES PARA OPTIMIZACIÓN
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer 
    ON public.credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type 
    ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created 
    ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_credit_balance 
    ON public.customers(current_balance) WHERE credit_limit > 0;

-- ==============================================================================
-- 7. DATOS DE EJEMPLO (OPCIONAL - Comentar si no se necesitan)
-- ==============================================================================

-- Insertar clientes de ejemplo con crédito (si no existen)
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

    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE name = 'EMPRESA TEXTILES S.A.') THEN
        INSERT INTO public.customers (name, nit, phone, email, address, credit_limit, authorized_discount, current_balance)
        VALUES ('EMPRESA TEXTILES S.A.', '11223344-5', '5555-9999', 'textiles@example.com', 'Zona Industrial', 25000.00, 3.00, 0.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE name = 'RESTAURANTE EL BUEN SABOR') THEN
        INSERT INTO public.customers (name, nit, phone, email, address, credit_limit, authorized_discount, current_balance)
        VALUES ('RESTAURANTE EL BUEN SABOR', '55667788-9', '5555-3333', 'buensabor@example.com', 'Zona 1', 15000.00, 2.00, 0.00);
    END IF;
END $$;

COMMIT;

-- ==============================================================================
-- VERIFICACIÓN
-- ==============================================================================

SELECT 'Sistema de Cuentas por Cobrar configurado correctamente ✅' as mensaje;

-- Mostrar resumen de clientes con crédito
SELECT 
    customer_name as "Cliente",
    client_nit as "NIT",
    telephone as "Teléfono",
    limite_credito as "Límite de Crédito",
    descuento as "Descuento %",
    saldo as "Saldo Actual"
FROM public.receivables_summary
LIMIT 10;
