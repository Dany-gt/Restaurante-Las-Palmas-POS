-- ========================================================
-- AGREGAR COLUMNA ACCION_DESCRIPCION A ACTIVITY_LOG
-- NECESARIO PARA EL SISTEMA DE NOTIFICACIONES
-- ========================================================

-- 1. Agregar columna a la tabla base
ALTER TABLE public.activity_log 
ADD COLUMN IF NOT EXISTS accion_descripcion TEXT;

-- 2. Actualizar la vista detallada para incluir la nueva columna
DROP VIEW IF EXISTS public.activity_log_detailed;
CREATE OR REPLACE VIEW public.activity_log_detailed AS
SELECT 
    id,
    fecha_hora as timestamp,
    usuario_id,
    usuario_nombre,
    usuario_rol,
    modulo,
    accion,
    accion_descripcion, -- Nueva columna incluida
    atributos as metadata,
    impacto_monto,
    impacto_tipo,
    ip_origen as user_ip,
    dispositivo as user_dispositivo
FROM public.activity_log;

-- 3. Asegurar que los permisos se mantengan en la vista
GRANT SELECT ON public.activity_log_detailed TO anon;
GRANT SELECT ON public.activity_log_detailed TO authenticated;
