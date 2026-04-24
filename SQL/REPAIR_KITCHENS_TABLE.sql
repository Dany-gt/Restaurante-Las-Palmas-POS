-- SCRIPT DE REPARACIÓN PARA ESTACIONES DE COCINA
-- Ejecuta este script en el SQL Editor de Supabase para corregir errores de creación

BEGIN;

-- 1. Asegurar que la tabla existe con todas las columnas necesarias
CREATE TABLE IF NOT EXISTS public.kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    device_type TEXT DEFAULT 'PRINTER',
    num_copies INTEGER DEFAULT 1,
    is_printer BOOLEAN DEFAULT true,
    is_kds BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    is_assigned_to_branch BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Corregir/Actualizar el constraint de device_type para permitir más opciones
ALTER TABLE public.kitchen_stations DROP CONSTRAINT IF EXISTS kitchen_stations_device_type_check;
ALTER TABLE public.kitchen_stations ADD CONSTRAINT kitchen_stations_device_type_check 
    CHECK (device_type IN ('KDS', 'PRINTER', 'BOTH', 'NONE'));

-- 3. Habilitar RLS y políticas si no existen
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for kitchen_stations" ON public.kitchen_stations;
CREATE POLICY "Allow all for kitchen_stations" ON public.kitchen_stations 
    FOR ALL USING (true) WITH CHECK (true);

COMMIT;

SELECT 'Tabla kitchen_stations reparada con éxito' as mensaje;
