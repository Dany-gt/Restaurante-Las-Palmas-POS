-- ═══════════════════════════════════════════════════════════
-- PERSISTENCIA DE RECIBOS Y HORAS EXTRAS — LAS PALMAS POS
-- ═══════════════════════════════════════════════════════════

-- Tabla para guardar el detalle quincenal de cada empleado
CREATE TABLE IF NOT EXISTS payroll_quincena_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE CASCADE,
  
  -- Periodo: '2026-03' etc.
  period_label TEXT NOT NULL, 
  
  -- Quincena: 1 o 2
  quincena INTEGER NOT NULL CHECK (quincena IN (1, 2)),
  
  -- Datos de trabajo
  overtime_hours NUMERIC DEFAULT 0,
  overtime_note TEXT DEFAULT '',
  
  -- Captura de valores al momento de generar (para historia fiel)
  base_salary_at_time NUMERIC DEFAULT 0,
  igss_deduction_at_time NUMERIC DEFAULT 0,
  bono_incentivo_at_time NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Evitar duplicados para el mismo empleado, mes y quincena
  UNIQUE(employee_id, period_label, quincena)
);

-- RLS
ALTER TABLE payroll_quincena_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON payroll_quincena_records;
CREATE POLICY "Allow all for authenticated" ON payroll_quincena_records FOR ALL USING (true) WITH CHECK (true);

-- Comentario
COMMENT ON TABLE payroll_quincena_records IS 'Registros históricos de pagos quincenales y horas extras para Restaurante Las Palmas';
