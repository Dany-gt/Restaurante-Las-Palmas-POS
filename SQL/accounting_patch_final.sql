-- ═══════════════════════════════════════════════════════════════════════════
-- SQL MÍNIMO EXACTO — Solo lo que FALTA en Supabase
-- Restaurante Las Palmas POS
-- Basado en análisis del schema actual (Abril 2026)
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- PARTE 1 — Agregar columnas faltantes a tablas existentes
-- ───────────────────────────────────────────────────────────────────────────

-- 1A. historico_auditoria_sat le falta la columna "tipo"
--     (el código filtra por .eq('tipo', 'recibida') / 'emitida')
ALTER TABLE historico_auditoria_sat
    ADD COLUMN IF NOT EXISTS tipo TEXT;

-- Poblar retroactivamente: si el NIT del emisor == NIT propio = emitida, sino = recibida
UPDATE historico_auditoria_sat
    SET tipo = CASE
        WHEN emisor_nit = '9188766-6' THEN 'emitida'
        ELSE 'recibida'
    END
WHERE tipo IS NULL;

-- 1B. cash_flow le falta la columna "operation_date"
--     (TabEstadosFinancieros filtra por .gte('operation_date', ...) )
ALTER TABLE cash_flow
    ADD COLUMN IF NOT EXISTS operation_date DATE;

-- Poblar retroactivamente con el valor de flow_date
UPDATE cash_flow
    SET operation_date = flow_date
WHERE operation_date IS NULL;

-- 1C. cost_items le faltan "category" y "date"
--     (TabISR y TabEstadosFinancieros usan .ilike('category','%alquiler%').gte('date',...))
ALTER TABLE cost_items
    ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE cost_items
    ADD COLUMN IF NOT EXISTS date DATE;

-- Poblar retroactivamente: category desde section, date desde created_at
UPDATE cost_items
    SET category = section
WHERE category IS NULL AND section IS NOT NULL;

UPDATE cost_items
    SET date = created_at::date
WHERE date IS NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- PARTE 2 — Crear tablas que no existen
-- ───────────────────────────────────────────────────────────────────────────

-- 2A. sales_invoices
--     (TabIVA y TabEstadosFinancieros leen ventas de aquí)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    invoice_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
    total_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
    iva_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    status         TEXT         DEFAULT 'activo', -- 'activo' | 'anulado'
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_inv_date
    ON sales_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_inv_status
    ON sales_invoices(status);

-- 2B. sales_tickets
--     (TabFlujoCaja conciliación bancaria: tarjetas)
CREATE TABLE IF NOT EXISTS sales_tickets (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    payment_method TEXT,        -- 'tarjeta' | 'efectivo'
    total          NUMERIC(14,2),
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_tickets_method
    ON sales_tickets(payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_tickets_date
    ON sales_tickets(created_at);

-- 2C. tax_declarations
--     (TabIVA, TabISR, TabPlanilla, TabFlujoCaja, TabLibrosContables,
--      TabEstadosFinancieros — tabla muy usada)
CREATE TABLE IF NOT EXISTS tax_declarations (
    id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT    NOT NULL DEFAULT 'default',
    tax_type       TEXT    NOT NULL,  -- 'IVA' | 'ISR' | 'IGSS' | 'IRTRA'
    period_label   TEXT    NOT NULL,  -- 'YYYY-MM'
    periodo_mes    INTEGER,
    periodo_anio   INTEGER,
    period_start   DATE,
    period_end     DATE,
    amount_due     NUMERIC(14,2) DEFAULT 0,
    amount_paid    NUMERIC(14,2) DEFAULT 0,
    due_date       DATE,
    payment_date   DATE,
    status         TEXT    DEFAULT 'pending', -- 'pending' | 'paid'
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, tax_type, period_label)
);

CREATE INDEX IF NOT EXISTS idx_tax_tipo_periodo
    ON tax_declarations(tax_type, period_label);
CREATE INDEX IF NOT EXISTS idx_tax_org_tipo
    ON tax_declarations(org_id, tax_type);

-- 2D. iva_declarations
--     (TabEstadosFinancieros lee saldo IVA débito vs crédito)
CREATE TABLE IF NOT EXISTS iva_declarations (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT    NOT NULL DEFAULT 'default',
    periodo_mes     INTEGER NOT NULL,
    periodo_anio    INTEGER NOT NULL,
    debito_fiscal   NUMERIC(14,2) DEFAULT 0,
    credito_fiscal  NUMERIC(14,2) DEFAULT 0,
    saldo           NUMERIC(14,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, periodo_anio, periodo_mes)
);


-- ───────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL — Confirma que todo existe
-- Ejecuta esto al final para ver las tablas creadas/modificadas
-- ───────────────────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'sales_invoices',
    'sales_tickets',
    'tax_declarations',
    'iva_declarations',
    'historico_auditoria_sat',
    'cash_flow',
    'cost_items',
    'journal_entries',
    'journal_lines'
  )
ORDER BY table_name;
