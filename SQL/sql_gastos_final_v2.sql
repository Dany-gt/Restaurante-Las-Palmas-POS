-- ==============================================================================
-- SISTEMA DE GESTIÓN DE GASTOS - PATCH CORREGIDO FINAL
-- Corrige el error de relación inexistente "public.profile_permissions"
-- ==============================================================================

-- 1. TABLA DE CATEGORÍAS DE GASTOS
create table if not exists public.expense_categories (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text not null unique,
  is_active boolean default true
);

alter table public.expense_categories enable row level security;

-- Limpiar políticas antiguas si existen para evitar conflictos o duplicados
drop policy if exists "Permitir lectura de categorías activas a todos los autenticados" on public.expense_categories;
drop policy if exists "Permitir gestión de categorías a administradores y cajeros" on public.expense_categories;

-- Nueva Política de Lectura
create policy "Permitir lectura de categorías activas a todos los autenticados"
  on public.expense_categories for select
  to authenticated
  using (true);

-- Nueva Política de Gestión (Insert/Update/Delete)
-- Verifica rol fijo 'ADMIN'/'CAJERO' O permisos en tabla 'roles'
create policy "Permitir gestión de categorías a administradores y cajeros"
  on public.expense_categories for all
  to authenticated
  using (
    -- 1. Super Admin / Service Role
    auth.jwt() ->> 'role' = 'service_role' OR
    -- 2. Rol Básico (String) en Perfil
    (select role from public.profiles where id = auth.uid()) in ('ADMIN', 'CAJERO') OR
    -- 3. Permisos Granulares via Tabla Roles
    (exists (
      select 1 
      from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and 'Cajas:Acceso' = ANY(r.permissions)
    ))
  );


-- 2. TABLA DE GASTOS (EXPENSES)
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  amount numeric(10,2) not null,
  category text not null,
  description text,
  items jsonb default '[]'::jsonb,
  cashier_id uuid references auth.users(id),
  cash_register_id uuid references public.cash_registers(id),
  shift_id uuid references public.shifts(id)
);

alter table public.expenses enable row level security;

-- Limpiar políticas antiguas
drop policy if exists "Permitir ver gastos a admins y cajeros" on public.expenses;
drop policy if exists "Permitir insertar gastos a usuarios autorizados" on public.expenses;
drop policy if exists "Permitir eliminar gastos solo a admins" on public.expenses;

-- Políticas de Gastos
create policy "Permitir ver gastos a admins y cajeros"
  on public.expenses for select
  to authenticated
  using (true);

create policy "Permitir insertar gastos a usuarios autorizados"
  on public.expenses for insert
  to authenticated
  with check (
    auth.jwt() ->> 'role' = 'service_role' OR
    (select role from public.profiles where id = auth.uid()) in ('ADMIN', 'CAJERO') OR
    (exists (
      select 1 
      from public.profiles p
      join public.roles r on p.role_id = r.id
      where p.id = auth.uid()
      and 'Cajas:Acceso' = ANY(r.permissions)
    ))
  );

create policy "Permitir eliminar gastos solo a admins"
  on public.expenses for delete
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'ADMIN'
  );


-- 3. ACTUALIZACIÓN DE TABLA DE CAJAS (CASH_REGISTERS)
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


-- 4. INSERTAR CATEGORÍAS POR DEFECTO
insert into public.expense_categories (name, is_active)
values 
  ('PROVEEDORES', true),
  ('LIMPIEZA', true),
  ('PERSONAL', true),
  ('MANTENIMIENTO', true),
  ('TRANSPORTE', true),
  ('INSUMOS', true),
  ('VARIOS', true)
on conflict (name) do nothing;
