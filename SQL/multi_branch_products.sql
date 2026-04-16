-- 1. Modify products table to add specific fields
ALTER TABLE IF EXISTS products 
ADD COLUMN IF NOT EXISTS product_code VARCHAR(255),
ADD COLUMN IF NOT EXISTS short_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0.00;

-- 2. Create product_branch_prices table for branch-specific pricing
CREATE TABLE IF NOT EXISTS product_branch_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    delivery_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    platform_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_assigned BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, branch_id)
);

-- Note: Ensure RLS is configured appropriately if needed. 
-- By default allowing all authenticated actions for admin usage.
ALTER TABLE product_branch_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users" ON product_branch_prices;
CREATE POLICY "Allow all public users" ON product_branch_prices 
FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Initial migration script: For every existing product, create an entry in product_branch_prices for the MAIN branch.
DO $$
DECLARE
    main_branch_id UUID;
BEGIN
    -- Get the main branch ID
    SELECT id INTO main_branch_id FROM branches WHERE is_main = true LIMIT 1;
    
    -- If there's a main branch, insert prices for all products
    IF main_branch_id IS NOT NULL THEN
        INSERT INTO product_branch_prices (product_id, branch_id, price, delivery_price, platform_price, is_enabled, is_assigned)
        SELECT p.id, main_branch_id, p.price, p.price, p.price, p.is_enabled, true
        FROM products p
        ON CONFLICT (product_id, branch_id) DO NOTHING;
    END IF;
END $$;
