-- ========================================================
-- MIGRACIÓN DE DATOS HISTÓRICOS AL NUEVO LOG
-- ========================================================

-- Insertar desde la tabla legacy activity_logs
INSERT INTO public.activity_log (
    fecha_hora,
    usuario_id,
    usuario_nombre,
    usuario_rol,
    modulo,
    accion,
    atributos,
    es_inmutable
)
SELECT 
    created_at,
    user_id,
    user_name,
    user_role,
    module,
    action,
    details,
    true
FROM public.activity_logs
ON CONFLICT DO NOTHING;

-- Si existía data en activity_log_detailed antes de borrarla (y si hiciste backup)
-- se podría insertar aquí también. 
-- Pero por ahora recuperamos lo principal de activity_logs.
