-- Table for Purchases
CREATE TABLE IF NOT EXISTS inventory_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id),
    supplier_id UUID REFERENCES suppliers(id),
    user_id UUID REFERENCES auth.users(id),
    doc_type TEXT NOT NULL, -- Factura, Orden de Compra, etc.
    doc_number TEXT NOT NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_condition TEXT CHECK (payment_condition IN ('CONTADO', 'CREDITO')),
    status TEXT NOT NULL DEFAULT 'PROCESADO' CHECK (status IN ('PROCESADO', 'ANULADO')),
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Purchase Items (Details)
CREATE TABLE IF NOT EXISTS inventory_purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES inventory_purchases(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id),
    quantity DECIMAL(12,4) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchases_branch ON inventory_purchases(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON inventory_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON inventory_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON inventory_purchase_items(purchase_id);
