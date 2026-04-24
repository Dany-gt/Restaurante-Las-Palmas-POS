-- ═══════════════════════════════════════════════════════════
-- ACTUALIZACIÓN SCHEMA COMPRAS — CUMPLIMIENTO FISCAL V1.2
-- Restaurante Las Palmas POS
-- ═══════════════════════════════════════════════════════════

-- 1. Agregar campos de auditoría fiscal a purchase_invoices
ALTER TABLE purchase_invoices 
ADD COLUMN IF NOT EXISTS tipo_dte TEXT DEFAULT 'FACT',
ADD COLUMN IF NOT EXISTS fel_uuid TEXT,
ADD COLUMN IF NOT EXISTS idp_monto NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_retenido NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS isr_retenido NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS uuid_referencia TEXT;

-- 2. Indices para búsqueda rápida por FEL
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_invoices_fel_uuid ON purchase_invoices(fel_uuid);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_ref ON purchase_invoices(uuid_referencia);

-- 3. Tabla para registro histórico de retenciones (Legal)
CREATE TABLE IF NOT EXISTS accounting_retentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  retention_type TEXT, -- 'IVA_FESP', 'ISR_FESP', 'ISR_PROV'
  amount NUMERIC NOT NULL,
  declared_month INTEGER,
  declared_year INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- MENSAJE DE CONTROL
-- ═══════════════════════════════════════════════════════════
COMMENT ON TABLE purchase_invoices IS 'Tabla de compras actualizada con campos para precision fiscal de IDP y Retenciones.';
