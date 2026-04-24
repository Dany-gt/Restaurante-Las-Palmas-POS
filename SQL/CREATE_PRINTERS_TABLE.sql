-- TABLA DE IMPRESORAS FISICAS
-- Ejecuta este script en el SQL Editor de Supabase

BEGIN;

CREATE TABLE IF NOT EXISTS public.printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    connection_type TEXT DEFAULT 'NETWORK',
    address TEXT, -- IP o Alias
    port INTEGER DEFAULT 9100,
    paper_width TEXT DEFAULT '80mm',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar validaciones
ALTER TABLE public.printers DROP CONSTRAINT IF EXISTS printers_connection_type_check;
ALTER TABLE public.printers ADD CONSTRAINT printers_connection_type_check 
    CHECK (connection_type IN ('NETWORK', 'USB', 'SERIAL', 'BLUETOOTH', 'SYSTEM'));

-- RLS
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for printers" ON public.printers;
CREATE POLICY "Allow all for printers" ON public.printers 
    FOR ALL USING (true) WITH CHECK (true);

COMMIT;

SELECT 'Tabla printers creada con éxito' as mensaje;
