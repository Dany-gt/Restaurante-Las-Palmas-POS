-- ══════════════════════════════════════════════════════════════════════════════
-- RESTAURANTE LAS PALMAS POS — SCRIPT DE RECUPERACIÓN TOTAL
-- Versión: 2.5 (Consolidado Final)
-- Fecha: 28 de Abril, 2026
-- Propósito: Recrear la estructura completa de Supabase en un entorno nuevo.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. EXTENSIONES Y SEGURIDAD INICIAL ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. ROLES Y PERFILES (NUCLEO) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- Debe coincidir con auth.users.id
    org_id TEXT NOT NULL DEFAULT 'default',
    full_name TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'CAJERO', 'MESERO', 'COCINA')) DEFAULT 'MESERO',
    role_id UUID REFERENCES roles(id),
    pin TEXT CHECK (length(pin) = 4),
    branch_id UUID, -- Se vincula después de crear branches
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. ORGANIZACIÓN Y SUCURSALES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actualizar FK en profiles
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_branch FOREIGN KEY (branch_id) REFERENCES branches(id);

-- ── 4. CATEGORÍAS (MENÚ E INVENTARIO) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL DEFAULT 'default',
    nombre TEXT NOT NULL,
    icono TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL DEFAULT 'default',
    nombre TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('insumo', 'utensilio')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. ESTACIONES DE TRABAJO ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    device_type TEXT CHECK (device_type IN ('KDS', 'PRINTER')) DEFAULT 'PRINTER',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. MAESTRO DE PRODUCTOS (UNIFICADO) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL DEFAULT 'default',
    -- Clasificación
    es_platillo BOOLEAN DEFAULT true, -- true=Menú, false=Insumo/Inventario
    menu_category_id UUID REFERENCES menu_categories(id),
    product_category_id UUID REFERENCES product_categories(id),
    kitchen_station_id UUID REFERENCES kitchen_stations(id),
    
    -- Datos Básicos
    name TEXT NOT NULL,
    product_code TEXT UNIQUE,
    description TEXT,
    image_url TEXT,
    
    -- Precios y Costos
    price NUMERIC(14,2) DEFAULT 0.00, -- Precio Venta
    cost_price NUMERIC(14,2) DEFAULT 0.00, -- Costo Adquisición
    
    -- Inventario Técnico
    unit_measure TEXT, -- lb, kg, lt, unidad
    conversion_factor NUMERIC(14,4) DEFAULT 1.0,
    is_available BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. INVENTARIO Y RECETAS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_branch_inventory (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    quantity NUMERIC(14,2) DEFAULT 0,
    min_stock NUMERIC(14,2) DEFAULT 0,
    PRIMARY KEY (product_id, branch_id)
);

CREATE TABLE IF NOT EXISTS product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE, -- El platillo
    inventory_item_id UUID REFERENCES products(id), -- El insumo
    quantity NUMERIC(14,4) NOT NULL,
    unit_measure TEXT,
    waste_percentage NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    branch_id UUID REFERENCES branches(id),
    type TEXT CHECK (type IN ('ENTRY', 'EXIT', 'ADJUSTMENT')),
    quantity NUMERIC(14,2) NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. OPERACIÓN POS (MESAS Y ÓRDENES) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    section TEXT,
    status TEXT CHECK (status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id),
    table_id TEXT REFERENCES restaurant_tables(id),
    waiter_id UUID REFERENCES profiles(id),
    status TEXT CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')) DEFAULT 'pending',
    payment_method TEXT, -- 'efectivo', 'tarjeta', 'AL CRÉDITO'
    subtotal NUMERIC(14,2) DEFAULT 0.00,
    tax_amount NUMERIC(14,2) DEFAULT 0.00,
    total NUMERIC(14,2) DEFAULT 0.00,
    is_paid BOOLEAN DEFAULT false,
    customer_id UUID, -- Se vincula con customers después
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(14,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. CONTABILIDAD Y FISCAL (SAT) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historico_auditoria_sat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fel_uuid TEXT UNIQUE,
    tipo TEXT CHECK (tipo IN ('emitida', 'recibida')),
    tipo_documento TEXT, -- FACT, FPEQ, etc.
    fecha_emision DATE,
    proveedor_nombre TEXT,
    proveedor_nit TEXT,
    monto_total NUMERIC(14,2),
    iva_monto NUMERIC(14,2),
    items JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_date DATE,
    supplier_name TEXT,
    invoice_number TEXT,
    total_amount NUMERIC(14,2),
    status TEXT DEFAULT 'pendiente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. CUENTAS POR COBRAR (CRÉDITOS) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    nit TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    credit_limit NUMERIC(14,2) DEFAULT 0.00,
    current_balance NUMERIC(14,2) DEFAULT 0.00,
    authorized_discount NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ahora sí vincular orders con customers
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id),
    type TEXT CHECK (type IN ('CHARGE', 'PAYMENT')),
    amount NUMERIC(14,2) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. CONFIGURACIÓN DEL SISTEMA ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    restaurant_name TEXT,
    tax_percentage NUMERIC(5,2) DEFAULT 12.00,
    enable_billing BOOLEAN DEFAULT false,
    ws_key TEXT,
    signer_token TEXT,
    require_pin_for_register BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. VISTAS DE NEGOCIO ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW receivables_summary AS
SELECT 
    c.id, c.name, c.nit, c.credit_limit, c.current_balance,
    MAX(ct.created_at) FILTER (WHERE ct.type = 'PAYMENT') as ultimo_pago
FROM customers c
LEFT JOIN credit_transactions ct ON c.id = ct.customer_id
GROUP BY c.id;

-- ── 13. POLÍTICAS RLS (EJEMPLO) ────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select by org_id" ON products FOR SELECT USING (org_id = current_setting('app.current_org_id', true));

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- ══════════════════════════════════════════════════════════════════════════════
