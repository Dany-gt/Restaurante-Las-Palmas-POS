-- ═══════════════════════════════════════════════════════════
-- CONFIGURACIÓN DE REPORTES CONTABLES — LAS PALMAS POS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accounting_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default' UNIQUE,
  proprietor_name TEXT DEFAULT 'Cevicheria y Restaurante Las Palmas, S.A.',
  proprietor_title TEXT DEFAULT 'Propietario / Representante Legal',
  accountant_name TEXT DEFAULT 'Licda. Carmen Hernández',
  accountant_title TEXT DEFAULT 'Contador Público y Auditor',
  accountant_reg TEXT DEFAULT 'Registrada SAT No. 2597453K',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar valores por defecto para Las Palmas
INSERT INTO accounting_config (org_id, proprietor_name, proprietor_title, accountant_name, accountant_title, accountant_reg)
VALUES (
  'default',
  'Cevicheria y Restaurante Las Palmas, S.A.',
  'Propietario / Representante Legal',
  'Licda. Carmen Hernández',
  'Contador Público y Auditor',
  'Registrada SAT No. 2597453K'
)
ON CONFLICT (org_id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE accounting_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON accounting_config;
CREATE POLICY "Allow all for authenticated" ON accounting_config FOR ALL USING (true) WITH CHECK (true);
