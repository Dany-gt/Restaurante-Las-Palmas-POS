-- ==============================================================================
-- SISTEMA DE GESTIÓN DE GASTOS Y CATEGORÍAS - RESTAURANTE LAS PALMAS POS
-- ==============================================================================

-- 1. TABLA DE CATEGORÍAS DE GASTOS
-- Se utiliza para listar las categorías disponibles en el modal de nuevos gastos.
create table if not exists public.expense_categories (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text not null unique, -- Validamos que el nombre sea único
  is_active boolean default true
);

-- Habilitar RLS
alter table public.expense_categories enable row level security;

-- Políticas de Seguridad (RLS) para Categorías
create policy "Permitir lectura de categorías activas a todos los autenticados"
  on public.expense_categories for select
  to authenticated
  using (true);

create policy "Permitir gestión de categorías a administradores y cajeros"
  on public.expense_categories for all
  to authenticated
  using (
    auth.jwt() ->> 'role' = 'service_role' OR
    (select role from public.profiles where id = auth.uid()) in ('ADMIN', 'CAJERO') OR
    (select count(*) from public.profile_permissions 
     where profile_id = auth.uid() 
     and permission = 'Cajas:Acceso') > 0
  );


-- 2. TABLA DE GASTOS (EXPENSES)
-- Almacena el detalle de cada gasto registrado.
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  amount numeric(10,2) not null,
  category text not null, -- Guardamos el nombre de la categoría por simplicidad histórica o referencia
  description text,
  items jsonb default '[]'::jsonb, -- Almacena el array de items {name, price}
  cashier_id uuid references auth.users(id), -- Usuario que registró el gasto
  cash_register_id uuid references public.cash_registers(id), -- Caja afectada
  shift_id uuid references public.shifts(id) -- Turno durante el cual se hizo (Opcional, recomendado)
);

-- Habilitar RLS
alter table public.expenses enable row level security;

-- Políticas de Seguridad (RLS) para Gastos
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
    (select count(*) from public.profile_permissions 
     where profile_id = auth.uid() 
     and permission = 'Cajas:Acceso') > 0
  );

create policy "Permitir eliminar gastos solo a admins"
  on public.expenses for delete
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'ADMIN'
  );


-- 3. ACTUALIZACIÓN DE TABLA DE CAJAS (CASH_REGISTERS)
-- Aseguramos que existan las columnas necesarias para el balance.
-- Nota: Si las columnas ya existen, estos comandos simplemente no harán nada o darán error si no se maneja,
-- pero el 'add column if not exists' es estándar en migraciones robustas. Aquí usaremos bloques do.

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


-- 4. INSERTAR CATEGORÍAS INICIALES (SEMILLA)
-- Insertamos algunas categorías por defecto si no existen
insert into public.expense_categories (name, is_active)
values 
  ('PROVEEDORES', true),
  ('LIMPIEZA', true),
  ('PERSONAL', true),
  ('MANTENIMIENTO', true),
  ('TRANSPORTE', true),
  ('INSUMOS', true),
  ('VARIOS', true)
on conflict (name) do nothing; -- Si ya existen, no hace nada


-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
