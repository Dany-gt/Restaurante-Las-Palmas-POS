-- ═══════════════════════════════════════════════════════════════════════════
-- ESQUEMA COMPLETO — MÓDULO CONTABILIDAD
-- Restaurante Las Palmas POS
-- NIT: 9188766-6
--
-- Ejecutar en Supabase SQL Editor.
-- Todas las sentencias usan CREATE TABLE IF NOT EXISTS
-- para que sea seguro re-ejecutar sin perder datos.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. VENTAS — Ordenes del POS
--    Fuente: TabIVA, TabISR, TabLibrosContables, TabEstadosFinancieros
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    status         TEXT,        -- 'completado' | 'cancelado' | 'pendiente'
    total          NUMERIC(14,2),
    payment_method TEXT,        -- 'efectivo' | 'tarjeta'
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- Facturas de venta generadas en el sistema (FEL/SAT)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    invoice_date   DATE,
    total_amount   NUMERIC(14,2),
    iva_amount     NUMERIC(14,2),
    status         TEXT,        -- 'activo' | 'anulado'
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- Tickets de venta (para conciliación bancaria tarjetas)
CREATE TABLE IF NOT EXISTS sales_tickets (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    payment_method TEXT,
    total          NUMERIC(14,2),
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 2. COMPRAS / FACTURAS — Usado por TabIVA, TabISR, TabEstadosFinancieros
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT         NOT NULL DEFAULT 'default',
    invoice_date   DATE,
    supplier_name  TEXT,
    invoice_number TEXT,
    total_amount   NUMERIC(14,2),
    iva_amount     NUMERIC(14,2),
    status         TEXT         DEFAULT 'pendiente', -- 'pendiente' | 'pagada' | 'anulada'
    created_at     TIMESTAMPTZ  DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. HISTORIAL SAT — Facturas emitidas y recibidas desde SAT
--    Fuente: TabIVA, TabCompras, TabAuditoriaSAT, TabEstadosFinancieros,
--            TabLibrosContables
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historico_auditoria_sat (
    id                       UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                   TEXT   NOT NULL DEFAULT 'default',
    tipo                     TEXT,  -- 'emitida' | 'recibida'
    tipo_documento           TEXT,  -- 'FACT' | 'FPEQ' | 'FCAM' | 'NCRE' | etc.
    serie                    TEXT,
    numero_autorizacion      TEXT,
    fecha_emision            DATE,
    proveedor_nombre         TEXT,
    proveedor_nit            TEXT,
    monto_total              NUMERIC(14,2),
    monto_base_imponible     NUMERIC(14,2),
    iva_monto                NUMERIC(14,2),
    idp_monto                NUMERIC(14,2),
    cuenta_contable          TEXT,
    clasificacion_compra     TEXT,  -- 'ACTIVO_FIJO' | 'GASTO' | 'COSTO' | etc.
    subcategoria_contable    TEXT,
    periodo_fiscal_mes       INTEGER,
    periodo_fiscal_anio      INTEGER,
    created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sat_periodo
    ON historico_auditoria_sat(periodo_fiscal_anio, periodo_fiscal_mes);
CREATE INDEX IF NOT EXISTS idx_sat_tipo
    ON historico_auditoria_sat(tipo);
CREATE INDEX IF NOT EXISTS idx_sat_fecha
    ON historico_auditoria_sat(fecha_emision);


-- ───────────────────────────────────────────────────────────────────────────
-- 4. PLANILLA — Empleados y Registros Quincenales
--    Fuente: TabPlanilla, TabEstadosFinancieros, TabLibrosContables
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_employees (
    id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       TEXT      NOT NULL DEFAULT 'default',
    full_name    TEXT      NOT NULL,
    position     TEXT,
    department   TEXT,
    base_salary  NUMERIC(14,2) NOT NULL DEFAULT 3816.90,
    is_active    BOOLEAN   DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_quincena_records (
    id                       UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                   TEXT   NOT NULL DEFAULT 'default',
    employee_id              UUID   REFERENCES payroll_employees(id),
    period_label             TEXT   NOT NULL, -- 'YYYY-MM'
    quincena                 INTEGER NOT NULL, -- 1 | 2
    overtime_hours           NUMERIC(8,2) DEFAULT 0,
    overtime_note            TEXT,
    base_salary_at_time      NUMERIC(14,2),
    igss_deduction_at_time   NUMERIC(14,2),
    bono_incentivo_at_time   NUMERIC(14,2) DEFAULT 0,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employee_id, period_label, quincena)
);

-- Pagos históricos de planilla (referencia de payroll_payments en TabFlujoCaja)
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

CREATE INDEX IF NOT EXISTS idx_payroll_emp_period
    ON payroll_quincena_records(employee_id, period_label);


-- ───────────────────────────────────────────────────────────────────────────
-- 5. DECLARACIONES DE IMPUESTOS — IVA, ISR, IGSS
--    Fuente: TabIVA, TabISR, TabPlanilla, TabFlujoCaja, TabLibrosContables
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_declarations (
    id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT   NOT NULL DEFAULT 'default',
    tax_type       TEXT   NOT NULL, -- 'IVA' | 'ISR' | 'IGSS'
    period_label   TEXT   NOT NULL, -- 'YYYY-MM'
    periodo_mes    INTEGER,
    periodo_anio   INTEGER,
    period_start   DATE,
    period_end     DATE,
    amount_due     NUMERIC(14,2),
    amount_paid    NUMERIC(14,2),
    due_date       DATE,
    payment_date   DATE,
    status         TEXT   DEFAULT 'pending', -- 'pending' | 'paid'
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, tax_type, period_label)
);

CREATE INDEX IF NOT EXISTS idx_tax_tipo_periodo
    ON tax_declarations(tax_type, period_label);

-- IVA declaraciones detalladas (usado por TabEstadosFinancieros)
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


-- ───────────────────────────────────────────────────────────────────────────
-- 6. FLUJO DE CAJA
--    Fuente: TabFlujoCaja, TabEstadosFinancieros, TabLibrosContables
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_flow (
    id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT   NOT NULL DEFAULT 'default',
    flow_date      DATE   NOT NULL,
    flow_type      TEXT   NOT NULL, -- 'entry' | 'exit'
    category       TEXT,
    concept        TEXT,
    entry_amount   NUMERIC(14,2) DEFAULT 0,
    exit_amount    NUMERIC(14,2) DEFAULT 0,
    operation_date DATE,  -- alias para compatibilidad con TabEstadosFinancieros
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cf_fecha
    ON cash_flow(flow_date);
CREATE INDEX IF NOT EXISTS idx_cf_org_tipo
    ON cash_flow(org_id, flow_type);


-- ───────────────────────────────────────────────────────────────────────────
-- 7. CONCILIACIÓN BANCARIA
--    Fuente: TabFlujoCaja (sección Conciliación Bancaria)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_reconciliation (
    id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT   NOT NULL DEFAULT 'default',
    banco           TEXT,  -- 'BI' | 'BAC' | 'BANCAFE' | 'INTERNACIONAL'
    periodo         TEXT   NOT NULL, -- 'YYYY-MM'
    referencia      TEXT,
    fecha           DATE,
    concepto        TEXT,
    monto           NUMERIC(14,2),
    tipo            TEXT,  -- 'credito' | 'debito'
    estado          TEXT   DEFAULT 'pendiente', -- 'pendiente' | 'conciliado'
    conciliado_en   TIMESTAMPTZ,
    fuente          TEXT,  -- 'banco' | 'sistema'
    referencia_sistema_id TEXT,
    tabla_sistema   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_br_periodo
    ON bank_reconciliation(org_id, periodo);
CREATE INDEX IF NOT EXISTS idx_br_estado
    ON bank_reconciliation(estado);


-- ───────────────────────────────────────────────────────────────────────────
-- 8. ESTADOS FINANCIEROS — Datos guardados por periodo
--    Fuente: TabEstadosFinancieros
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounting_entries (
    id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         TEXT   NOT NULL DEFAULT 'default',
    periodo_mes    INTEGER NOT NULL,
    periodo_anio   INTEGER NOT NULL,
    codigo_cuenta  TEXT   NOT NULL,
    nombre_cuenta  TEXT,
    seccion        TEXT,  -- 'estado_resultados' | 'balance'
    monto          NUMERIC(14,2),
    fuente         TEXT   DEFAULT 'manual', -- 'manual' | 'automatico'
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, periodo_mes, periodo_anio, codigo_cuenta)
);

CREATE INDEX IF NOT EXISTS idx_ae_periodo
    ON accounting_entries(periodo_anio, periodo_mes);

-- Configuración de firmas del reporte PDF
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

-- Insertar configuración inicial si no existe
INSERT INTO accounting_config (org_id)
    VALUES ('default')
    ON CONFLICT (org_id) DO NOTHING;

-- cost_items (usado por TabISR y TabEstadosFinancieros para arrendamientos)
CREATE TABLE IF NOT EXISTS cost_items (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id   TEXT NOT NULL DEFAULT 'default',
    date     DATE,
    category TEXT,  -- 'alquiler' | etc.
    amount   NUMERIC(14,2),
    notes    TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 9. LIBROS CONTABLES FORMALES — Partida Doble
--    Fuente: TabLibrosContables
-- ───────────────────────────────────────────────────────────────────────────

-- Cabecera del asiento contable
CREATE TABLE IF NOT EXISTS journal_entries (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            TEXT    NOT NULL DEFAULT 'default',
    asiento_numero    INTEGER NOT NULL,
    fecha             DATE    NOT NULL,
    descripcion       TEXT,
    tipo_asiento      TEXT,   -- 'ventas'|'compras'|'planilla'|'igss'|'iva'|'gasto'|'manual'
    referencia        TEXT,
    creado_automatico BOOLEAN DEFAULT true,
    periodo_mes       INTEGER NOT NULL,
    periodo_anio      INTEGER NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Líneas del asiento (partida doble)
CREATE TABLE IF NOT EXISTS journal_lines (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID         NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    cuenta_codigo    TEXT         NOT NULL,    -- Ej: '4101', '1102'
    cuenta_nombre    TEXT         NOT NULL,    -- Ej: 'Ventas gravadas', 'Bancos'
    debe             NUMERIC(14,2) DEFAULT 0,
    haber            NUMERIC(14,2) DEFAULT 0,
    descripcion      TEXT,
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

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


-- ═══════════════════════════════════════════════════════════════════════════
-- RESUMEN DE TABLAS
-- ═══════════════════════════════════════════════════════════════════════════
--
--  MÓDULO                     TABLAS USADAS
--  ─────────────────────────────────────────────────────────────────────────
--  TabIVA                     sales_invoices, orders, historico_auditoria_sat,
--                             purchase_invoices, tax_declarations
--
--  TabISR                     orders, cost_items, tax_declarations,
--                             purchase_invoices
--
--  TabPlanilla e IGSS         payroll_employees, payroll_quincena_records,
--                             tax_declarations
--
--  TabCompras (SAT)           historico_auditoria_sat, purchase_invoices
--
--  TabFlujoCaja               cash_flow, bank_reconciliation,
--                             sales_tickets, payroll_payments,
--                             purchase_invoices, tax_declarations
--
--  TabLibrosContables         journal_entries, journal_lines,
--                             orders, historico_auditoria_sat,
--                             payroll_employees, tax_declarations,
--                             cash_flow
--
--  TabEstadosFinancieros      accounting_entries, accounting_config,
--                             sales_invoices, payroll_employees,
--                             historico_auditoria_sat, cost_items,
--                             cash_flow, purchase_invoices,
--                             tax_declarations, iva_declarations
--
--  TabCalendarioFiscal        tax_declarations (lectura)
--
--  TabAuditoriaSAT            historico_auditoria_sat
-- ═══════════════════════════════════════════════════════════════════════════
