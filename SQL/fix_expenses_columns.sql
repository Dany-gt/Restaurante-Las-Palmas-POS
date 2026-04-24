-- ==============================================================================
-- SISTEMA DE GESTIÓN DE GASTOS - REPARACIÓN DE TABLA
-- Este script fuerza la creación de las columnas faltantes en la tabla 'expenses'
-- si la tabla ya existía previamente sin ellas.
-- ==============================================================================

do $$
begin
    -- 1. Agregar column 'cash_register_id' si no existe
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'cash_register_id') then
        alter table public.expenses add column cash_register_id uuid references public.cash_registers(id);
    end if;

    -- 2. Agregar column 'shift_id' si no existe
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'shift_id') then
        alter table public.expenses add column shift_id uuid references public.shifts(id);
    end if;

    -- 3. Agregar column 'items' si no existe
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'items') then
        alter table public.expenses add column items jsonb default '[]'::jsonb;
    end if;

    -- 4. Agregar column 'category' si no existe
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'category') then
        alter table public.expenses add column category text;
    end if;

     -- 5. Agregar column 'description' si no existe
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'description') then
        alter table public.expenses add column description text;
    end if;
end $$;

-- NOTIFICAR RECARGA DE SCHEMA (Importante para que Supabase reconozca las nuevas columnas)
NOTIFY pgrst, 'reload config';
