-- ═══════════════════════════════════════════════════════════
-- MÓDULO DE CONTABILIDAD — LAS PALMAS POS
-- Script SQL completo para Supabase
-- ═══════════════════════════════════════════════════════════

-- 1. Facturas de compra (crédito fiscal)
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  invoice_date DATE NOT NULL,
  supplier_nit TEXT,
  supplier_name TEXT,
  invoice_number TEXT,
  description TEXT,
  total_amount NUMERIC DEFAULT 0,
  iva_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'otros',
  payment_status TEXT DEFAULT 'pending',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Proveedores
CREATE TABLE IF NOT EXISTS accounting_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  nit TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  products TEXT,
  credit_days INTEGER DEFAULT 0,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Flujo de caja
CREATE TABLE IF NOT EXISTS cash_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  flow_date DATE NOT NULL,
  concept TEXT,
  category TEXT,
  flow_type TEXT DEFAULT 'exit', -- 'entry' | 'exit'
  entry_amount NUMERIC DEFAULT 0,
  exit_amount NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Declaraciones fiscales (IVA, ISR, IGSS)
CREATE TABLE IF NOT EXISTS tax_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  tax_type TEXT NOT NULL, -- 'IVA' | 'ISR_Q1' | 'ISR_Q2' | 'ISR_Q3' | 'ISR_Q4' | 'ISR_ANNUAL' | 'IGSS'
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  amount_due NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  due_date DATE,
  payment_date DATE,
  status TEXT DEFAULT 'pending', -- 'pending' | 'paid' | 'overdue'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Planilla de empleados
CREATE TABLE IF NOT EXISTS payroll_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  full_name TEXT NOT NULL,
  position TEXT,
  department TEXT,
  base_salary NUMERIC DEFAULT 3816.90,
  start_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Pagos mensuales de planilla
CREATE TABLE IF NOT EXISTS payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  igss_employee NUMERIC DEFAULT 0,
  bonificacion NUMERIC DEFAULT 250,
  other_deductions NUMERIC DEFAULT 0,
  net_pay NUMERIC DEFAULT 0,
  paid_date DATE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- ÍNDICES
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org ON purchase_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON cash_flow(flow_date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_org ON cash_flow(org_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_type ON tax_declarations(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_org ON tax_declarations(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employees_org ON payroll_employees(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_period ON payroll_payments(period_month, period_year);

-- ═══════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust per org later)
DROP POLICY IF EXISTS "Allow all for authenticated" ON purchase_invoices;
CREATE POLICY "Allow all for authenticated" ON purchase_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON accounting_suppliers;
CREATE POLICY "Allow all for authenticated" ON accounting_suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON cash_flow;
CREATE POLICY "Allow all for authenticated" ON cash_flow FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON tax_declarations;
CREATE POLICY "Allow all for authenticated" ON tax_declarations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON payroll_employees;
CREATE POLICY "Allow all for authenticated" ON payroll_employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated" ON payroll_payments;
CREATE POLICY "Allow all for authenticated" ON payroll_payments FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════
-- SEED DATA: Empleados iniciales Las Palmas
-- ═══════════════════════════════════════════════════════════

INSERT INTO payroll_employees (full_name, position, department, base_salary, is_active)
VALUES
  ('Danilo Estuardo Perez', 'Aux. Admin', 'Administración', 3816.90, true),
  ('Sindi Liseth Galindo', 'Cocinera', 'Cocina', 3816.90, true),
  ('Juanita Elvira Escobar Lopez', 'Cocinera', 'Cocina', 3816.90, true),
  ('Amalia De Leon De La Cruz', 'Cocinera', 'Cocina', 3816.90, true),
  ('Mariela Azucely Ovando Flores', 'Cocinera', 'Cocina', 3816.90, true),
  ('Yenifer Salome Xiquin', 'Cocinera', 'Cocina', 3816.90, true),
  ('Mario Eliseo Castro', 'Cevichero', 'Cevichería', 3816.90, true),
  ('Bairon Eduardo Perez Xiquin', 'Cevichero', 'Cevichería', 3816.90, true),
  ('Israel Nehemias Lopez', 'Preparador', 'Cocina', 3816.90, true),
  ('Nidia Yamilet Fuego', 'Mesera', 'Salón', 3816.90, true),
  ('Cynthia Mishel Valdes Gonzalez', 'Mesera', 'Salón', 3816.90, true),
  ('Luis Enrique Castro Hernandez', 'Mesero', 'Salón', 3816.90, true),
  ('Edras Lopez', 'Mesero', 'Salón', 3816.90, true),
  ('Marcelo Castro', 'Mesero', 'Salón', 3816.90, true),
  ('Joaquin Abelino Yac', 'Jardinero', 'Mantenimiento', 3816.90, true)
ON CONFLICT DO NOTHING;
