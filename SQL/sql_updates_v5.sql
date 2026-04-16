-- ==============================================================================
-- ACTUALIZACIÓN V5 - MANTENIMIENTO Y ESTRUCTURA DE ROLES/ORDENES
-- Ejecuta este script para asegurar que la base de datos soporte todas
-- las funcionalidades recientes (PAX, Permisos Granulares).
-- ==============================================================================

BEGIN;

-- 1. ASEGURAR COLUMNA 'PAX_COUNT' EN ORDENES
-- Usada para registrar el número de personas por mesa
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'pax_count') then
        alter table public.orders add column pax_count integer default 1;
    end if;
end $$;

-- 2. SISTEMA DE PERMISOS GRANULARES (ROLES)
-- Asegurar que la tabla roles tenga columna de permisos
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'roles' and column_name = 'permissions') then
        alter table public.roles add column permissions jsonb default '[]'::jsonb;
    end if;
end $$;

-- 3. ACTUALIZAR PERMISOS PREDETERMINADOS
-- Asignar permisos explícitos a los roles principales
update public.roles 
set permissions = '["Cajas:Acceso", "Cajero:Aplicar Descuentos", "Ordenes:Editar", "Ordenes:Eliminar"]'::jsonb
where name = 'ADMIN';

update public.roles 
set permissions = '["Cajas:Acceso", "Cajero:Aplicar Descuentos"]'::jsonb
where name = 'CAJERO';

update public.roles 
set permissions = '[]'::jsonb
where name = 'MESERO';

-- 4. REPARACIÓN DE GASTOS (Recordatorio de seguridad)
-- Solo por si no se ejecutó el V4 anteriormente
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'cashier_id') then
        alter table public.expenses add column cashier_id uuid references public.profiles(id);
    end if;
end $$;


COMMIT;

-- Notificar recarga
NOTIFY pgrst, 'reload config';
