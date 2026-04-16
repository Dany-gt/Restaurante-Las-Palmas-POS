-- ═══════════════════════════════════════════════════════════
-- TABLA DE AUDITORÍA HISTÓRICA SAT (DTE)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS historico_auditoria_sat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT DEFAULT 'default',

  -- Identidad digital
  uuid_dte TEXT UNIQUE NOT NULL,
  serie TEXT,
  numero TEXT,
  tipo_dte TEXT, -- FACT, FPEQ, FCAM, FESP, NABN, NDEB, NCRE, RDON, RECI
  tipo_dte_descripcion TEXT,
  fecha_emision DATE,
  fecha_certificacion DATE,

  -- Estado
  estado TEXT DEFAULT 'VIGENTE', -- VIGENTE | ANULADO
  fecha_anulacion DATE,
  motivo_anulacion TEXT,
  afecta_credito_fiscal BOOLEAN DEFAULT true,

  -- Emisor
  emisor_nit TEXT,
  emisor_nombre TEXT,
  emisor_direccion TEXT,
  emisor_tipo_contribuyente TEXT, -- NORMAL | PEQUENO | ESPECIAL
  emisor_giro TEXT, -- COMBUSTIBLE, MATERIA_PRIMA, SUPERMERCADO, etc.
  emisor_giro_confianza TEXT, -- ALTA | MEDIA | BAJA

  -- Receptor
  receptor_nit TEXT,
  receptor_nombre TEXT,

  -- Montos
  moneda TEXT DEFAULT 'GTQ',
  monto_total NUMERIC(12,2),
  monto_base_imponible NUMERIC(12,2),
  iva_monto NUMERIC(12,2),
  iva_credito_fiscal NUMERIC(12,2),
  idp_monto NUMERIC(12,2) DEFAULT 0,
  otros_impuestos NUMERIC(12,2) DEFAULT 0,
  isr_retenido NUMERIC(12,2) DEFAULT 0,
  descuentos NUMERIC(12,2) DEFAULT 0,

  -- Ítems (JSON completo)
  items JSONB,

  -- Clasificación Contable
  clasificacion_compra TEXT, -- GASTO_OPERACION | ACTIVO_FIJO
  categoria_gasto TEXT, -- MATERIA_PRIMA, COMBUSTIBLE, etc.
  cuenta_contable TEXT, -- 5101, 1201, etc.
  cuenta_contable_nombre TEXT,
  requiere_revision_manual BOOLEAN DEFAULT false,

  -- Proveedor
  es_proveedor_frecuente BOOLEAN DEFAULT false,
  numero_compras_proveedor INTEGER DEFAULT 1,

  -- Alertas
  alertas JSONB DEFAULT '[]',

  -- Periodo fiscal
  periodo_fiscal_mes INTEGER,
  periodo_fiscal_anio INTEGER,

  -- Metadatos
  procesado_fecha TIMESTAMPTZ DEFAULT NOW(),
  procesado_por TEXT DEFAULT 'Antigravity SAT Audit Parser v1.0',
  xml_origen TEXT DEFAULT 'Agencia Virtual SAT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimización de reportes
CREATE INDEX IF NOT EXISTS idx_auditoria_emisor_nit ON historico_auditoria_sat(emisor_nit);
CREATE INDEX IF NOT EXISTS idx_auditoria_periodo ON historico_auditoria_sat(periodo_fiscal_anio, periodo_fiscal_mes);
CREATE INDEX IF NOT EXISTS idx_auditoria_estado ON historico_auditoria_sat(estado);
CREATE INDEX IF NOT EXISTS idx_auditoria_tipo_dte ON historico_auditoria_sat(tipo_dte);
CREATE INDEX IF NOT EXISTS idx_auditoria_credito_fiscal ON historico_auditoria_sat(afecta_credito_fiscal);
CREATE INDEX IF NOT EXISTS idx_auditoria_giro ON historico_auditoria_sat(emisor_giro);
