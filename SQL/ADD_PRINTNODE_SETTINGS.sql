-- AGREGAR SOPORTE PARA PRINTNODE
-- Ejecuta este script en el SQL Editor de Supabase

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS printnode_api_key TEXT,
ADD COLUMN IF NOT EXISTS printnode_enabled BOOLEAN DEFAULT false;

-- Permitir RLS para estas columnas (si no está ya habilitado)
-- Generalmente system_settings ya tiene RLS Allow All en este proyecto
