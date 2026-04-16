-- TABLAS PARA DOMICILIO Y PLATAFORMAS
-- Ejecuta este script en el SQL Editor de Supabase

BEGIN;

-- 1. Tabla de Repartidores
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vehicle_info TEXT, -- Ej: Moto Honda, Pickup
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'busy', 'inactive')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Plataformas Externas
CREATE TABLE IF NOT EXISTS public.order_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    commission_percentage DECIMAL(5,2) DEFAULT 0,
    is_connected BOOLEAN DEFAULT true,
    api_key TEXT, -- Opcional para futuras integraciones
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para Repartidores
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for delivery_drivers" ON public.delivery_drivers;
CREATE POLICY "Allow all for delivery_drivers" ON public.delivery_drivers 
    FOR ALL USING (true) WITH CHECK (true);

-- RLS para Plataformas
ALTER TABLE public.order_platforms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for order_platforms" ON public.order_platforms;
CREATE POLICY "Allow all for order_platforms" ON public.order_platforms 
    FOR ALL USING (true) WITH CHECK (true);

-- Insertar datos iniciales si la tabla está vacía
INSERT INTO public.delivery_drivers (name, vehicle_info, status) 
SELECT 'CARLOS GOMEZ', 'MOTO HONDA', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_drivers WHERE name = 'CARLOS GOMEZ');

INSERT INTO public.delivery_drivers (name, vehicle_info, status) 
SELECT 'LUIS TORRES', 'MOTO SUZUKI', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_drivers WHERE name = 'LUIS TORRES');

INSERT INTO public.order_platforms (name, commission_percentage, is_connected)
SELECT 'PEDIDOS YA', 18.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.order_platforms WHERE name = 'PEDIDOS YA');

INSERT INTO public.order_platforms (name, commission_percentage, is_connected)
SELECT 'UBER EATS', 25.00, true
WHERE NOT EXISTS (SELECT 1 FROM public.order_platforms WHERE name = 'UBER EATS');

COMMIT;

SELECT 'Tablas de Logística y Plataformas creadas con éxito' as mensaje;
