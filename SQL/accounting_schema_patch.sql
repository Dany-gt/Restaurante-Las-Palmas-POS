-- ═══════════════════════════════════════════════════════════════════════════
-- PARCHE SEGURO — Módulo Contabilidad Las Palmas POS
-- Ejecutar ESTE archivo en Supabase SQL Editor en lugar del anterior.
-- Usa ALTER TABLE ADD COLUMN IF NOT EXISTS para tablas ya existentes.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- SECCIÓN A — TABLAS NUEVAS (no existen aún, seguro crear)
-- ───────────────────────────────────────────────────────────────────────────

-- A1. Sales invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    invoice_date   DATE,
    total_amount   NUMERIC(14,2),
    iva_amount     NUMERIC(14,2),
    status         TEXT,
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- A2. Sales tickets
CREATE TABLE IF NOT EXISTS sales_tickets (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    payment_method TEXT,
    total          NUMERIC(14,2),
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- A3. Purchase invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    invoice_date   DATE,
    supplier_name  TEXT,
    invoice_number TEXT,
    total_amount   NUMERIC(14,2),
    iva_amount     NUMERIC(14,2),
    status         TEXT         DEFAULT 'pendiente',
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- A4. Payroll payments
CREATE TABLE IF NOT EXISTS payroll_payments (
    id            UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        TEXT   NOT NULL DEFAULT 'default',
    payment_date  DATE,
    period_label  TEXT,
    total_neto    NUMERIC(14,2),
    total_bruto   NUMERIC(14,2),
    notes         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- A5. IVA declarations
CREATE TABLE IF NOT EXISTS iva_declarations (
    id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT   NOT NULL DEFAULT 'default',
    periodo_mes     INTEGER,
    periodo_anio    INTEGER,
    debito_fiscal   NUMERIC(14,2),
    credito_fiscal  NUMERIC(14,2),
    saldo           NUMERIC(14,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- A6. Cost items (arrendamientos, etc.)
CREATE TABLE IF NOT EXISTS cost_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     TEXT NOT NULL DEFAULT 'default',
    date       DATE,
    category   TEXT,
    amount     NUMERIC(14,2),
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A7. Accounting config (firmas)
CREATE TABLE IF NOT EXISTS accounting_config (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            TEXT UNIQUE NOT NULL DEFAULT 'default',
    proprietor_name   TEXT DEFAULT 'Cevicheria y Restaurante Las Palmas, S.A.',
    proprietor_title  TEXT DEFAULT 'Propietario / Representante Legal',
    accountant_name   TEXT DEFAULT 'Licda. Carmen Hernández',
    accountant_title  TEXT DEFAULT 'Contador Público y Auditor',
    accountant_reg    TEXT DEFAULT 'Registrada SAT No. 2597453K',
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO accounting_config (org_id)
    VALUES ('default')
    ON CONFLICT (org_id) DO NOTHING;

-- A8. Libros Contables (NUEVAS - partida doble)
CREATE TABLE IF NOT EXISTS journal_entries (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            TEXT    NOT NULL DEFAULT 'default',
    asiento_numero    INTEGER NOT NULL,
    fecha             DATE    NOT NULL,
    descripcion       TEXT,
    tipo_asiento      TEXT,
    referencia        TEXT,
    creado_automatico BOOLEAN DEFAULT true,
    periodo_mes       INTEGER NOT NULL,
    periodo_anio      INTEGER NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID         NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    cuenta_codigo    TEXT         NOT NULL,
    cuenta_nombre    TEXT         NOT NULL,
    debe             NUMERIC(14,2) DEFAULT 0,
    haber            NUMERIC(14,2) DEFAULT 0,
    descripcion      TEXT,
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────────
-- SECCIÓN B — TABLAS EXISTENTES: agregar columnas faltantes con ALTER
--             Seguro ejecutar aunque la columna ya exista.
-- ───────────────────────────────────────────────────────────────────────────

-- B1. orders — agregar columnas si faltan
DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'default';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

-- B2. historico_auditoria_sat — columnas que usa el código
DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS tipo TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS tipo_documento TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS proveedor_nombre TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS proveedor_nit TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS monto_total NUMERIC(14,2);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS monto_base_imponible NUMERIC(14,2);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS iva_monto NUMERIC(14,2);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS idp_monto NUMERIC(14,2);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS cuenta_contable TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS clasificacion_compra TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS subcategoria_contable TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS periodo_fiscal_mes INTEGER;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS periodo_fiscal_anio INTEGER;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS numero_autorizacion TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS fecha_emision DATE;
EXCEPTION WHEN others THEN NULL; END $$;

-- B3. payroll_employees — columnas extra
DO $$ BEGIN
    ALTER TABLE payroll_employees ADD COLUMN IF NOT EXISTS org_id TEXT NOT NULL DEFAULT 'default';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE payroll_employees ADD COLUMN IF NOT EXISTS department TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE payroll_employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
EXCEPTION WHEN others THEN NULL; END $$;

-- B4. payroll_quincena_records — tabla base
CREATE TABLE IF NOT EXISTS payroll_quincena_records (
    id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 TEXT    NOT NULL DEFAULT 'default',
    employee_id            UUID    REFERENCES payroll_employees(id),
    period_label           TEXT    NOT NULL,
    quincena               INTEGER NOT NULL,
    overtime_hours         NUMERIC(8,2) DEFAULT 0,
    overtime_note          TEXT,
    base_salary_at_time    NUMERIC(14,2),
    igss_deduction_at_time NUMERIC(14,2),
    bono_incentivo_at_time NUMERIC(14,2) DEFAULT 0,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employee_id, period_label, quincena)
);

-- B5. tax_declarations — columnas extra
CREATE TABLE IF NOT EXISTS tax_declarations (
    id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT   NOT NULL DEFAULT 'default',
    tax_type       TEXT   NOT NULL,
    period_label   TEXT   NOT NULL,
    periodo_mes    INTEGER,
    periodo_anio   INTEGER,
    period_start   DATE,
    period_end     DATE,
    amount_due     NUMERIC(14,2),
    amount_paid    NUMERIC(14,2),
    due_date       DATE,
    payment_date   DATE,
    status         TEXT   DEFAULT 'pending',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, tax_type, period_label)
);

DO $$ BEGIN
    ALTER TABLE tax_declarations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE tax_declarations ADD COLUMN IF NOT EXISTS payment_date DATE;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE tax_declarations ADD COLUMN IF NOT EXISTS periodo_mes INTEGER;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE tax_declarations ADD COLUMN IF NOT EXISTS periodo_anio INTEGER;
EXCEPTION WHEN others THEN NULL; END $$;

-- B6. cash_flow — columnas extra
CREATE TABLE IF NOT EXISTS cash_flow (
    id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT   NOT NULL DEFAULT 'default',
    flow_date      DATE   NOT NULL,
    flow_type      TEXT   NOT NULL,
    category       TEXT,
    concept        TEXT,
    entry_amount   NUMERIC(14,2) DEFAULT 0,
    exit_amount    NUMERIC(14,2) DEFAULT 0,
    operation_date DATE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS flow_type TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS concept TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS operation_date DATE;
EXCEPTION WHEN others THEN NULL; END $$;

-- B7. bank_reconciliation
CREATE TABLE IF NOT EXISTS bank_reconciliation (
    id                     UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                 TEXT   NOT NULL DEFAULT 'default',
    banco                  TEXT,
    periodo                TEXT   NOT NULL,
    referencia             TEXT,
    fecha                  DATE,
    concepto               TEXT,
    monto                  NUMERIC(14,2),
    tipo                   TEXT,
    estado                 TEXT   DEFAULT 'pendiente',
    conciliado_en          TIMESTAMPTZ,
    fuente                 TEXT,
    referencia_sistema_id  TEXT,
    tabla_sistema          TEXT,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- B8. accounting_entries
CREATE TABLE IF NOT EXISTS accounting_entries (
    id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT   NOT NULL DEFAULT 'default',
    periodo_mes    INTEGER NOT NULL,
    periodo_anio   INTEGER NOT NULL,
    codigo_cuenta  TEXT   NOT NULL,
    nombre_cuenta  TEXT,
    seccion        TEXT,
    monto          NUMERIC(14,2),
    fuente         TEXT   DEFAULT 'manual',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, periodo_mes, periodo_anio, codigo_cuenta)
);


-- ───────────────────────────────────────────────────────────────────────────
-- SECCIÓN C — ÍNDICES (después de que todas las columnas ya existen)
-- ───────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sat_periodo
    ON historico_auditoria_sat(periodo_fiscal_anio, periodo_fiscal_mes);

CREATE INDEX IF NOT EXISTS idx_sat_tipo
    ON historico_auditoria_sat(tipo);

CREATE INDEX IF NOT EXISTS idx_sat_fecha
    ON historico_auditoria_sat(fecha_emision);

CREATE INDEX IF NOT EXISTS idx_payroll_emp_period
    ON payroll_quincena_records(employee_id, period_label);

CREATE INDEX IF NOT EXISTS idx_tax_tipo_periodo
    ON tax_declarations(tax_type, period_label);

CREATE INDEX IF NOT EXISTS idx_cf_fecha
    ON cash_flow(flow_date);

CREATE INDEX IF NOT EXISTS idx_cf_org_tipo
    ON cash_flow(org_id, flow_type);

CREATE INDEX IF NOT EXISTS idx_br_periodo
    ON bank_reconciliation(org_id, periodo);

CREATE INDEX IF NOT EXISTS idx_br_estado
    ON bank_reconciliation(estado);

CREATE INDEX IF NOT EXISTS idx_ae_periodo
    ON accounting_entries(periodo_anio, periodo_mes);

CREATE INDEX IF NOT EXISTS idx_journal_periodo
    ON journal_entries(periodo_anio, periodo_mes);

CREATE INDEX IF NOT EXISTS idx_journal_fecha
    ON journal_entries(fecha);

CREATE INDEX IF NOT EXISTS idx_journal_org
    ON journal_entries(org_id);

CREATE INDEX IF NOT EXISTS idx_lines_entry
    ON journal_lines(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_lines_cuenta
    ON journal_lines(cuenta_codigo);
