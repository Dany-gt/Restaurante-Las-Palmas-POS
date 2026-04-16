-- CORRECCIÓN DE ESTRUCTURA DE CAJAS
-- RESTAURANTE LAS PALMAS POS
-- ============================================

-- 1. Agregar columnas faltantes a cash_registers si no existen
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'closed';
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS last_closure_at TIMESTAMP WITH TIME ZONE;

-- 2. Insertar Caja Principal si no existe (usando DO block para evitar duplicados complejos)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cash_registers WHERE name = 'Caja Principal') THEN
        INSERT INTO cash_registers (name, is_active, status) 
        VALUES ('Caja Principal', true, 'closed');
    END IF;
END $$;

SELECT 'Base de datos de cajas corregida.' as resultado;
