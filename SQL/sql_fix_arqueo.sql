-- ==============================================================================
-- ACTUALIZACIÓN PARA CIERRE CIEGO Y AUDITORÍA DE CAJA
-- Ejecuta este script para añadir las columnas necesarias a la tabla 'shifts'
-- ==============================================================================

BEGIN;

-- 1. Añadir columnas de auditoría si no existen
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

COMMIT;
