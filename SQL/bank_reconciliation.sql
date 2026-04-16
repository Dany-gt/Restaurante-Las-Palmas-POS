-- BANCOS COMPATIBLES — GUATEMALA
-- SQL MIGRATION FOR BANK RECONCILIATION

CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  banco TEXT,
  periodo_mes INTEGER,
  periodo_anio INTEGER,
  saldo_inicial NUMERIC(14,2),
  saldo_final NUMERIC(14,2),
  total_debitos NUMERIC(14,2),
  total_creditos NUMERIC(14,2),
  archivo_nombre TEXT,
  procesado_fecha TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  statement_id UUID REFERENCES bank_statements(id),
  periodo_mes INTEGER,
  periodo_anio INTEGER,
  banco TEXT,
  fecha_movimiento DATE,
  descripcion_banco TEXT,
  monto NUMERIC(14,2),
  tipo TEXT, -- 'debito' | 'credito'
  referencia_banco TEXT,
  cash_flow_id UUID REFERENCES cash_flow(id),
  estado TEXT DEFAULT 'pendiente', -- 'conciliado'|'pendiente'|'justificado'|'nuevo'
  notas TEXT,
  conciliado_por TEXT,
  conciliado_fecha TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance on cross-referencing
CREATE INDEX IF NOT EXISTS idx_reconcil_period ON bank_reconciliation(periodo_anio, periodo_mes, banco);
CREATE INDEX IF NOT EXISTS idx_reconcil_cashflow ON bank_reconciliation(cash_flow_id);
