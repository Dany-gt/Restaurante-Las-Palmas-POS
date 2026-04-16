-- ==============================================================================
-- HABILITAR LÓGICA DE DESCUENTOS
-- ==============================================================================

-- 1. Crear la tabla de catálogo de descuentos (si no existe)
CREATE TABLE IF NOT EXISTS public.discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Asegurar que haya descuentos configurados
-- Borramos los por defecto anteriores para evitar duplicados si se corre varias veces (por nombre)
DELETE FROM public.discounts WHERE name IN ('Cortesía Casa', 'Descuento Empleado', 'Error en Cocina', 'Promoción Especial', 'Tercera Edad');

INSERT INTO public.discounts (name, percentage, is_active)
VALUES 
    ('Cortesía Casa', 100.00, true),
    ('Descuento Empleado', 50.00, true),
    ('Error en Cocina', 100.00, true),
    ('Promoción Especial', 15.00, true),
    ('Tercera Edad', 25.00, true);

-- 3. Modificar la tabla de Órdenes para soportar el descuento
-- Agregamos las columnas necesarias. Si ya existen, no pasará nada.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES public.discounts(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;

-- 4. Habilitar políticas de seguridad (RLS) para que el POS pueda leer los descuentos
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura para todos" ON public.discounts;
CREATE POLICY "Permitir lectura para todos" ON public.discounts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir todo para roles internos" ON public.discounts;
CREATE POLICY "Permitir todo para roles internos" ON public.discounts FOR ALL USING (true) WITH CHECK (true);

-- 5. Crear índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_orders_discount_id ON public.orders(discount_id);

SELECT 'Sistema de descuentos habilitado correctamente' as status;
