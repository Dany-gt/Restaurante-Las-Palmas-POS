-- ==============================================================================
-- SISTEMA DE GESTIÓN DE GASTOS - REPARACIÓN FINAL DE COLUMNAS
-- Agrega 'cashier_id' que faltaba en el script anterior y recarga la caché.
-- ==============================================================================

do $$
begin
    -- 1. Agregar column 'cashier_id' (Fundamental para el error actual)
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'cashier_id') then
        alter table public.expenses add column cashier_id uuid references auth.users(id);
    end if;

    -- 2. Verificaciones extra de seguridad (por si acaso)
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'cash_register_id') then
        alter table public.expenses add column cash_register_id uuid references public.cash_registers(id);
    end if;
     
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'shift_id') then
        alter table public.expenses add column shift_id uuid references public.shifts(id);
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'items') then
        alter table public.expenses add column items jsonb default '[]'::jsonb;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'description') then
       alter table public.expenses add column description text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'category') then
       alter table public.expenses add column category text;
    end if;

end $$;

-- Forzar recarga de la caché de esquema de PostgREST
NOTIFY pgrst, 'reload config';
