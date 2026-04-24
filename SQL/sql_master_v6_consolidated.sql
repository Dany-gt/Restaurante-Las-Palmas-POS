-- ==============================================================================
-- SCRIPT DE CONSOLIDACIÓN MAESTRO (V6)
-- Este script asegura que tu base de datos en Supabase tenga TODAS las columnas
-- y permisos necesarios para el Arqueo de Caja, Corte Ciego y Auditoría de Gastos.
-- ==============================================================================

BEGIN;

-- 1. ACTUALIZACIÓN TABLA 'SHIFTS' (Arqueo de Caja)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'counted_amount') THEN
        ALTER TABLE public.shifts ADD COLUMN counted_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'difference_amount') THEN
        ALTER TABLE public.shifts ADD COLUMN difference_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'blind_cut') THEN
        ALTER TABLE public.shifts ADD COLUMN blind_cut BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shifts' AND column_name = 'cash_detail') THEN
        ALTER TABLE public.shifts ADD COLUMN cash_detail JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;


-- 2. ACTUALIZACIÓN TABLA 'EXPENSES' (Auditoría y Desglose)
DO $$
BEGIN
    -- Items detallados (JSONB)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'items') THEN
        ALTER TABLE public.expenses ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Relación con el turno
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'shift_id') THEN
        ALTER TABLE public.expenses ADD COLUMN shift_id UUID REFERENCES public.shifts(id);
    END IF;

    -- Campos de Anulación (Void)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'is_void') THEN
        ALTER TABLE public.expenses ADD COLUMN is_void BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'voided_at') THEN
        ALTER TABLE public.expenses ADD COLUMN voided_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'voided_by') THEN
        ALTER TABLE public.expenses ADD COLUMN voided_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;


-- 3. ACTUALIZACIÓN DE PERMISOS (ROLES)
-- Agregamos el permiso "Cajero:Corte Ciego" a los roles que deben tenerlo.
-- Nota: Esto asume que usas el sistema de permisos JSONB en la tabla 'roles'.

-- Admin: Todos los permisos
UPDATE public.roles 
SET permissions = permissions || '["Cajero:Corte Ciego", "Reportes:Acceso", "Gastos:Anular"]'::jsonb
WHERE name = 'ADMIN' AND NOT (permissions @> '["Cajero:Corte Ciego"]'::jsonb);

-- Cajero: Permiso de Corte Ciego por defecto
UPDATE public.roles 
SET permissions = permissions || '["Cajero:Corte Ciego"]'::jsonb
WHERE name = 'CAJERO' AND NOT (permissions @> '["Cajero:Corte Ciego"]'::jsonb);


-- 4. ASEGURAR ESTRUCTURA DE ORDENES (VISTA TABLETA)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'pax_count') THEN
        ALTER TABLE public.orders ADD COLUMN pax_count INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'waiter_id') THEN
        ALTER TABLE public.orders ADD COLUMN waiter_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

COMMIT;

-- Notificar recarga de caché de PostgREST
NOTIFY pgrst, 'reload config';
