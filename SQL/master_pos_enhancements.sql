
-- POS ENHANCEMENTS MASTER MIGRATION
-- This script consolidates all database changes for POS Terminal Management, 
-- Credit Payment Flow (Vales Al Crédito), and Extended Tip Tracking.

-- 1. POS TERMINALS MANAGEMENT
CREATE TABLE IF NOT EXISTS pos_terminals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    serial TEXT,
    status TEXT DEFAULT 'online',
    type TEXT DEFAULT 'Físico',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pos_terminals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Enable read access for all users" ON pos_terminals FOR SELECT USING (true);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Enable all access for admins" ON pos_terminals FOR ALL USING (true);
EXCEPTION WHEN others THEN NULL; END $$;

INSERT INTO pos_terminals (name, serial, status, type, logo_url)
VALUES 
('NEO NET', 'NEO-001', 'online', 'Físico', NULL),
('CREDOMATIC', 'BAC-001', 'online', 'Físico', NULL),
('VISANET LINK', 'VISA-001', 'online', 'Virtual', NULL)
ON CONFLICT DO NOTHING;


-- 2. CUSTOMER CREDIT SYSTEM (VALES)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    nit TEXT DEFAULT 'C/F',
    email TEXT,
    address TEXT,
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    current_balance DECIMAL(10,2) DEFAULT 0.00,
    authorized_discount DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id),
    amount DECIMAL(10,2) NOT NULL,
    type TEXT CHECK (type IN ('CHARGE', 'PAYMENT')) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow all for customers" ON customers FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow all for credit_transactions" ON credit_transactions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN others THEN NULL; END $$;


-- 3. ORDERS TABLE UPDATES
DO $$
BEGIN
    -- Add customer_id for credit sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_id') THEN
        ALTER TABLE public.orders ADD COLUMN customer_id UUID REFERENCES public.customers(id);
    END IF;

    -- Add tip_method to track if tip was Cash or Card
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tip_method') THEN
        ALTER TABLE public.orders ADD COLUMN tip_method TEXT;
    END IF;
END $$;


-- 4. INITIAL MOCK DATA (CUSTOMERS)
INSERT INTO customers (name, phone, nit, credit_limit, current_balance, authorized_discount)
VALUES 
('DANILO ESTUARDO PEREZ', '55551001', '123456-1', 5000.00, 0.00, 0.00),
('MARCELO AMILCAR BATZ', '44442002', '123456-2', 2000.00, 0.00, 0.00),
('MARIO ELISEO CAST...', '33333003', '123456-3', 1000.00, 126.90, 0.00),
('BAIRON EDUARDO PEREZ', '22224004', '123456-4', 1500.00, 0.00, 0.00),
('AMALIA DE LEON DE LA CRUZ', '11115005', '123456-5', 3000.00, 0.00, 0.00),
('YENIFER SALOME PEREZ XIQUIN', '66666006', '123456-6', 1000.00, 0.00, 0.00),
('SINDY LISET GALINDO', '77777007', '123456-7', 1500.00, 0.00, 0.00),
('DEIBI ALEXANDER HERRERA', '88888008', '123456-8', 2000.00, 0.00, 0.00),
('MISHEL VALDEZ', '99999009', '123456-9', 1000.00, 0.00, 0.00),
('JUANITA ESCOBAR', '00000010', '123456-0', 1000.00, 0.00, 0.00),
('HECTOR MEJIA', '11223344', '112233-4', 1500.00, 0.00, 0.00),
('EDRAS LOPEZ', '44332211', '443322-1', 2000.00, 0.00, 0.00),
('ISRAEL NEHEMIAS LOPEZ', '55667788', '556677-8', 5000.00, 81.00, 0.00),
('LUIS ENRIQUE CAST...', '99887766', '998877-6', 3000.00, 213.30, 0.00),
('JUAQUIN ABELINO YAC LAINEZ', '12312312', '123123-1', 1000.00, 0.00, 0.00),
('ORALIA PEREZ', '45645645', '456456-4', 1000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;
