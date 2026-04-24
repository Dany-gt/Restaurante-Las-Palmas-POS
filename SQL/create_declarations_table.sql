-- ═══════════════════════════════════════════════════════════
-- TABLA DE DECLARACIONES FISCALES (IVA / ISR)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accounting_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'IVA', -- 'IVA', 'ISR'
  is_declared BOOLEAN DEFAULT FALSE,
  declared_at TIMESTAMPTZ,
  declared_by TEXT, -- UUID or Name
  metadata JSONB DEFAULT '{}'::jsonb, -- Guardar montos finales al declarar
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, period_month, period_year, tax_type)
);

-- Habilitar RLS
ALTER TABLE accounting_declarations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON accounting_declarations;
CREATE POLICY "Allow all for authenticated" ON accounting_declarations FOR ALL USING (true) WITH CHECK (true);
