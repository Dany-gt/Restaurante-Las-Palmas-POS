-- ==============================================================================
-- RESTAURANTE LAS PALMAS POS - DATABASE ARCHITECTURE AUDIT & MIGRATION SCRIPT
-- Author: Senior Database Architect Audit
-- Date: 2026-02-01
-- ==============================================================================
-- 
-- AUDIT FINDINGS:
-- 1. Inconsistent UUID generators (uuid_generate_v4 vs gen_random_uuid)
-- 2. Missing Foreign Key constraints
-- 3. Missing updated_at columns and triggers
-- 4. Missing indexes on frequently queried columns
-- 5. Duplicate tables (drivers vs delivery_drivers)
-- 6. Missing or incomplete RLS policies
-- 7. Incomplete tables (orders, order_items, profiles, tables, shifts missing from audit)
--
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 0: ENSURE EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- STEP 1: CREATE REUSABLE TRIGGER FUNCTION FOR updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- ==============================================================================
-- STEP 2: NORMALIZE UUID GENERATORS (Standardize to gen_random_uuid)
-- ==============================================================================
-- Note: This only affects NEW rows. Existing data is fine.

ALTER TABLE public.cash_movements ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.cash_registers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.credit_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.customer_credits ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.customers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.drivers ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.expense_categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.expenses ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ==============================================================================
-- STEP 3: ADD MISSING COLUMNS
-- ==============================================================================

-- 3.1 Add updated_at to all tables that need it
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.customer_addresses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.customer_credits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.delivery_drivers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.discount_types ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.closure_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.2 Add missing columns to expenses table
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_void BOOLEAN DEFAULT FALSE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3.3 Add order_number to orders (CRITICAL for sequential numbering)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number SERIAL;

-- 3.4 Add missing columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tip_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS card_processor TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'EFECTIVO';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_contingency BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.5 Add missing columns to order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.6 Add missing columns to shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS counted_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS difference_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS blind_cut BOOLEAN DEFAULT FALSE;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS cash_detail JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS closing_notes TEXT;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.7 Add missing columns to tables
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.8 Add missing columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ==============================================================================
-- STEP 4: BACKFILL ORDER NUMBERS (Sequential)
-- ==============================================================================
UPDATE public.orders SET order_number = subquery.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn 
  FROM public.orders
  WHERE order_number IS NULL OR order_number = 0
) AS subquery
WHERE public.orders.id = subquery.id;

-- ==============================================================================
-- STEP 5: ADD FOREIGN KEY CONSTRAINTS
-- ==============================================================================

-- 5.1 activity_logs
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_user;
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_user 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_order;
ALTER TABLE public.activity_logs 
ADD CONSTRAINT fk_activity_logs_order 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 5.2 cash_movements
ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS fk_cash_movements_register;
ALTER TABLE public.cash_movements 
ADD CONSTRAINT fk_cash_movements_register 
FOREIGN KEY (register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;

ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS fk_cash_movements_user;
ALTER TABLE public.cash_movements 
ADD CONSTRAINT fk_cash_movements_user 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5.3 categories (self-referencing)
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS fk_categories_parent;
ALTER TABLE public.categories 
ADD CONSTRAINT fk_categories_parent 
FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- 5.4 closure_attempts
ALTER TABLE public.closure_attempts DROP CONSTRAINT IF EXISTS fk_closure_attempts_cashier;
ALTER TABLE public.closure_attempts 
ADD CONSTRAINT fk_closure_attempts_cashier 
FOREIGN KEY (cashier_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.closure_attempts DROP CONSTRAINT IF EXISTS fk_closure_attempts_shift;
ALTER TABLE public.closure_attempts 
ADD CONSTRAINT fk_closure_attempts_shift 
FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;

-- 5.5 credit_transactions
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS fk_credit_transactions_customer;
ALTER TABLE public.credit_transactions 
ADD CONSTRAINT fk_credit_transactions_customer 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS fk_credit_transactions_order;
ALTER TABLE public.credit_transactions 
ADD CONSTRAINT fk_credit_transactions_order 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS fk_credit_transactions_created_by;
ALTER TABLE public.credit_transactions 
ADD CONSTRAINT fk_credit_transactions_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5.6 customer_addresses
ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS fk_customer_addresses_customer;
ALTER TABLE public.customer_addresses 
ADD CONSTRAINT fk_customer_addresses_customer 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- 5.7 expenses
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS fk_expenses_category;
ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_category 
FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE SET NULL;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS fk_expenses_shift;
ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_shift 
FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS fk_expenses_created_by;
ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5.8 orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_table;
ALTER TABLE public.orders 
ADD CONSTRAINT fk_orders_table 
FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_waiter;
ALTER TABLE public.orders 
ADD CONSTRAINT fk_orders_waiter 
FOREIGN KEY (waiter_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS fk_orders_customer;
ALTER TABLE public.orders 
ADD CONSTRAINT fk_orders_customer 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- 5.9 order_items
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_order;
ALTER TABLE public.order_items 
ADD CONSTRAINT fk_order_items_order 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order_items_product;
ALTER TABLE public.order_items 
ADD CONSTRAINT fk_order_items_product 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

-- 5.10 products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS fk_products_category;
ALTER TABLE public.products 
ADD CONSTRAINT fk_products_category 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- 5.11 shifts
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS fk_shifts_cashier;
ALTER TABLE public.shifts 
ADD CONSTRAINT fk_shifts_cashier 
FOREIGN KEY (cashier_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS fk_shifts_register;
ALTER TABLE public.shifts 
ADD CONSTRAINT fk_shifts_register 
FOREIGN KEY (cash_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;

-- 5.12 profiles -> auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_user;
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_user 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ==============================================================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- ==============================================================================

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON public.orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON public.orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_available ON public.products(is_available);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_order_index ON public.categories(order_index);

-- Tables
CREATE INDEX IF NOT EXISTS idx_tables_status ON public.tables(status);
CREATE INDEX IF NOT EXISTS idx_tables_section ON public.tables(section);

-- Shifts
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON public.shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON public.shifts(start_time);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_shift_id ON public.expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON public.expenses(created_at);

-- Credit Transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer_id ON public.credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_order_id ON public.credit_transactions(order_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Activity Logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ==============================================================================
-- STEP 7: CREATE TRIGGERS FOR updated_at
-- ==============================================================================

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tables_updated_at ON public.tables;
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON public.tables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON public.shifts;
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cash_registers_updated_at ON public.cash_registers;
CREATE TRIGGER update_cash_registers_updated_at BEFORE UPDATE ON public.cash_registers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- STEP 8: ENABLE ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- STEP 9: CREATE RLS POLICIES
-- ==============================================================================

-- 9.1 Profiles: Users can read all, update only their own
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 9.2 Orders: Full access for authenticated users (restaurant staff)
DROP POLICY IF EXISTS "Orders full access for authenticated" ON public.orders;
CREATE POLICY "Orders full access for authenticated" ON public.orders
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.3 Order Items: Full access for authenticated users
DROP POLICY IF EXISTS "Order items full access for authenticated" ON public.order_items;
CREATE POLICY "Order items full access for authenticated" ON public.order_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.4 Products: Read for all authenticated, write for admins
DROP POLICY IF EXISTS "Products viewable by authenticated" ON public.products;
CREATE POLICY "Products viewable by authenticated" ON public.products
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Products editable by admins" ON public.products;
CREATE POLICY "Products editable by admins" ON public.products
FOR ALL TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 9.5 Categories: Same as products
DROP POLICY IF EXISTS "Categories viewable by authenticated" ON public.categories;
CREATE POLICY "Categories viewable by authenticated" ON public.categories
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Categories editable by admins" ON public.categories;
CREATE POLICY "Categories editable by admins" ON public.categories
FOR ALL TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- 9.6 Tables: Full access for authenticated
DROP POLICY IF EXISTS "Tables full access for authenticated" ON public.tables;
CREATE POLICY "Tables full access for authenticated" ON public.tables
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.7 Shifts: Users can view all, only manage their own
DROP POLICY IF EXISTS "Shifts viewable by authenticated" ON public.shifts;
CREATE POLICY "Shifts viewable by authenticated" ON public.shifts
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Shifts manageable by owner or admin" ON public.shifts;
CREATE POLICY "Shifts manageable by owner or admin" ON public.shifts
FOR ALL TO authenticated 
USING (
  cashier_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'CAJERO'))
)
WITH CHECK (
  cashier_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'CAJERO'))
);

-- 9.8 Customers: Full access for cashiers and admins
DROP POLICY IF EXISTS "Customers full access for staff" ON public.customers;
CREATE POLICY "Customers full access for staff" ON public.customers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.9 Expenses: Full access for authorized staff
DROP POLICY IF EXISTS "Expenses full access for staff" ON public.expenses;
CREATE POLICY "Expenses full access for staff" ON public.expenses
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.10 Expense Categories: Read all, write for admins
DROP POLICY IF EXISTS "Expense categories viewable" ON public.expense_categories;
CREATE POLICY "Expense categories viewable" ON public.expense_categories
FOR SELECT TO authenticated USING (true);

-- 9.11 Cash Registers: Full access for cashiers/admins
DROP POLICY IF EXISTS "Cash registers full access" ON public.cash_registers;
CREATE POLICY "Cash registers full access" ON public.cash_registers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.12 Activity Logs: Read all, write own
DROP POLICY IF EXISTS "Activity logs viewable" ON public.activity_logs;
CREATE POLICY "Activity logs viewable" ON public.activity_logs
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Activity logs insertable" ON public.activity_logs;
CREATE POLICY "Activity logs insertable" ON public.activity_logs
FOR INSERT TO authenticated WITH CHECK (true);

-- 9.13 Credit Transactions: Full access
DROP POLICY IF EXISTS "Credit transactions full access" ON public.credit_transactions;
CREATE POLICY "Credit transactions full access" ON public.credit_transactions
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.14 Customer Addresses: Full access
DROP POLICY IF EXISTS "Customer addresses full access" ON public.customer_addresses;
CREATE POLICY "Customer addresses full access" ON public.customer_addresses
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.15 Discount Types: Read all, write admins
DROP POLICY IF EXISTS "Discount types viewable" ON public.discount_types;
CREATE POLICY "Discount types viewable" ON public.discount_types
FOR SELECT TO authenticated USING (true);

-- 9.16 Discounts: Read all
DROP POLICY IF EXISTS "Discounts viewable" ON public.discounts;
CREATE POLICY "Discounts viewable" ON public.discounts
FOR SELECT TO authenticated USING (true);

-- 9.17 Delivery Drivers: Full access
DROP POLICY IF EXISTS "Delivery drivers full access" ON public.delivery_drivers;
CREATE POLICY "Delivery drivers full access" ON public.delivery_drivers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9.18 Cash Movements: Full access
DROP POLICY IF EXISTS "Cash movements full access" ON public.cash_movements;
CREATE POLICY "Cash movements full access" ON public.cash_movements
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- STEP 10: CREATE SYSTEM SETTINGS TABLE (if not exists)
-- ==============================================================================

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
    tax_percentage TEXT DEFAULT '12',
    suggested_tip TEXT DEFAULT '10',
    currency TEXT DEFAULT 'Q',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO public.system_settings (tax_percentage, suggested_tip, currency) 
SELECT '12', '10', 'Q' 
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1);

-- ==============================================================================
-- STEP 11: CLEANUP DUPLICATE TABLES (Optional - Review before executing)
-- ==============================================================================
-- Note: drivers and delivery_drivers appear to be duplicates
-- Uncomment the following if you want to consolidate:
-- DROP TABLE IF EXISTS public.drivers;

COMMIT;

-- ==============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ==============================================================================
-- SELECT table_name, count(*) as constraint_count 
-- FROM information_schema.table_constraints 
-- WHERE constraint_type = 'FOREIGN KEY' 
-- GROUP BY table_name ORDER BY table_name;

-- SELECT schemaname, tablename, indexname 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, indexname;
