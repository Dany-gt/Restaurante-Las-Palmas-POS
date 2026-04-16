-- 1. Actualizar tabla CUSTOMERS
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone2 TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT; -- Observaciones del cliente
ALTER TABLE customers ADD COLUMN IF NOT EXISTS reference TEXT; -- Referencia (opcional, si se guarda en cliente)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT; -- Ciudad (opcional, si se guarda en cliente)

-- Asegurar que existan campos monetarios
ALTER TABLE customers ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0;

-- 2. Actualizar (o crear) tabla CUSTOMER_ADDRESSES
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT DEFAULT 'Principal', -- Casa, Oficina, etc.
    address TEXT NOT NULL,
    reference TEXT,
    city TEXT,
    zone TEXT,
    coordinates TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Si la tabla ya existía, asegurar columnas
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS zone TEXT;
