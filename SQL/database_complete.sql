-- ============================================
-- SCRIPT COMPLETO DE BASE DE DATOS
-- RESTAURANTE LAS PALMAS POS - Todas las tablas necesarias
-- Ejecutar en SQL Editor de Supabase
-- ============================================

-- 1. ROLES (para permisos avanzados)
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

-- 8. ORDERS (órdenes/pedidos)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. ORDER_ITEMS (items de cada orden)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. SYSTEM_SETTINGS (configuración del sistema)
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
    -- Operacionales
    cashier_emails TEXT,
    enable_general_kitchen BOOLEAN DEFAULT false,
    round_tip BOOLEAN DEFAULT true,
    enable_quick_sale BOOLEAN DEFAULT true,
    limit_order_access BOOLEAN DEFAULT true,
    ask_delivery_payment BOOLEAN DEFAULT true,
    group_kitchen_by_name BOOLEAN DEFAULT false,
    enable_pagers BOOLEAN DEFAULT false,
    -- Tickets
    print_expense_ticket BOOLEAN DEFAULT true,
    print_order_num_ticket BOOLEAN DEFAULT true,
    print_charge_ticket BOOLEAN DEFAULT false,
    print_cancelled_ticket BOOLEAN DEFAULT true,
    print_deleted_ticket BOOLEAN DEFAULT true,
    -- Seguridad
    allow_close_with_open_orders BOOLEAN DEFAULT false,
    allow_close_with_cashier_orders BOOLEAN DEFAULT true,
    multi_cashier_register BOOLEAN DEFAULT false,
    require_pin_for_register BOOLEAN DEFAULT true,
    -- Facturación
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

-- 11. CASH_REGISTERS (cajas registradoras)
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    current_shift_id UUID,
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

-- ============================================
-- HABILITAR RLS EN TODAS LAS TABLAS
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
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS DE ACCESO (Permitir todo para desarrollo)
-- ============================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'roles', 'profiles', 'sections', 'tables', 'kitchen_stations',
        'categories', 'products', 'orders', 'order_items', 'system_settings',
        'cash_registers', 'expenses', 'suppliers', 'inventory_items', 'invoices'
    ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for %s" ON %s', t, t);
        EXECUTE format('CREATE POLICY "Allow all for %s" ON %s FOR ALL USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;

-- ============================================
-- INSERTAR CONFIGURACIÓN INICIAL
-- ============================================
INSERT INTO system_settings (id, restaurant_name, currency, tax_percentage) 
VALUES (1, 'RESTAURANTE LAS PALMAS', 'Q', 12.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);

SELECT 'Script ejecutado correctamente. Todas las tablas creadas.' as resultado;
