-- ========================================================
-- REFORZAMIENTO DEL SISTEMA DE AUDITORÍA (INMUTABLE)
-- RESTAURANTE LAS PALMAS POS
-- ========================================================

-- 1. Crear la tabla principal de auditoría
CREATE TABLE IF NOT EXISTS public.activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_hora      TIMESTAMPTZ DEFAULT NOW(),

  -- Usuario
  usuario_id      UUID REFERENCES public.profiles(id),
  usuario_nombre  TEXT,
  usuario_rol     TEXT,  -- 'ADMIN' | 'CAJERO' | 'MESERO'

  -- Evento
  modulo          TEXT,  -- 'VENTAS' | 'CAJAS' | 'FACTURACION' | etc.
  accion          TEXT,  -- 'ORDEN_CREADA' | 'INGRESO_CAJA' | etc.

  -- Impacto financiero (opcional)
  es_financiero   BOOLEAN DEFAULT FALSE,
  impacto_tipo    TEXT,  -- 'INGRESO' | 'EGRESO' | NULL
  impacto_monto   NUMERIC(10,2),

  -- Datos del evento (flexible)
  atributos       JSONB DEFAULT '{}',

  -- Trazabilidad
  ip_origen       TEXT,
  dispositivo     TEXT,

  -- Inmutabilidad
  es_inmutable    BOOLEAN DEFAULT TRUE
);

-- 2. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_log_fecha    ON public.activity_log(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_log_usuario  ON public.activity_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_accion   ON public.activity_log(accion);
CREATE INDEX IF NOT EXISTS idx_log_modulo   ON public.activity_log(modulo);

-- 3. Reglas de Inmutabilidad (RLS y Permisos)
-- Nadie puede borrar ni editar registros
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura a usuarios autenticados
CREATE POLICY "Allow select for authenticated" ON public.activity_log
    FOR SELECT TO authenticated USING (true);

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "Allow insert for authenticated" ON public.activity_log
    FOR INSERT TO authenticated WITH CHECK (true);

-- Revocar permisos de modificación/borrado (Doble capa de seguridad)
REVOKE DELETE ON public.activity_log FROM authenticated;
REVOKE UPDATE ON public.activity_log FROM authenticated;
REVOKE DELETE ON public.activity_log FROM anon;
REVOKE UPDATE ON public.activity_log FROM anon;

-- Solo INSERT y SELECT están permitidos
GRANT INSERT ON public.activity_log TO authenticated;
GRANT SELECT ON public.activity_log TO authenticated;

-- 4. Vista de compatibilidad para el dashboard actual (opcional pero recomendado)
DROP TABLE IF EXISTS public.activity_log_detailed CASCADE;
CREATE OR REPLACE VIEW public.activity_log_detailed AS
SELECT 
    id,
    fecha_hora as timestamp,
    usuario_id,
    usuario_nombre,
    usuario_rol,
    modulo,
    accion,
    atributos as metadata,
    impacto_monto,
    impacto_tipo,
    ip_origen as user_ip,
    dispositivo as user_dispositivo
FROM public.activity_log;
