-- ==============================================================================
-- SCRIPT DE REPARACIÓN: ESQUEMA DE CUENTAS POR COBRAR (ROBUSTO)
-- ==============================================================================

BEGIN;

-- 1. AGREGAR COLUMNAS FALTANTES A LA TABLA CUSTOMERS
-- Usamos 'IF NOT EXISTS' implícito mediante comprobación
DO $$ 
BEGIN
    -- Agregar credit_limit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'credit_limit') THEN
        ALTER TABLE public.customers ADD COLUMN credit_limit DECIMAL(10,2) DEFAULT 0.00;
    END IF;

    -- Agregar current_balance
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'current_balance') THEN
        ALTER TABLE public.customers ADD COLUMN current_balance DECIMAL(10,2) DEFAULT 0.00;
    END IF;

    -- Agregar authorized_discount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'authorized_discount') THEN
        ALTER TABLE public.customers ADD COLUMN authorized_discount DECIMAL(5,2) DEFAULT 0.00;
    END IF;
END $$;

-- 2. AGREGAR COLUMNA created_by A credit_transactions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_transactions' AND column_name = 'created_by') THEN
        ALTER TABLE public.credit_transactions ADD COLUMN created_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- 3. GESTIÓN DE POLÍTICAS (RLS)
-- Primero las borramos si existen para evitar el error "policy already exists"
DROP POLICY IF EXISTS "Allow all for customers" ON customers;
DROP POLICY IF EXISTS "Allow all for credit_transactions" ON credit_transactions;

-- Habilitar RLS (es seguro ejecutarlo varias veces)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Crear las políticas nuevamente
CREATE POLICY "Allow all for customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for credit_transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);


-- 4. RECREAR VISTA PRINCIPAL
DROP VIEW IF EXISTS public.receivables_summary;

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
    c.credit_limit > 0
GROUP BY 
    c.id, c.name, c.nit, c.phone, c.credit_limit, 
    c.authorized_discount, c.current_balance, c.email, 
    c.address, c.created_at
ORDER BY 
    c.current_balance DESC, c.name ASC;


-- 5. RECREAR VISTA DE DETALLE
DROP VIEW IF EXISTS public.receivables_transactions_detail;

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

COMMIT;
