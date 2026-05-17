-- ========================================================
-- DIAGNÓSTICO Y REPARACIÓN DE AUTORIZACIÓN REMOTA
-- ========================================================

-- 1. DIAGNÓSTICO: Ejecuta esto para ver el código actual:
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name IN ('void_item_with_pin', 'cancel_order_with_pin');

-- 2. REPARACIÓN: Ejecuta este bloque para permitir el bypass 'REMOTE'
-- (Copia y pega desde aquí hasta el final)

CREATE OR REPLACE FUNCTION public.void_item_with_pin(
    p_item_id uuid,
    p_admin_pin text,
    p_void_reason text DEFAULT 'Anulado por administración'::text,
    p_voided_at timestamp with time zone DEFAULT now()
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Si es remoto, buscamos el primer admin para el log
    IF p_admin_pin = 'REMOTE' THEN
        SELECT id INTO v_admin_id FROM profiles WHERE role = 'ADMIN' LIMIT 1;
    ELSE
        -- Validación normal por PIN
        SELECT id INTO v_admin_id FROM profiles WHERE pin = p_admin_pin AND role = 'ADMIN';
    END IF;

    IF v_admin_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'PIN incorrecto o usuario no autorizado');
    END IF;

    -- Borrar el item (esto dispara triggers de inventario si existen)
    DELETE FROM order_items WHERE id = p_item_id;

    RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_order_with_pin(
    p_order_id uuid,
    p_admin_pin text,
    p_reason text DEFAULT 'Orden cancelada'::text,
    p_cancelled_at timestamp with time zone DEFAULT now()
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_admin_id uuid;
BEGIN
    IF p_admin_pin = 'REMOTE' THEN
        SELECT id INTO v_admin_id FROM profiles WHERE role = 'ADMIN' LIMIT 1;
    ELSE
        SELECT id INTO v_admin_id FROM profiles WHERE pin = p_admin_pin AND role = 'ADMIN';
    END IF;

    IF v_admin_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'PIN incorrecto o usuario no autorizado');
    END IF;

    UPDATE orders 
    SET status = 'cancelled', 
        cancellation_reason = p_reason,
        cancelled_at = p_cancelled_at,
        cancelled_by = v_admin_id,
        updated_at = p_cancelled_at
    WHERE id = p_order_id;

    RETURN json_build_object('success', true);
END;
$function$;
