-- ==============================================================================
-- RESTAURANTE LAS PALMAS POS - SCRIPT DE SINCRONIZACIÓN DE ESQUEMA COMPLETO
-- Ejecute este script en el Editor SQL de Supabase para asegurar que todas 
-- las nuevas funcionalidades estén operando correctamente.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CONFIGURACIÓN DE TERMINALES POS Y LIMPIEZA DE DUPLICADOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_terminals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    serial TEXT,
    status TEXT DEFAULT 'online',
    type TEXT DEFAULT 'Físico',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limpieza de duplicados: Mantiene solo el registro más antiguo basado en el serial
DELETE FROM pos_terminals a USING pos_terminals b
WHERE a.id > b.id 
AND a.serial = b.serial;

-- Asegurar restricción única
ALTER TABLE public.pos_terminals DROP CONSTRAINT IF EXISTS unique_pos_serial;
ALTER TABLE public.pos_terminals ADD CONSTRAINT unique_pos_serial UNIQUE (serial);

-- Habilitar RLS si no está habilitado
ALTER TABLE public.pos_terminals ENABLE ROW LEVEL SECURITY;

-- Política de acceso (re-creación segura)
DROP POLICY IF EXISTS "Enable all access for admins" ON public.pos_terminals;
CREATE POLICY "Enable all access for admins" ON public.pos_terminals
    FOR ALL USING (auth.role() = 'authenticated'); -- Permitir a usuarios autenticados

-- ------------------------------------------------------------------------------
-- 2. AJUSTES EN TABLA DE GASTOS (Audit y Cancelación)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT,
    amount NUMERIC(10,2),
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS is_void BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS voided_by UUID;

-- ------------------------------------------------------------------------------
-- 3. AJUSTES EN ÓRDENES (Pagos, Propinas y Cuentas Separadas)
-- ------------------------------------------------------------------------------
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_method TEXT,
ADD COLUMN IF NOT EXISTS card_processor TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'EFECTIVO',
ADD COLUMN IF NOT EXISTS is_contingency BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- 4. AJUSTES EN DETALLE DE ÓRDENES (Seguimiento de Comanda)
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending', 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- 5. AJUSTES EN TURNOS / CAJAS (Cierre Ciego y Arqueo)
-- ------------------------------------------------------------------------------
ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS counted_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS difference_amount DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS blind_cut BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cash_detail JSONB DEFAULT '{}'::jsonb;

-- ------------------------------------------------------------------------------
-- 6. CONFIGURACIÓN GENERAL DEL SISTEMA
-- ------------------------------------------------------------------------------
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

-- Datos por defecto de configuración
INSERT INTO public.system_settings (id, tax_percentage, suggested_tip, currency) 
SELECT 1, '12', '10', 'Q' 
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE id = 1);

-- ------------------------------------------------------------------------------
-- 7. ÍNDICES DE RENDIMIENTO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON public.orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses(created_at);

COMMIT;

-- Confirmación
SELECT 'Bases de datos actualizadas correctamente' as message;
