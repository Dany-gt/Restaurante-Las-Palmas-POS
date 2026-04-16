-- MODULO DE GASTOS AVANZADO
-- =============================================

-- 1. TABLA DE CATEGORIAS DE GASTOS
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for expense_categories" ON expense_categories FOR ALL USING (true) WITH CHECK (true);

-- 2. ACTUALIZAR TABLA DE GASTOS
-- Agregar columna para items (lista de productos del gasto)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- 3. DATOS INICIALES (Categorías comunes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM expense_categories) THEN
        INSERT INTO expense_categories (name) VALUES 
        ('VERDURAS'), ('MERCADO'), ('GASOLINA'), ('LIMPIEZA'), ('DESCARTABLES'), ('PLANILLA'), ('OTROS');
    END IF;
END $$;
