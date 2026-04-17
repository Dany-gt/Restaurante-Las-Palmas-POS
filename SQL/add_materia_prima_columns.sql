-- Agrega las columnas necesarias a la tabla 'products' para soportar Materia Prima
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_category_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS presentation_unit TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(10,4) DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS es_platillo BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_actual DECIMAL(10,2) DEFAULT 0;
