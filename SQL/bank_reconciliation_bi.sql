-- DATABASE — TABLAS INTERBANKING
-- SQL MIGRATION FOR BANCO INDUSTRIAL (BI)

CREATE TABLE IF NOT EXISTS bank_reconciliation_bi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  
  -- Datos exactos del XLS InterBanking
  banco TEXT DEFAULT 'Banco Industrial',
  secuencia INTEGER,
  fecha_movimiento TIMESTAMPTZ,
  descripcion TEXT,
  numero_doc TEXT,
  valor NUMERIC(14,2),
  codigo_transaccion INTEGER,
  tipo_transaccion INTEGER,
  nombre_agencia TEXT,
  agencia INTEGER,
  saldo_contable NUMERIC(14,2),
  fecha_valor TIMESTAMPTZ,
  saldo_disponible NUMERIC(14,2),
  signo TEXT, -- '+' | '-'
  cuenta_origen TEXT,
  adenda TEXT,
  
  -- Campos calculados
  tipo TEXT, -- 'credito' | 'debito'
  monto_real NUMERIC(14,2),
  -- valor con signo aplicado
  categoria TEXT,
  tipo_registro TEXT,
  requiere_revision BOOLEAN DEFAULT false,
  
  -- Conciliación
  estado TEXT DEFAULT 'pendiente',
  -- 'conciliado'|'pendiente'|'justificado'|'ignorar'
  referencia_sistema TEXT,
  -- ID del registro en el sistema que coincide
  tabla_referencia TEXT,
  -- 'ventas'|'payroll'|'purchase_invoices'|'cash_flow'
  porcentaje_coincidencia INTEGER,
  
  -- Contabilidad
  cuenta_contable TEXT,
  asiento_id UUID,
  
  -- Control
  periodo_mes INTEGER,
  periodo_anio INTEGER,
  archivo_origen TEXT,
  conciliado_por TEXT,
  conciliado_fecha TIMESTAMPTZ,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resumen por periodo
CREATE TABLE IF NOT EXISTS bank_reconciliation_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  banco TEXT DEFAULT 'Banco Industrial',
  cuenta TEXT DEFAULT '81-0044302-5',
  periodo_mes INTEGER,
  periodo_anio INTEGER,
  saldo_inicial NUMERIC(14,2),
  saldo_final_banco NUMERIC(14,2),
  saldo_final_sistema NUMERIC(14,2),
  diferencia NUMERIC(14,2),
  total_creditos NUMERIC(14,2),
  total_debitos NUMERIC(14,2),
  movimientos_totales INTEGER,
  movimientos_conciliados INTEGER,
  movimientos_pendientes INTEGER,
  estado TEXT DEFAULT 'en_proceso',
  -- 'en_proceso'|'completado'|'aprobado'
  aprobado_por TEXT,
  aprobado_fecha TIMESTAMPTZ,
  archivo_xls_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, periodo_mes, periodo_anio)
);

CREATE INDEX IF NOT EXISTS idx_reconcil_bi_period ON bank_reconciliation_bi(periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_reconcil_bi_estado ON bank_reconciliation_bi(estado);
