-- Solo crea las tablas de auditoría contable y estado de resultados/balance general si no existen (idempotente)

CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',
  periodo_mes INTEGER NOT NULL,
  periodo_anio INTEGER NOT NULL,
  codigo_cuenta TEXT NOT NULL,
  nombre_cuenta TEXT NOT NULL,
  seccion TEXT NOT NULL,
  monto NUMERIC(14,2) DEFAULT 0,
  es_automatico BOOLEAN DEFAULT false,
  fuente TEXT DEFAULT 'manual',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, periodo_mes, periodo_anio, codigo_cuenta)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periodo
  ON accounting_entries(periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_accounting_codigo
  ON accounting_entries(codigo_cuenta);
