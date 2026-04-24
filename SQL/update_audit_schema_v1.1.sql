-- ═══════════════════════════════════════════════════════════
-- ACTUALIZACIÓN DE ESQUEMA: AUDITORÍA SAT V1.1
-- ═══════════════════════════════════════════════════════════

-- 1. Actualizar tabla principal de auditoría
ALTER TABLE historico_auditoria_sat 
ADD COLUMN IF NOT EXISTS iva_retenido NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS uuid_referencia TEXT;

-- 2. Crear tabla de retenciones legales
CREATE TABLE IF NOT EXISTS accounting_retentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT DEFAULT 'default',
    
    -- Vínculo con el DTE
    uuid_dte TEXT REFERENCES historico_auditoria_sat(uuid_dte),
    supplier_nit TEXT,
    supplier_name TEXT,
    
    -- Datos contables
    fecha_proceso DATE DEFAULT CURRENT_DATE,
    monto_base NUMERIC(12,2),
    isr_retenido NUMERIC(12,2) DEFAULT 0,
    iva_retenido NUMERIC(12,2) DEFAULT 0,
    monto_total_retencion NUMERIC(12,2),
    
    -- Estado de pago a la SAT
    sat_payment_status TEXT DEFAULT 'pending', -- pending | paid
    sat_declaraguate_no TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_retenciones_uuid ON accounting_retentions(uuid_dte);
CREATE INDEX IF NOT EXISTS idx_retenciones_supplier ON accounting_retentions(supplier_nit);

-- RLS
ALTER TABLE accounting_retentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON accounting_retentions;
CREATE POLICY "Allow all for authenticated" ON accounting_retentions FOR ALL USING (true) WITH CHECK (true);
