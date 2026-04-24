-- ==============================================================================
-- RESTAURANTE LAS PALMAS POS - CONSOLIDATED DATABASE UPDATE
-- ==============================================================================

BEGIN;

-- 1. ACTUALIZACIÓN DE ÓRDENES (Separación de Cuentas y Detalles de Pago)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_number SERIAL,
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_method TEXT,
ADD COLUMN IF NOT EXISTS card_processor TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'EFECTIVO',
ADD COLUMN IF NOT EXISTS is_contingency BOOLEAN DEFAULT FALSE;

-- 1b. BACKFILL: Asignar números secuenciales a órdenes existentes
UPDATE public.orders SET order_number = subquery.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn 
  FROM public.orders
  WHERE order_number IS NULL OR order_number = 0
) AS subquery
WHERE public.orders.id = subquery.id;

-- 2. ACTUALIZACIÓN DE ÍTEMS (Comandas y Tracking de Envío)
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending', 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE;

-- 3. ACTUALIZACIÓN PARA CIERRE CIEGO Y AUDITORÍA DE CAJA (Arqueo)
ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS counted_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS difference_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS blind_cut BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cash_detail JSONB DEFAULT '{}'::jsonb;

-- 4. CONFIGURACIÓN DEL SISTEMA
CREATE TABLE IF NOT EXISTS public.system_settings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    enable_billing BOOLEAN DEFAULT FALSE,
    billing_copies INT DEFAULT 1,
    print_logo_on_invoice BOOLEAN DEFAULT TRUE,
    commercial_name TEXT,
    legal_name TEXT,
    nit TEXT,
    billing_email TEXT,
    billing_address_1 TEXT,
    billing_address_2 TEXT,
    municipality TEXT,
    department TEXT,
    branch_code TEXT,
    branch_id TEXT,
    scenario_code TEXT DEFAULT '1',
    ws_prefix TEXT,
    ws_key TEXT,
    signer_token TEXT,
    invoice_phrases TEXT,
    certifier_legend TEXT,
    isr_retention BOOLEAN DEFAULT FALSE,
    iva_retention BOOLEAN DEFAULT FALSE,
    no_iva_credit BOOLEAN DEFAULT FALSE,
    exempt_iva BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tax_percentage TEXT DEFAULT '12',
    suggested_tip TEXT DEFAULT '10',
    currency TEXT DEFAULT 'Q'
);

-- Insertar configuración inicial por defecto si no existe
INSERT INTO public.system_settings (id, tax_percentage, suggested_tip, currency) 
SELECT 1, '12', '10', 'Q' 
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE id = 1);

-- 5. ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON public.orders(status, created_at);

COMMIT;
