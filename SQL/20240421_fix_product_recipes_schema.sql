-- ============================================
-- PARCHE DE COMPATIBILIDAD: product_recipes
-- RESTAURANTE LAS PALMAS POS
-- Asegura que la tabla de recetas soporte las nuevas columnas 
-- del diseño "Premium" (Medida y Cálculo de Costos).
-- ============================================

DO $$ 
BEGIN
    -- 1. Crear la tabla si por alguna razón no existiera (Respaldo de seguridad)
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_recipes') THEN
        CREATE TABLE public.product_recipes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
            inventory_item_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
            quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
            unit_measure TEXT DEFAULT 'Unidad',
            unit_cost NUMERIC(15,2) DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;

    -- 2. Asegurar que la columna 'unit_measure' exista (Columna "Medida")
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_recipes' AND column_name = 'unit_measure') THEN
        ALTER TABLE public.product_recipes ADD COLUMN unit_measure TEXT DEFAULT 'Unidad';
    END IF;

    -- 3. Asegurar que la columna 'unit_cost' exista (Para transparencia de Precios Costos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_recipes' AND column_name = 'unit_cost') THEN
        ALTER TABLE public.product_recipes ADD COLUMN unit_cost NUMERIC(15,2) DEFAULT 0;
    END IF;

    -- 4. Crear índice opcional para optimizar la carga de recetas en el modal
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'product_recipes' AND indexname = 'idx_product_recipes_query') THEN
        CREATE INDEX idx_product_recipes_query ON public.product_recipes(product_id);
    END IF;

END $$;

COMMENT ON TABLE public.product_recipes IS 'Tabla de recetas para platos y productos de producción con soporte para medidas y costos.';
