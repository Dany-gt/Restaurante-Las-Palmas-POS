-- ==============================================================================
-- RESTAURANTE LAS PALMAS POS - UNIFIED DATABASE MIGRATION SCRIPT
-- Includes:
-- 1. Database Audit Fixes (UUIDs, Foreign Keys, Indexes, RLS)
-- 2. New Features Support (Delivery Drivers, Order Numbers)
-- 3. System Settings
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EXTENSIONS & FUNCTIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ==============================================================================
-- 2. TABLE STRUCTURE UPDATES
-- ==============================================================================

-- 2.1 ORDERS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number SERIAL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS card_processor TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'EFECTIVO';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_contingency BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- New column for Driver Assignment
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id UUID;

-- 2.2 ORDER ITEMS
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2.3 SHIFTS
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS counted_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS difference_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS blind_cut BOOLEAN DEFAULT FALSE;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS cash_detail JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS closing_notes TEXT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2.4 EXPENSES
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_void BOOLEAN DEFAULT FALSE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2.5 OTHER TABLES (updated_at)
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.delivery_drivers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2.6 SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    -- Restaurant Info
    restaurant_name TEXT,
    commercial_name TEXT,
    legal_name TEXT,
    nit TEXT,
    phone TEXT,
    address TEXT,
    billing_address_1 TEXT,
    billing_address_2 TEXT,
    municipality TEXT,
    department TEXT,
    -- FEL / Billing
    enable_billing BOOLEAN DEFAULT FALSE,
    billing_copies INT DEFAULT 1,
    print_logo_on_invoice BOOLEAN DEFAULT TRUE,
    billing_email TEXT,
    branch_code TEXT,
    branch_id TEXT,
    scenario_code TEXT DEFAULT '1',
    ws_prefix TEXT,
    ws_key TEXT,
    signer_token TEXT,
    invoice_phrases TEXT DEFAULT 'Sujeto a Pagos Trimestrales',
    certifier_legend TEXT DEFAULT 'Certificador: INFILE, S.A. NIT: 12521337',
    isr_retention BOOLEAN DEFAULT FALSE,
    iva_retention BOOLEAN DEFAULT FALSE,
    no_iva_credit BOOLEAN DEFAULT FALSE,
    exempt_iva BOOLEAN DEFAULT FALSE,
    -- Tax & Currency
    tax_percentage TEXT DEFAULT '12',
    suggested_tip TEXT DEFAULT '10',
    currency TEXT DEFAULT 'Q',
    -- Print Settings
    print_expense_ticket BOOLEAN DEFAULT TRUE,
    print_order_num_ticket BOOLEAN DEFAULT TRUE,
    print_charge_ticket BOOLEAN DEFAULT FALSE,
    print_cancelled_ticket BOOLEAN DEFAULT TRUE,
    print_deleted_ticket BOOLEAN DEFAULT TRUE,
    group_kitchen_by_name BOOLEAN DEFAULT FALSE,
    -- PrintNode
    printnode_enabled BOOLEAN DEFAULT FALSE,
    printnode_api_key TEXT,
    printnode_printer_id TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing system_settings (if table already exists)
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS restaurant_name TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS billing_address_1 TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS billing_address_2 TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS municipality TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS invoice_phrases TEXT DEFAULT 'Sujeto a Pagos Trimestrales';
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS certifier_legend TEXT DEFAULT 'Certificador: INFILE, S.A. NIT: 12521337';
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS print_expense_ticket BOOLEAN DEFAULT TRUE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS print_order_num_ticket BOOLEAN DEFAULT TRUE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS print_charge_ticket BOOLEAN DEFAULT FALSE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS print_cancelled_ticket BOOLEAN DEFAULT TRUE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS print_deleted_ticket BOOLEAN DEFAULT TRUE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS group_kitchen_by_name BOOLEAN DEFAULT FALSE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS printnode_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS printnode_api_key TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS printnode_printer_id TEXT;

INSERT INTO public.system_settings (tax_percentage, suggested_tip, currency) 
SELECT '12', '10', 'Q' 
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1);

-- ==============================================================================
-- 3. DATA BACKFILL
-- ==============================================================================
-- Backfill order numbers for existing orders
UPDATE public.orders SET order_number = subquery.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn 
  FROM public.orders
  WHERE order_number IS NULL OR order_number = 0
) AS subquery
WHERE public.orders.id = subquery.id;

-- ==============================================================================
-- 4. CONSTRAINTS (FOREIGN KEYS)
-- ==============================================================================

-- Orders -> Drivers
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_driver;
ALTER TABLE public.orders ADD CONSTRAINT fk_orders_driver 
FOREIGN KEY (driver_id) REFERENCES public.delivery_drivers(id) ON DELETE SET NULL;

-- Orders -> Tables
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_table;
ALTER TABLE public.orders ADD CONSTRAINT fk_orders_table 
FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;

-- Orders -> Waiters: REMOVED FK constraint as it causes issues
-- waiter_id references profiles but not all profile IDs are in auth.users
-- Just clean up and leave without constraint
-- waiter_id references profiles but not all profile IDs exist in auth.users
-- Just clean up orphan references and leave without constraint
UPDATE public.orders 
SET waiter_id = NULL 
WHERE waiter_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = waiter_id);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_waiter;
-- NOTE: Intentionally NOT recreating this FK to avoid runtime errors

-- Payment Driver cleanup just in case
UPDATE public.orders 
SET driver_id = NULL 
WHERE driver_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.delivery_drivers WHERE id = driver_id);

-- Order Items -> Orders
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_order;
ALTER TABLE public.order_items ADD CONSTRAINT fk_order_items_order 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- Order Items -> Products
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_product;
ALTER TABLE public.order_items ADD CONSTRAINT fk_order_items_product 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- Expenses -> Shifts
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS fk_expenses_shift;
ALTER TABLE public.expenses ADD CONSTRAINT fk_expenses_shift 
FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;

-- Shifts -> Cash Registry
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS fk_shifts_register;
ALTER TABLE public.shifts ADD CONSTRAINT fk_shifts_register 
FOREIGN KEY (cash_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;

-- ==============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON public.orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON public.shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_is_active ON public.delivery_drivers(is_active);

-- ==============================================================================
-- 6. TRIGGERS (Auto-update updated_at)
-- ==============================================================================
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 7. SECURITY (Row Level Security)
-- ==============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policy: Orders (Full Access for Staff)
DROP POLICY IF EXISTS "Orders full access for authenticated" ON public.orders;
CREATE POLICY "Orders full access for authenticated" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: Order Items
DROP POLICY IF EXISTS "Order items full access for authenticated" ON public.order_items;
CREATE POLICY "Order items full access for authenticated" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: Delivery Drivers
DROP POLICY IF EXISTS "Delivery drivers full access" ON public.delivery_drivers;
CREATE POLICY "Delivery drivers full access" ON public.delivery_drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
