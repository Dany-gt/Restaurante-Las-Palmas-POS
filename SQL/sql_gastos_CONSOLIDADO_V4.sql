-- ==============================================================================
-- SCRIPT CONSOLIDADO FINAL - MÓDULO DE GASTOS (V4)
-- Este script reúne TODAS las correcciones y estructuras necesarias.
-- Es seguro ejecutarlo aunque ya hayas corrido los parches anteriores.
-- Asegura:
-- 1. Tablas y columnas completas.
-- 2. Claves foráneas correctas (apuntando a profiles).
-- 3. Permisos de seguridad (RLS) compatibles con la estructura actual.
-- ==============================================================================

BEGIN;

-- 1. TABLA DE CATEGORÍAS DE GASTOS
create table if not exists public.expense_categories (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text not null unique,
  is_active boolean default true
);

alter table public.expense_categories enable row level security;

-- Políticas de Seguridad para Categorías (Limpieza y Re-creación)
drop policy if exists "Permitir lectura de categorías activas a todos los autenticados" on public.expense_categories;
drop policy if exists "Permitir gestión de categorías a administradores y cajeros" on public.expense_categories;

create policy "Permitir lectura de categorías activas a todos los autenticados"
  on public.expense_categories for select to authenticated using (true);

create policy "Permitir gestión de categorías a administradores y cajeros"
  on public.expense_categories for all to authenticated
  using (
    auth.jwt() ->> 'role' = 'service_role' OR
    (select role from public.profiles where id = auth.uid()) in ('ADMIN', 'CAJERO') OR
    (exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and r.permissions @> '["Cajas:Acceso"]'::jsonb
    ))
  );


-- 2. TABLA DE GASTOS (EXPENSES) Y COLUMNAS
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  amount numeric(10,2) not null,
  category text,
  description text,
  items jsonb default '[]'::jsonb
);

-- Asegurar columnas adicionales (Idempotente)
do $$
begin
    -- cashier_id
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'cashier_id') then
        alter table public.expenses add column cashier_id uuid;
    end if;
    -- cash_register_id
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'cash_register_id') then
        alter table public.expenses add column cash_register_id uuid references public.cash_registers(id);
    end if;
    -- shift_id
    if not exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'shift_id') then
        alter table public.expenses add column shift_id uuid references public.shifts(id);
    end if;
end $$;

-- CORRECCIÓN DE CLAVE FORÁNEA (FOREIGN KEY) PARA CASHIER_ID
-- Aseguramos que apunte a public.profiles para evitar errores con usuarios creados manualmente
do $$
begin
    -- Intentar borrar constraint incorrecta si existe
    begin
        alter table public.expenses drop constraint if exists "expenses_cashier_id_fkey";
    exception when others then null; end;

    -- Agregar la constraint correcta si no existe ya
    if not exists (
        select 1 from information_schema.table_constraints 
        where constraint_name = 'expenses_cashier_id_fkey' 
        and table_name = 'expenses'
    ) then
        alter table public.expenses
        add constraint "expenses_cashier_id_fkey"
        foreign key (cashier_id)
        references public.profiles(id);
    end if;
end $$;


-- Políticas de Seguridad para Gastos
alter table public.expenses enable row level security;

drop policy if exists "Permitir ver gastos a admins y cajeros" on public.expenses;
drop policy if exists "Permitir insertar gastos a usuarios autorizados" on public.expenses;
drop policy if exists "Permitir eliminar gastos solo a admins" on public.expenses;

create policy "Permitir ver gastos a admins y cajeros"
  on public.expenses for select to authenticated using (true);

create policy "Permitir insertar gastos a usuarios autorizados"
  on public.expenses for insert to authenticated
  with check (
    auth.jwt() ->> 'role' = 'service_role' OR
    (select role from public.profiles where id = auth.uid()) in ('ADMIN', 'CAJERO') OR
    (exists (
      select 1 from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and r.permissions @> '["Cajas:Acceso"]'::jsonb
    ))
  );

create policy "Permitir eliminar gastos solo a admins"
  on public.expenses for delete to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'ADMIN'
  );


-- 3. ACTUALIZACIÓN DE TABLA DE CAJAS
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'cash_registers' and column_name = 'current_balance') then
        alter table public.cash_registers add column current_balance numeric(10,2) default 0;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'cash_registers' and column_name = 'status') then
        alter table public.cash_registers add column status text default 'closed';
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'cash_registers' and column_name = 'last_closure_at') then
        alter table public.cash_registers add column last_closure_at timestamptz;
    end if;
end $$;


-- 4. INSERTAR CATEGORÍAS DEFAULT
insert into public.expense_categories (name, is_active)
values 
  ('PROVEEDORES', true), ('LIMPIEZA', true), ('PERSONAL', true), 
  ('MANTENIMIENTO', true), ('TRANSPORTE', true), ('INSUMOS', true), ('VARIOS', true)
on conflict (name) do nothing;


COMMIT;

-- Notificar recarga de cambios
NOTIFY pgrst, 'reload config';
