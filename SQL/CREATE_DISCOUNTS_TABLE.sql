-- TABLA DE TIPOS DE DESCUENTOS
-- Ejecuta este script en el SQL Editor de Supabase

BEGIN;

CREATE TABLE IF NOT EXISTS public.discount_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    value DECIMAL(10,2) NOT NULL DEFAULT 0,
    type TEXT CHECK (type IN ('PERCENT', 'AMOUNT')) DEFAULT 'PERCENT',
    apply_to TEXT DEFAULT 'TODOS',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.discount_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for discount_types" ON public.discount_types;
CREATE POLICY "Allow all for discount_types" ON public.discount_types 
    FOR ALL USING (true) WITH CHECK (true);

-- Datos iniciales sugeridos
INSERT INTO public.discount_types (name, value, type, apply_to) VALUES
('DESCUENTO CORTESÍA', 100, 'PERCENT', 'TODOS'),
('HAPPY HOUR', 50, 'PERCENT', 'BEBIDAS'),
('VALE Q50', 50, 'AMOUNT', 'TODOS'),
('CLIENTE FRECUENTE', 15, 'PERCENT', 'TODOS')
ON CONFLICT DO NOTHING;

COMMIT;

SELECT 'Tabla discount_types creada con éxito' as mensaje;
