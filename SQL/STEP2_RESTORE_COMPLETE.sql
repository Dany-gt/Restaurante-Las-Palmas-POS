-- ============================================
-- PASO 2: RESTAURACIÓN COMPLETA DE BASE DE DATOS
-- RESTAURANTE LAS PALMAS POS
-- Ejecutar en SQL Editor de Supabase
-- ============================================

-- ============================================
-- SECCIÓN A: ELIMINAR TABLAS EXISTENTES (SI HAY PROBLEMAS)
-- ⚠️ SOLO EJECUTAR SI LA BASE DE DATOS ESTÁ CORRUPTA
-- ============================================
/*
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS cash_registers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS kitchen_stations CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS pos_terminals CASCADE;
DROP TABLE IF EXISTS discounts CASCADE;
DROP TABLE IF EXISTS printers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS customer_credits CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS receivables CASCADE;
DROP TABLE IF EXISTS receivable_payments CASCADE;
*/

-- ============================================
-- SECCIÓN B: CREAR TODAS LAS TABLAS
-- ============================================

-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PROFILES (usuarios del sistema)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    full_name TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'CAJERO', 'MESERO', 'COCINA')) NOT NULL DEFAULT 'MESERO',
    role_id UUID REFERENCES roles(id),
    pin TEXT CHECK (length(pin) = 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. SECTIONS (zonas del restaurante)
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLES (mesas)
CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    section TEXT REFERENCES sections(name) ON UPDATE CASCADE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT CHECK (status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. KITCHEN_STATIONS (cocinas/estaciones)
CREATE TABLE IF NOT EXISTS kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    device_type TEXT CHECK (device_type IN ('KDS', 'PRINTER')) DEFAULT 'PRINTER',
    num_copies INTEGER DEFAULT 1,
    is_printer BOOLEAN DEFAULT true,
    is_kds BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    is_assigned_to_branch BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CATEGORIES (categorías del menú)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. PRODUCTS (productos del menú)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    kitchen_station_id UUID REFERENCES kitchen_stations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_available BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. CASH_REGISTERS (cajas registradoras)
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    current_shift_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. SHIFTS (turnos de caja)
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID REFERENCES cash_registers(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES profiles(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    end_time TIMESTAMP WITH TIME ZONE,
    start_amount DECIMAL(10,2) DEFAULT 0.00,
    end_amount DECIMAL(10,2),
    status TEXT CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    counted_amount DECIMAL(10,2) DEFAULT 0.00,
    difference_amount DECIMAL(10,2) DEFAULT 0.00,
    blind_cut BOOLEAN DEFAULT false,
    cash_detail JSONB DEFAULT '{}'::jsonb
);

-- 10. ORDERS (órdenes/pedidos)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id TEXT REFERENCES tables(id),
    status TEXT CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')) DEFAULT 'pending',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    waiter_id UUID REFERENCES profiles(id),
    is_paid BOOLEAN DEFAULT false,
    payment_method TEXT,
    shift_id UUID REFERENCES shifts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. ORDER_ITEMS (items de cada orden)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. EXPENSES (gastos de caja)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    cashier_id UUID REFERENCES profiles(id),
    cash_register_id UUID REFERENCES cash_registers(id),
    shift_id UUID REFERENCES shifts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. SUPPLIERS (proveedores)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. INVENTORY_ITEMS (inventario)
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 0,
    unit TEXT DEFAULT 'unidad',
    min_stock DECIMAL(10,2) DEFAULT 0,
    supplier_id UUID REFERENCES suppliers(id),
    cost DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. INVOICES (facturas electrónicas)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    customer_nit TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    uuid TEXT UNIQUE,
    authorization_number TEXT,
    series TEXT,
    document_number TEXT,
    certification_date TIMESTAMP WITH TIME ZONE,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status TEXT CHECK (status IN ('ACTIVE', 'CANCELLED')) DEFAULT 'ACTIVE',
    pdf_url TEXT,
    xml_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT
);

-- 16. SYSTEM_SETTINGS (configuración del sistema)
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    restaurant_name TEXT DEFAULT 'RESTAURANTE POS',
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    currency TEXT DEFAULT 'Q',
    tax_percentage DECIMAL(5,2) DEFAULT 12.00,
    suggested_tip DECIMAL(5,2) DEFAULT 10.00,
    opening_hours TEXT DEFAULT '08:00 - 22:00',
    logo_url TEXT,
    cashier_emails TEXT,
    enable_general_kitchen BOOLEAN DEFAULT false,
    round_tip BOOLEAN DEFAULT true,
    enable_quick_sale BOOLEAN DEFAULT true,
    limit_order_access BOOLEAN DEFAULT true,
    ask_delivery_payment BOOLEAN DEFAULT true,
    group_kitchen_by_name BOOLEAN DEFAULT false,
    enable_pagers BOOLEAN DEFAULT false,
    print_expense_ticket BOOLEAN DEFAULT true,
    print_order_num_ticket BOOLEAN DEFAULT true,
    print_charge_ticket BOOLEAN DEFAULT false,
    print_cancelled_ticket BOOLEAN DEFAULT true,
    print_deleted_ticket BOOLEAN DEFAULT true,
    allow_close_with_open_orders BOOLEAN DEFAULT false,
    allow_close_with_cashier_orders BOOLEAN DEFAULT true,
    multi_cashier_register BOOLEAN DEFAULT false,
    require_pin_for_register BOOLEAN DEFAULT true,
    enable_billing BOOLEAN DEFAULT false,
    billing_copies INTEGER DEFAULT 1,
    print_logo_on_invoice BOOLEAN DEFAULT true,
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
    scenario_code TEXT,
    ws_prefix TEXT,
    ws_key TEXT,
    signer_token TEXT,
    invoice_phrases TEXT,
    certifier_legend TEXT,
    isr_retention BOOLEAN DEFAULT false,
    iva_retention BOOLEAN DEFAULT false,
    no_iva_credit BOOLEAN DEFAULT false,
    exempt_iva BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. POS_TERMINALS
CREATE TABLE IF NOT EXISTS pos_terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    cash_register_id UUID REFERENCES cash_registers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. DISCOUNTS
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('percentage', 'fixed')) DEFAULT 'percentage',
    value DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 19. PRINTERS
CREATE TABLE IF NOT EXISTS printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('receipt', 'kitchen', 'label')) DEFAULT 'receipt',
    connection_type TEXT CHECK (connection_type IN ('usb', 'network', 'bluetooth')) DEFAULT 'network',
    address TEXT,
    is_default BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- SECCIÓN C: HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECCIÓN D: POLÍTICAS DE ACCESO (Permitir todo)
-- ============================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'roles', 'profiles', 'sections', 'tables', 'kitchen_stations',
        'categories', 'products', 'orders', 'order_items', 'system_settings',
        'cash_registers', 'shifts', 'expenses', 'suppliers', 'inventory_items', 
        'invoices', 'pos_terminals', 'discounts', 'printers'
    ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for %s" ON %s', t, t);
        EXECUTE format('CREATE POLICY "Allow all for %s" ON %s FOR ALL USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;

-- ============================================
-- SECCIÓN E: ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cash_register_id ON shifts(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shift_id ON expenses(shift_id);

-- ============================================
-- SECCIÓN F: DATOS INICIALES MÍNIMOS
-- ============================================

-- Configuración del sistema
INSERT INTO system_settings (id, restaurant_name, currency, tax_percentage) 
VALUES (1, 'RESTAURANTE LAS PALMAS', 'Q', 12.00)
ON CONFLICT (id) DO NOTHING;

-- Caja registradora por defecto (usa el ID de tu backup)
INSERT INTO cash_registers (id, name, is_active)
VALUES ('3d51fe6f-32a5-48af-b33c-602319491b7d', 'Caja Principal', true)
ON CONFLICT (id) DO NOTHING;

-- Usuarios del sistema (IDs de tu backup)
INSERT INTO profiles (id, name, full_name, role, pin)
VALUES 
    ('fac03431-5f03-4de4-91cc-42ecae0104a9', 'Cajero Principal', 'Cajero Las Palmas', 'CAJERO', '1234'),
    ('34dcc2ed-672a-42cf-82f6-4b65485a434a', 'Cajero 2', 'Cajero Secundario', 'CAJERO', '1234')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SECCIÓN G: RESTAURAR SHIFTS DESDE TU BACKUP
-- ============================================
INSERT INTO shifts (id, cash_register_id, cashier_id, start_time, end_time, start_amount, end_amount, status, notes, created_at, counted_amount, difference_amount, blind_cut, cash_detail)
VALUES 
('6a661369-3b52-4652-b3cb-8baf4ee8e193', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-28 18:19:04.177+00', '2026-01-28 19:06:48.4+00', 1200.00, 0.00, 'CLOSED', null, '2026-01-28 18:24:22.27855+00', 0.00, 0.00, false, '{}'),
('5c8f3e16-fe14-40ab-b6b3-679bbccfd8b9', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-28 19:07:31.468+00', '2026-01-29 03:35:34.299+00', 1200.00, 335.00, 'CLOSED', null, '2026-01-28 19:12:49.550047+00', 2300.00, 1965.00, false, '{"Q100.00":1,"Q200.00":11}'),
('793e434e-6a3e-4875-9322-b571a86b9d53', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 03:36:17.453+00', '2026-01-29 07:30:22.874+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 03:36:13.730211+00', 1290.00, 90.00, false, '{"Q20.00":2,"Q50.00":1,"Q100.00":12}'),
('73cf0dc8-a3d0-4446-8bcb-a96b78dcd0c6', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 15:57:46.746+00', '2026-01-29 16:50:53.795+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 16:03:06.518428+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('aa920411-27f6-448d-aeee-b39b42a69d17', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 17:05:01.342+00', '2026-01-29 17:05:08.856+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 17:10:21.110465+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('3526fe4a-fa83-42f7-a795-a491034ba83b', '3d51fe6f-32a5-48af-b33c-602319491b7d', '34dcc2ed-672a-42cf-82f6-4b65485a434a', '2026-01-29 17:36:50.783+00', null, 1200.00, null, 'OPEN', null, '2026-01-29 17:42:10.499186+00', 0.00, 0.00, false, '{}'),
('ca1ac816-d7a9-4259-be98-06fc05a11f22', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 19:23:20.725+00', '2026-01-29 21:37:24.841+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 19:28:40.534519+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('138ec193-653c-46ec-b155-8edb0fc23fc4', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 21:58:43.74+00', '2026-01-29 21:59:10.92+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 21:58:43.912903+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('e72d5563-0ce2-4ca5-ab78-572180e7c793', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 22:01:58.927+00', '2026-01-29 22:31:52.07+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 22:01:59.019291+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('c948eb87-83f8-4cac-91c5-caa9e1b01f93', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 04:26:01.117+00', '2026-01-30 04:37:37.535+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 04:25:57.356225+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('b76b87f2-2bca-41d6-ae9e-f7a8f32e3322', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 05:13:10.998+00', '2026-01-30 05:13:22.387+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 05:13:07.161166+00', 2200.00, 1000.00, false, '{"Q200.00":11}'),
('6d2bf984-2ac9-47ed-b005-5a437addb8c2', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 05:28:36.47+00', '2026-01-30 16:55:36.304+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 05:28:32.648984+00', 1000.00, -200.00, false, '{"Q100.00":10}'),
('e4e5e1d1-8223-468e-8582-43c9f4f6111c', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 16:55:48.286+00', '2026-01-30 16:56:05.537+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 17:01:10.607161+00', 1100.00, -100.00, false, '{"Q100.00":11}'),
('81e572b9-6ddf-4e86-892a-4dc93e5e8f97', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 17:13:05.215+00', '2026-01-30 17:13:16.351+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 17:18:27.549269+00', 800.00, -400.00, false, '{"Q200.00":4}'),
('ff86c305-6550-4dff-8d3a-efa930798d3b', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 17:22:42.872+00', '2026-01-30 17:23:05.891+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 17:28:05.137121+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('dedbe1d7-3db7-46a1-aa59-afa44c1a9765', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 18:55:03.629+00', null, 1200.00, null, 'OPEN', null, '2026-01-30 19:00:25.960148+00', 0.00, 0.00, false, '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SECCIÓN H: CERRAR TURNOS ABIERTOS VIEJOS
-- ============================================
UPDATE shifts 
SET status = 'CLOSED', 
    end_time = timezone('utc'::text, now()),
    end_amount = start_amount
WHERE status = 'OPEN' 
AND start_time < '2026-02-01 00:00:00+00';

SELECT 'Base de datos restaurada correctamente!' as resultado;
