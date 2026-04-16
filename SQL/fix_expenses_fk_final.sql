-- ==============================================================================
-- FIX: CORRECCIÓN DE RESTRICCIÓN DE CLAVE FORÁNEA (FOREIGN KEY)
-- El error indica que el usuario actual no existe en la tabla auth.users.
-- Esto sucede a menudo si el usuario es un perfil de prueba creado manualmente.
-- Solución: Cambiar la referencia para que apunte a public.profiles en lugar de auth.users.
-- ==============================================================================

do $$
begin
    -- 1. Intentar eliminar la restricción problemática existente
    begin
        alter table public.expenses drop constraint if exists "expenses_cashier_id_fkey";
    exception when others then
        raise notice 'La restricción no existía o no se pudo borrar';
    end;

    -- 2. Crear la nueva restricción apuntando a public.profiles
    -- Esto permite que funcionen los usuarios que solo existen en profiles
    alter table public.expenses
    add constraint "expenses_cashier_id_fkey"
    foreign key (cashier_id)
    references public.profiles(id);

end $$;

-- Recargar configuración
NOTIFY pgrst, 'reload config';
