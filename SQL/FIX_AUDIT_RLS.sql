-- ========================================================
-- SOLUCIÓN A ERROR DE RLS EN ACTIVITY_LOG
-- ESTE SCRIPT PERMITE QUE EL POS (ROL ANON) PUEDA 
-- REGISTRAR Y VER EL HISTORIAL DE ACTIVIDAD.
-- ========================================================

-- 1. Otorgar permisos de acceso al rol público/anónimo
GRANT SELECT, INSERT ON public.activity_log TO anon;

-- 2. Crear políticas de RLS específicas para el rol anon
-- Permite ver todos los registros
DROP POLICY IF EXISTS "Allow select for anon" ON public.activity_log;
CREATE POLICY "Allow select for anon" ON public.activity_log
    FOR SELECT TO anon USING (true);

-- Permite insertar nuevos registros
DROP POLICY IF EXISTS "Allow insert for anon" ON public.activity_log;
CREATE POLICY "Allow insert for anon" ON public.activity_log
    FOR INSERT TO anon WITH CHECK (true);

-- 3. Garantizar inmutabilidad (Nadie puede editar ni borrar)
-- Reafirmamos la restricción por seguridad
REVOKE UPDATE, DELETE ON public.activity_log FROM anon;
REVOKE UPDATE, DELETE ON public.activity_log FROM authenticated;

-- 4. Verificar que RLS esté activo
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- NOTA: Ejecute este script en el SQL Editor de Supabase para aplicar los cambios.
