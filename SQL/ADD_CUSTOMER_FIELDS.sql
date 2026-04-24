-- ============================================
-- AGREGAR COLUMNAS FALTANTES A CUSTOMERS
-- Ejecutar en SQL Editor de Supabase
-- ============================================

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS phone2 TEXT,
ADD COLUMN IF NOT EXISTS reference TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Verificar si existe credit_limit (por si acaso no se ejecutó antes)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0;

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0;

SELECT 'Columnas agregadas correctamente a customers' as resultado;
