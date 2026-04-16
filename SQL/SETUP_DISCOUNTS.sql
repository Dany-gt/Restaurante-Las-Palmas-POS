-- ==============================================================================
-- SCRIPT DE CONFIGURACIÓN DE DESCUENTOS Y ACTUALIZACIÓN DE ÓRDENES
-- ==============================================================================

-- 1. CREAR TABLA DE DESCUENTOS
CREATE TABLE IF NOT EXISTS public.discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    percentage DECIMAL(5,2) NOT NULL, -- Porcentaje del descuento (10, 50, 100)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar seguridad (RLS)
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for discounts" ON public.discounts;
CREATE POLICY "Allow all for discounts" ON public.discounts FOR ALL USING (true) WITH CHECK (true);

-- 2. INSERTAR DESCUENTOS POR DEFECTO (Si no existen)
INSERT INTO public.discounts (name, percentage, is_active)
VALUES 
    ('Cortesía Casa', 100.00, true),
    ('Descuento Empleado', 50.00, true),
    ('Error en Cocina', 100.00, true),
    ('Promoción Especial', 15.00, true),
    ('Tercera Edad', 25.00, true)
ON CONFLICT DO NOTHING; -- Nota: Esto funciona si hubiera constraint unique, pero como ID es UUID, insertará duplicados si se corre varias veces sin unique. 
-- Para evitar duplicados en inserción masiva simple:
DELETE FROM public.discounts WHERE name IN ('Cortesía Casa', 'Descuento Empleado', 'Error en Cocina', 'Promoción Especial', 'Tercera Edad');
INSERT INTO public.discounts (name, percentage, is_active)
VALUES 
    ('Cortesía Casa', 100.00, true),
    ('Descuento Empleado', 50.00, true),
    ('Error en Cocina', 100.00, true),
    ('Promoción Especial', 15.00, true),
    ('Tercera Edad', 25.00, true);


-- 3. ACTUALIZAR TABLA DE ÓRDENES
-- Aseguramos que la tabla orders tenga las columnas para guardar la info del descuento aplicado
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_id UUID REFERENCES public.discounts(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;

-- 4. ÍNDICES PARA BUSQUEDA
CREATE INDEX IF NOT EXISTS idx_orders_discount_id ON public.orders(discount_id);

SELECT 'Tabla de descuentos configurada y tabla de órdenes actualizada.' as mensaje;
