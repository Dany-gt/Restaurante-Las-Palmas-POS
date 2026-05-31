-- ============================================
-- SCRIPT COMPLETO DE RESTAURACIÓN
-- RESTAURANTE LAS PALMAS POS
-- Generado desde backup del 2026-02-01
-- ============================================
-- INSTRUCCIONES:
-- 1. Ve al SQL Editor de Supabase
-- 2. Copia y pega este script completo
-- 3. Ejecuta (Ctrl+Enter o botón Run)
-- ============================================

-- ============================================
-- PASO 1: ELIMINAR TABLAS EXISTENTES (LIMPIEZA)
-- ============================================
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS kitchen_stations CASCADE;
DROP TABLE IF EXISTS cash_registers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS pos_terminals CASCADE;
DROP TABLE IF EXISTS discounts CASCADE;
DROP TABLE IF EXISTS printers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;

-- ============================================
-- PASO 2: CREAR TODAS LAS TABLAS
-- ============================================

-- ROLES
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PROFILES (usuarios)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    full_name TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'CAJERO', 'MESERO', 'COCINA')) NOT NULL DEFAULT 'MESERO',
    role_id UUID REFERENCES roles(id),
    pin TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SECTIONS (zonas)
CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    priority INTEGER DEFAULT 100,
    table_from INTEGER,
    table_to INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLES (mesas)
CREATE TABLE tables (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    section TEXT REFERENCES sections(name) ON UPDATE CASCADE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT CHECK (status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
    qr_code TEXT,
    current_pax INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- KITCHEN_STATIONS
CREATE TABLE kitchen_stations (
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

-- CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    order_index INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 100,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    kitchen_station_id UUID REFERENCES kitchen_stations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_available BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    image_url TEXT,
    stock_quantity DECIMAL(10,2) DEFAULT 0,
    min_stock_level DECIMAL(10,2) DEFAULT 5,
    unit_measure TEXT DEFAULT 'UNIDAD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CASH_REGISTERS
CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    current_balance DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'open',
    last_closure_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    current_shift_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SHIFTS
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID REFERENCES cash_registers(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES profiles(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    end_time TIMESTAMP WITH TIME ZONE,
    start_amount DECIMAL(10,2) DEFAULT 0.00,
    end_amount DECIMAL(10,2),
    status TEXT CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
    notes TEXT,
    closing_notes TEXT,
    counted_amount DECIMAL(10,2) DEFAULT 0.00,
    difference_amount DECIMAL(10,2) DEFAULT 0.00,
    blind_cut BOOLEAN DEFAULT false,
    cash_detail JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- DRIVERS (repartidores)
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CUSTOMERS
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    nit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ORDERS
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id TEXT REFERENCES tables(id),
    waiter_id UUID REFERENCES profiles(id),
    status TEXT CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')) DEFAULT 'pending',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_paid BOOLEAN DEFAULT false,
    payment_method TEXT,
    shift_id UUID REFERENCES shifts(id),
    discount_id UUID,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_reason TEXT,
    pax_count INTEGER DEFAULT 1,
    order_type TEXT DEFAULT 'DINE_IN',
    customer_name TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    order_verify_code TEXT,
    delivery_coordinates TEXT,
    card_processor TEXT,
    customer_id UUID,
    tip_method TEXT,
    is_contingency BOOLEAN DEFAULT false,
    order_number INTEGER,
    driver_id UUID REFERENCES drivers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ORDER_ITEMS
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    account_id UUID,
    notes TEXT,
    account_index INTEGER DEFAULT 1,
    seat_number INTEGER,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- EXPENSES
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    category_id UUID,
    date TIMESTAMP WITH TIME ZONE,
    items JSONB,
    cash_register_id UUID REFERENCES cash_registers(id),
    shift_id UUID REFERENCES shifts(id),
    cashier_id UUID REFERENCES profiles(id),
    created_by UUID,
    is_void BOOLEAN DEFAULT false,
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SUPPLIERS
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    category TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INVENTORY_ITEMS
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 0,
    unit TEXT DEFAULT 'unidad',
    min_stock DECIMAL(10,2) DEFAULT 0,
    supplier_id UUID REFERENCES suppliers(id),
    cost DECIMAL(15,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INVOICES
CREATE TABLE invoices (
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

-- SYSTEM_SETTINGS
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    restaurant_name TEXT DEFAULT 'RESTAURANTE POS',
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    currency TEXT DEFAULT 'GTQ',
    tax_percentage DECIMAL(5,2) DEFAULT 12.00,
    suggested_tip DECIMAL(5,2) DEFAULT 10.00,
    opening_hours TEXT DEFAULT '08:00 - 22:00',
    logo_url TEXT,
    cashier_emails TEXT,
    enable_general_kitchen BOOLEAN DEFAULT false,
    round_tip BOOLEAN DEFAULT true,
    enable_quick_sale BOOLEAN DEFAULT false,
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
    business_name TEXT,
    printnode_enabled BOOLEAN DEFAULT false,
    printnode_api_key TEXT,
    printnode_printer_id TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- PASO 3: HABILITAR RLS
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
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 4: CREAR POLÍTICAS RLS (Permitir todo)
-- ============================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'roles', 'profiles', 'sections', 'tables', 'kitchen_stations',
        'categories', 'products', 'orders', 'order_items', 'system_settings',
        'cash_registers', 'shifts', 'expenses', 'suppliers', 'inventory_items', 
        'invoices', 'drivers', 'customers'
    ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for %s" ON %s', t, t);
        EXECUTE format('CREATE POLICY "Allow all for %s" ON %s FOR ALL USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;

-- ============================================
-- PASO 5: INSERTAR DATOS DE BACKUP
-- ============================================

-- ROLES (3 registros)
INSERT INTO roles (id, name, description, permissions, created_at) VALUES
('26391a24-2c88-4cc1-9deb-fd89b347f831', 'SUPERVISOR', 'Gestión operativa y reportes', '["Cajas:Acceso","Cajero:Acceder a Corte de Caja","Cajero:Corte Ciego","Cajero:Corte X","Cajero:Corte Z","Cajero:Anular Orden","Cajero:Eliminar Platos","Cajero:Aplicar Descuentos","Cajero:Crear Clientes Al Crédito","Cajero:Trasladar Orden a Mesero/Cajero"]', '2026-01-28 17:49:35.932952+00'),
('058b7bb1-2509-41f8-9e46-69d80042bb94', 'ADMINISTRADOR', 'Acceso total al sistema', '["Categorías de Platos:Editar","Categorías de Platos:Eliminar","Categorías de Platos:Nuevo","Categorías de Productos:Editar","Categorías de Productos:Eliminar","Categorías de Productos:Nuevo","Cocinas:Acceso","Cocinas:Asignar Dispositivo","Cocinas:Editar","Cocinas:Eliminar","Cocinas:Nuevo","Compras:Acceso","Compras:Anular","Compras:Editar","Compras:Nuevo","Compras:Procesar","Cuentas por Cobrar:Acceso","Cuentas por Cobrar:Editar","Cuentas por Cobrar:Eliminar","Cuentas por Cobrar:Generar Movimientos","Cuentas por Cobrar:Movimientos Cuenta","Cuentas por Cobrar:Nuevo","Configuración General:Acceso","Estaciones:Acceso","Estaciones:Editar","Estaciones:Eliminar","Estaciones:Nuevo","Existencias de Inventario:Acceso","Modificadores:Acceso","Modificadores:Editar","Modificadores:Eliminar","Modificadores:Nuevo","Gastos:Acceso","Gastos:Anular","Gastos:Crear Categoría","Gastos:Editar Categoria","Gastos:Eliminar Categoria","Nivelación de Inventarios:Acceso","Nivelación de Inventarios:Nuevo","Plataformas:Acceso","Plataformas:Editar","Plataformas:Eliminar","Plataformas:Nuevo","Opciones:Acceso","Opciones:Editar","Opciones:Eliminar","Opciones:Nuevo","Platillos y Bebidas:Acceso","Platillos y Bebidas:Editar","Platillos y Bebidas:Eliminar","Platillos y Bebidas:Nuevo","Producción:Acceso","Producción:Anular","Producción:Editar","Producción:Nuevo","Producción:Procesar","Proveedores:Acceso","Proveedores:Editar","Proveedores:Eliminar","Proveedores:Nuevo","Repartidores:Acceso","Repartidores:Editar","Repartidores:Eliminar","Repartidores:Nuevo","Roles de Usuario:Acceso","Roles de Usuario:Editar","Roles de Usuario:Eliminar","Roles de Usuario:Nuevo","Puntos de Impresión:Acceso","Puntos de Impresión:Editar","Puntos de Impresión:Eliminar","Puntos de Impresión:Nuevo","Productos:Acceso","Productos:Editar","Productos:Eliminar","Productos:Nuevo","POS Tarjeta:Acceso","POS Tarjeta:Editar","POS Tarjeta:Eliminar","POS Tarjeta:Nuevo","Reportes:Cortes de Caja","Reportes:Dashboards","Reportes:Facturas","Reportes:Facturas Anuladas","Reportes:Facturas en Contingencia","Reportes:Ingresoa a Caja Otros","Reportes:Ingresos a Caja","Reportes:Ordences Cerradas por Canal","Reportes:Ordenes Abiertas","Reportes:Ordenes al Crédito","Reportes:Ordenes Anuladas","Reportes:Ordenes Cerradas","Reportes:Ordenes con Descuento","Reportes:Platillos Eliminados","Reportes:Platillos Facturados","Reportes:Platillos Vendidos General","Reportes:Platillos Vendidos por Usuario","Reportes:Propinas","Reportes:Reporte General","Reportes:Reporte General Sucursales","Reportes:Todas las Ordenes","Tipos de Descuento:Acceso","Tipos de Descuento:Editar","Tipos de Descuento:Eliminar","Tipos de Descuento:Nuevo","Secciones:Acceso","Secciones:Editar","Secciones:Eliminar","Secciones:Nuevo","Traslado de Productos:Acceso","Traslado de Productos:Anular","Traslado de Productos:Editar","Traslado de Productos:Nuevo","Traslado de Productos:Procesar","Usuarios:Acceso","Usuarios:Editar","Usuarios:Eliminar","Usuarios:Nuevo"]', '2026-01-28 17:49:35.932952+00'),
('6f78649b-f2ce-4031-b70a-f106d241cc4b', 'CAJERO', '', '["Cajas:Acceso","Cajero:Acceder a Corte de Caja","Cajero:Acceso Modulo de Caja (Huella Digital)","Cajero:Anular Facturas","Cajero:Anular Orden","Cajero:Aplicar Descuentos","Cajero:Corte Ciego","Cajero:Corte X","Cajero:Corte Z","Cajero:Crear Clientes Al Crédito","Cajero:Eliminar Platos","Cajero:Trasladar Orden a Mesero/Cajero"]', '2026-01-25 15:59:00.486774+00');

-- PROFILES (9 usuarios)
INSERT INTO profiles (id, name, role, pin, created_at, role_id) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Mesero Juan', 'MESERO', '0000', '2026-01-24 16:44:04.433701+00', null),
('2372055e-917f-4aaa-b41d-82e1df7dfa44', 'YAMILET', 'MESERO', '2222', '2026-01-24 17:02:15.245898+00', null),
('f48fa372-6e9d-45b2-859c-6868c2f69a42', 'EDRAS', 'MESERO', '4444', '2026-01-25 15:57:56.61961+00', null),
('3bc5524f-284c-4f68-a715-0a51df197d13', 'EDVIN CASTRO', 'ADMIN', '1234', '2026-01-27 17:01:44.350602+00', null),
('34dcc2ed-672a-42cf-82f6-4b65485a434a', 'LUIS CASTRO', 'MESERO', '5555', '2026-01-27 17:04:03.23756+00', '6f78649b-f2ce-4031-b70a-f106d241cc4b'),
('d9e45e8d-0de8-40d7-b489-3b26e1d1d0e4', 'MARK CASH', 'MESERO', '2222', '2026-01-27 17:04:34.427449+00', '6f78649b-f2ce-4031-b70a-f106d241cc4b'),
('c3b29076-e919-4126-9bee-adcd5fd683f6', 'AMALIA DE LEON', 'COCINA', '6666', '2026-01-27 18:00:49.831424+00', null),
('ec09e9e5-6f32-4ea8-bd8a-0e417718bc8a', 'EDVIN', 'MESERO', '1990', '2026-01-28 01:01:51.18858+00', '6f78649b-f2ce-4031-b70a-f106d241cc4b'),
('fac03431-5f03-4de4-91cc-42ecae0104a9', 'PRUEBA CAJERO', 'CAJERO', '0000', '2026-01-27 17:43:30.129842+00', '6f78649b-f2ce-4031-b70a-f106d241cc4b');

-- SECTIONS (5 zonas)
INSERT INTO sections (id, name, priority, table_from, table_to, created_at) VALUES
('54717747-d7d4-4586-8c3c-efd0dd090a05', ' CUARTO A/C 1', 100, 1, 4, '2026-01-30 06:03:18.800178+00'),
('22480202-ea72-4fe6-854b-6f2b851407bb', 'AREA ABIERTA', 200, 5, 14, '2026-01-30 06:20:20.703888+00'),
('37472c2c-1521-4d6c-bf09-e82c1385360c', ' CUARTO GRANDE  A/C 2.', 300, 15, 21, '2026-01-30 06:27:00.82351+00'),
('4bfc31be-4b67-4f0e-a14f-189d79a430c7', 'CUARTO A/C 3.', 400, 22, 24, '2026-01-30 06:28:33.517843+00'),
('f5dea15b-0fbe-402c-8c34-9519c5521c41', 'VIP', 500, 25, 28, '2026-01-30 06:30:48.827082+00');

-- Secciones adicionales referenciadas por mesas
INSERT INTO sections (name, priority) VALUES ('CUARTITO AC 1.', 150) ON CONFLICT (name) DO NOTHING;

-- TABLES (37 mesas)
INSERT INTO tables (id, number, section, status, capacity) VALUES
('t-4-1769753419872', 4, ' CUARTO A/C 1', 'available', 4),
('t-7', 7, 'AREA ABIERTA', 'available', 4),
('t-8', 8, 'AREA ABIERTA', 'available', 4),
('t-9', 9, 'AREA ABIERTA', 'available', 4),
('t-10', 10, 'AREA ABIERTA', 'available', 4),
('t-11', 11, 'AREA ABIERTA', 'available', 4),
('t-5', 5, 'AREA ABIERTA', 'available', 4),
('t-13-1769754041231', 13, 'AREA ABIERTA', 'available', 4),
('t-14-1769754049215', 14, 'AREA ABIERTA', 'available', 4),
('t-2', 2, 'CUARTITO AC 1.', 'available', 4),
('t-1', 1, 'CUARTITO AC 1.', 'available', 4),
('t-15-1769754463071', 15, ' CUARTO GRANDE  A/C 2.', 'available', 4),
('t-16-1769754467936', 16, ' CUARTO GRANDE  A/C 2.', 'available', 4),
('t-12', 12, 'CUARTITO AC 1.', 'available', 4),
('t-13', 13, 'CUARTITO AC 1.', 'available', 4),
('t-14', 14, 'CUARTITO AC 1.', 'available', 4),
('t-15', 15, 'CUARTITO AC 1.', 'available', 4),
('t-17-1769754469935', 17, ' CUARTO GRANDE  A/C 2.', 'available', 4),
('t-18-1769754471888', 18, ' CUARTO GRANDE  A/C 2.', 'available', 4),
('t-19-1769754480985', 19, ' CUARTO GRANDE  A/C 2.', 'available', 4),
('t-20-1769754482785', 20, ' CUARTO GRANDE  A/C 2.', 'available', 4),
('t-21-1769754485057', 21, ' CUARTO GRANDE  A/C 2.', 'available', 4),
('t-22-1769754521519', 22, 'CUARTO A/C 3.', 'available', 4),
('t-23-1769754523631', 23, 'CUARTO A/C 3.', 'available', 4),
('t-24-1769754526088', 24, 'CUARTO A/C 3.', 'available', 4),
('t-25-1769754674224', 25, 'VIP', 'available', 4),
('t-26-1769754674224', 26, 'VIP', 'available', 4),
('t-27-1769754674224', 27, 'VIP', 'available', 4),
('t-28-1769754680128', 28, 'VIP', 'available', 4),
('t-29', 29, 'CUARTITO AC 1.', 'available', 4),
('t-30', 30, 'CUARTITO AC 1.', 'available', 4),
('t-31', 31, 'CUARTITO AC 1.', 'available', 4),
('t-32', 32, 'CUARTITO AC 1.', 'available', 4),
('t-6', 6, 'AREA ABIERTA', 'available', 4),
('t-1-1769753403663', 1, ' CUARTO A/C 1', 'available', 4),
('t-2-1769753411487', 2, ' CUARTO A/C 1', 'available', 4),
('t-3-1769753415751', 3, ' CUARTO A/C 1', 'available', 4);

-- KITCHEN_STATIONS (3 estaciones)
INSERT INTO kitchen_stations (id, name, device_type, num_copies, is_printer, is_kds, is_enabled, is_assigned_to_branch, created_at) VALUES
('5acbc537-62d6-454f-8c11-355098046701', 'BEBIDAS', 'KDS', 1, false, true, true, true, '2026-01-29 16:39:37.482295+00'),
('22cd3968-ae33-4767-96bd-4c9706d8813c', 'CEVICHERIA', 'KDS', 1, false, true, true, true, '2026-01-29 16:39:48.998959+00'),
('5ac41216-86f2-4c63-8c11-718212c7f5ab', 'COCINA', 'KDS', 1, false, true, true, true, '2026-01-29 16:39:43.367556+00');

-- CATEGORIES (6 categorías)
INSERT INTO categories (id, name, created_at, parent_id, order_index, image_url, priority, is_enabled) VALUES
('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'CERVEZAS', '2026-01-24 16:44:04.433701+00', null, 0, null, 100, true),
('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'PLATOS FUERTES', '2026-01-24 16:44:04.433701+00', null, 0, null, 100, true),
('2dd8dfac-fd0c-4ae6-a2c2-bf2b51c06284', 'BEBIDAS', '2026-01-27 18:18:09.623116+00', null, 0, null, 100, true),
('69e60875-8b2c-454b-bc88-2af5a7e7257e', 'CEVICHES', '2026-01-29 16:17:45.329886+00', null, 0, null, 100, true),
('27258f35-86a1-4b1a-a586-dddec8f9d7d4', 'CEVICHE TIPO COCTEL (SALSA DULCE)', '2026-01-29 16:23:12.816067+00', '69e60875-8b2c-454b-bc88-2af5a7e7257e', 0, null, 100, true),
('521d70f6-45a1-41a5-bb48-2e572941e39b', 'AGUA PURA', '2026-02-01 16:33:37.986154+00', '2dd8dfac-fd0c-4ae6-a2c2-bf2b51c06284', 0, '', 100, true);

-- PRODUCTS (6 productos)
INSERT INTO products (id, category_id, name, price, is_available, created_at, description, is_enabled, priority, image_url, kitchen_station_id, stock_quantity, min_stock_level, unit_measure) VALUES
('39113aac-ef43-4cfe-a5d5-9632e8b88942', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'GALLO VIDRIO', 18.00, true, '2026-01-24 16:44:04.433701+00', null, true, 100, null, null, 0.00, 5.00, 'UNIDAD'),
('0f677003-7e8f-4fb7-b56a-47b62bd5fd97', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'PIE DE LIMÓN', 35.00, true, '2026-01-24 16:44:04.433701+00', null, true, 100, null, null, 0.00, 5.00, 'UNIDAD'),
('a9a6cee7-7c4d-4c78-aef5-a9897a02d830', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'CEVICHE MIXTO', 200, true, '2026-01-24 16:44:04.433701+00', null, true, 100, null, null, 0.00, 5.00, 'UNIDAD'),
('1c7810ba-750d-44ee-ac83-f490136f508c', '27258f35-86a1-4b1a-a586-dddec8f9d7d4', 'CEVICHE  COCTEL DE CAMARON PEQUEÑO', 53, true, '2026-01-30 06:54:43.215537+00', '', true, 100, 'https://cofdsbczmrkriohlgyct.supabase.co/storage/v1/object/public/menu/products/0.46766087746251317.png', '22cd3968-ae33-4767-96bd-4c9706d8813c', 0.00, 5.00, 'UNIDAD'),
('a59ef562-406a-4487-9eef-85fb517a4123', '521d70f6-45a1-41a5-bb48-2e572941e39b', 'AGUA PURA BOTELLA', 9, true, '2026-02-01 16:34:43.666233+00', '', true, 100, 'https://cofdsbczmrkriohlgyct.supabase.co/storage/v1/object/public/menu/products/0.12914656733952934.png', '5acbc537-62d6-454f-8c11-355098046701', 0.00, 5.00, 'UNIDAD'),
('088a683c-893f-41bb-a7ee-378a9a1a0f47', '521d70f6-45a1-41a5-bb48-2e572941e39b', 'AGUA PURA PICHEL', 10, true, '2026-02-01 16:37:40.36228+00', '', true, 100, 'https://cofdsbczmrkriohlgyct.supabase.co/storage/v1/object/public/menu/products/0.9570579575837196.png', '5acbc537-62d6-454f-8c11-355098046701', 0.00, 5.00, 'UNIDAD');

-- CASH_REGISTERS (1 caja)
INSERT INTO cash_registers (id, name, current_balance, status, last_closure_at, created_at, is_active) VALUES
('3d51fe6f-32a5-48af-b33c-602319491b7d', 'Caja Principal', 1200, 'open', '2026-01-30 17:23:06.049+00', '2026-01-28 18:23:23.168532+00', true);

-- SHIFTS (16 turnos)
INSERT INTO shifts (id, cash_register_id, cashier_id, start_time, end_time, start_amount, end_amount, status, notes, created_at, counted_amount, difference_amount, blind_cut, cash_detail) VALUES
('6a661369-3b52-4652-b3cb-8baf4ee8e193', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-28 18:19:04.177+00', '2026-01-28 19:06:48.4+00', 1200.00, 0.00, 'CLOSED', null, '2026-01-28 18:24:22.27855+00', 0.00, 0.00, false, '{}'),
('5c8f3e16-fe14-40ab-b6b3-679bbccfd8b9', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-28 19:07:31.468+00', '2026-01-29 03:35:34.299+00', 1200.00, 335.00, 'CLOSED', null, '2026-01-28 19:12:49.550047+00', 2300.00, 1965.00, false, '{"Q100.00":1,"Q200.00":11}'),
('793e434e-6a3e-4875-9322-b571a86b9d53', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 03:36:17.453+00', '2026-01-29 07:30:22.874+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 03:36:13.730211+00', 1290.00, 90.00, false, '{"Q20.00":2,"Q50.00":1,"Q100.00":12}'),
('73cf0dc8-a3d0-4446-8bcb-a96b78dcd0c6', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 15:57:46.746+00', '2026-01-29 16:50:53.795+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 16:03:06.518428+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('aa920411-27f6-448d-aeee-b39b42a69d17', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 17:05:01.342+00', '2026-01-29 17:05:08.856+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 17:10:21.110465+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('3526fe4a-fa83-42f7-a795-a491034ba83b', '3d51fe6f-32a5-48af-b33c-602319491b7d', '34dcc2ed-672a-42cf-82f6-4b65485a434a', '2026-01-29 17:36:50.783+00', '2026-02-03 17:00:00+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 17:42:10.499186+00', 0.00, 0.00, false, '{}'),
('ca1ac816-d7a9-4259-be98-06fc05a11f22', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 19:23:20.725+00', '2026-01-29 21:37:24.841+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 19:28:40.534519+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('138ec193-653c-46ec-b155-8edb0fc23fc4', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 21:58:43.74+00', '2026-01-29 21:59:10.92+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 21:58:43.912903+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('e72d5563-0ce2-4ca5-ab78-572180e7c793', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-29 22:01:58.927+00', '2026-01-29 22:31:52.07+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-29 22:01:59.019291+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('c948eb87-83f8-4cac-91c5-caa9e1b01f93', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 04:26:01.117+00', '2026-01-30 04:37:37.535+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 04:25:57.356225+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('b76b87f2-2bca-41d6-ae9e-f7a8f32e3322', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 05:13:10.998+00', '2026-01-30 05:13:22.387+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 05:13:07.161166+00', 2200.00, 1000.00, false, '{"Q200.00":11}'),
('6d2bf984-2ac9-47ed-b005-5a437addb8c2', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 05:28:36.47+00', '2026-01-30 16:55:36.304+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 05:28:32.648984+00', 1000.00, -200.00, false, '{"Q100.00":10}'),
('e4e5e1d1-8223-468e-8582-43c9f4f6111c', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 16:55:48.286+00', '2026-01-30 16:56:05.537+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 17:01:10.607161+00', 1100.00, -100.00, false, '{"Q100.00":11}'),
('81e572b9-6ddf-4e86-892a-4dc93e5e8f97', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 17:13:05.215+00', '2026-01-30 17:13:16.351+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 17:18:27.549269+00', 800.00, -400.00, false, '{"Q200.00":4}'),
('ff86c305-6550-4dff-8d3a-efa930798d3b', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 17:22:42.872+00', '2026-01-30 17:23:05.891+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 17:28:05.137121+00', 1200.00, 0.00, false, '{"Q100.00":12}'),
('dedbe1d7-3db7-46a1-aa59-afa44c1a9765', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'fac03431-5f03-4de4-91cc-42ecae0104a9', '2026-01-30 18:55:03.629+00', '2026-02-03 17:00:00+00', 1200.00, 1200.00, 'CLOSED', null, '2026-01-30 19:00:25.960148+00', 0.00, 0.00, false, '{}');

-- SUPPLIERS (1 proveedor)
INSERT INTO suppliers (id, name, contact_name, phone, email, category, created_at) VALUES
('558a4d72-9265-42e9-a2e6-470de82f95a0', 'Mercado', null, null, null, null, '2026-01-28 19:42:42.820975+00');

-- EXPENSES (3 gastos)
INSERT INTO expenses (id, amount, description, category, date, created_at, items, cash_register_id, shift_id, cashier_id, is_void) VALUES
('2382d4f7-cb2f-465b-a84e-2042d4a1b5ef', 200, 'Gasto en MERCADO (1 items)', 'MERCADO', '2026-01-28 21:49:35.463092+00', '2026-01-28 21:49:35.463092+00', '[{"id":"1769636514597","name":"50 lbs de tomate","price":200}]', '3d51fe6f-32a5-48af-b33c-602319491b7d', null, 'fac03431-5f03-4de4-91cc-42ecae0104a9', false),
('56ed74b8-6296-4ee6-9ad9-3282cb88b465', 665, 'Gasto en MERCADO (3 items)', 'MERCADO', '2026-01-28 21:51:01.057208+00', '2026-01-28 21:51:01.057208+00', '[{"id":"1769636717038","name":"10 libras de cebolla","price":50},{"id":"1769636729692","name":"1 manojo de cilantro","price":15},{"id":"1769636741477","name":"1010 limones","price":600}]', '3d51fe6f-32a5-48af-b33c-602319491b7d', null, 'fac03431-5f03-4de4-91cc-42ecae0104a9', false),
('98c9da69-edaa-464e-a4cd-88b0b1028bac', 15, 'Gasto en MERCADITO (1 items)', 'MERCADITO', '2026-02-01 16:54:22.646126+00', '2026-02-01 16:54:22.646126+00', '[{"id":"1769964534408","name":"1 MANOJO DE CILANTRO","price":15}]', '3d51fe6f-32a5-48af-b33c-602319491b7d', 'dedbe1d7-3db7-46a1-aa59-afa44c1a9765', 'fac03431-5f03-4de4-91cc-42ecae0104a9', false);

-- SYSTEM_SETTINGS (configuración)
INSERT INTO system_settings (
    id, restaurant_name, address, phone, email, currency, tax_percentage, opening_hours, 
    logo_url, cashier_emails, enable_general_kitchen, suggested_tip, round_tip, 
    enable_quick_sale, limit_order_access, print_expense_ticket, print_order_num_ticket,
    print_charge_ticket, print_cancelled_ticket, print_deleted_ticket, 
    allow_close_with_open_orders, allow_close_with_cashier_orders, multi_cashier_register,
    require_pin_for_register, ask_delivery_payment, group_kitchen_by_name, enable_pagers,
    enable_billing, billing_copies, print_logo_on_invoice, commercial_name, legal_name,
    nit, billing_email, billing_address_1, municipality, department, branch_code,
    branch_id, scenario_code, ws_prefix, ws_key, signer_token, invoice_phrases,
    certifier_legend, isr_retention, iva_retention, no_iva_credit, exempt_iva, business_name
) VALUES (
    1, 'Restaurante Las Palmas', 'Avenida Circunvalacion 6-73 zona 1 Retalhuleu', '77710845',
    'cevicheriayrestlaspalmas@gmail.com', 'GTQ', 12, '08:00 - 22:00',
    'https://cofdsbczmrkriohlgyct.supabase.co/storage/v1/object/public/branding/public/logo-0.41136718220085255.jpg',
    'edvincastro1983@gmail.com', false, 10, true, false, true, true, true, false, true, true,
    false, true, false, true, true, false, false, false, 1, true,
    'Cevichería y Restaurante Las Palmas No. 2',
    'Cevichería y Restaurante Las Palmas, Sociedad Anónima',
    '91887666', 'edvincastro1983@gmail.com', 'Avenida Circunvalación 6-73 Zona 1',
    'Retalhueleu', 'Retalhueleu', '2', 'S2', '1', 'TU_WS_PREFIX_AQUI',
    'TU_WS_KEY_AQUI', 'TU_SIGNER_TOKEN_AQUI',
    'Sujeto a Pagos Trimestrales', 'Certificador: INFILE, S.A. NIT: 12521337',
    false, false, false, false, 'Restaurante Las Palmas'
);

-- ============================================
-- PASO 6: CREAR ÍNDICES
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
-- VERIFICACIÓN FINAL
-- ============================================
SELECT 
    'RESTAURACIÓN COMPLETADA!' as resultado,
    (SELECT COUNT(*) FROM profiles) as usuarios,
    (SELECT COUNT(*) FROM sections) as zonas,
    (SELECT COUNT(*) FROM tables) as mesas,
    (SELECT COUNT(*) FROM categories) as categorias,
    (SELECT COUNT(*) FROM products) as productos,
    (SELECT COUNT(*) FROM kitchen_stations) as cocinas,
    (SELECT COUNT(*) FROM shifts) as turnos,
    (SELECT COUNT(*) FROM expenses) as gastos;
