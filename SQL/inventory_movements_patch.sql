-- ══════════════════════════════════════════════════════════════════════════════
-- PATCH: Tablas de movimientos y alertas para módulo de inventario de suministros
-- Las Palmas POS — Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Tabla de movimientos de supply_items (ya existe, verificar columnas) ──────
CREATE TABLE IF NOT EXISTS supply_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL DEFAULT 'default',
    supply_item_id  UUID NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada','salida','ajuste','baja','conteo_fisico')),
    cantidad        NUMERIC(12,2) NOT NULL,
    stock_antes     NUMERIC(12,2),
    stock_despues   NUMERIC(12,2),
    motivo          TEXT,
    notas           TEXT,
    numero_factura  TEXT,
    usuario         TEXT DEFAULT 'Admin',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla de movimientos de kitchen_utensils ──────────────────────────────────
CREATE TABLE IF NOT EXISTS utensil_movements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              TEXT NOT NULL DEFAULT 'default',
    utensil_id          UUID NOT NULL REFERENCES kitchen_utensils(id) ON DELETE CASCADE,
    tipo_movimiento     TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada','ajuste','baja','reparacion','devolucion','conteo_fisico')),
    cantidad_antes      INTEGER,
    cantidad_despues    INTEGER,
    motivo              TEXT,
    notas               TEXT,
    usuario             TEXT DEFAULT 'Admin',
    foto_url            TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supply_movements_item ON supply_movements (supply_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supply_movements_org  ON supply_movements (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_utensil_movements_item ON utensil_movements (utensil_id, created_at DESC);

-- ── Vista: Alertas de stock activas de insumos ────────────────────────────────
DROP VIEW IF EXISTS supply_stock_alerts;
CREATE VIEW supply_stock_alerts AS
SELECT
    id, org_id, nombre, codigo_interno, categoria, ubicacion,
    stock_actual, stock_minimo, stock_maximo, unidad_medida,
    proveedor_nombre, precio_unitario,
    CASE
        WHEN stock_actual <= 0                       THEN 'empty'
        WHEN stock_actual <= stock_minimo * 0.5      THEN 'critical'
        WHEN stock_actual <= stock_minimo            THEN 'low'
        WHEN stock_actual <= stock_minimo * 1.5      THEN 'low'
        ELSE 'ok'
    END AS status,
    (stock_maximo - stock_actual) AS cantidad_a_pedir,
    (stock_maximo - stock_actual) * precio_unitario AS costo_reposicion_est
FROM supply_items
WHERE org_id = 'default'
ORDER BY
    CASE
        WHEN stock_actual <= 0               THEN 1
        WHEN stock_actual <= stock_minimo    THEN 2
        WHEN stock_actual <= stock_minimo*1.5 THEN 3
        ELSE 4
    END,
    nombre;

-- ── Vista: Próximas revisiones de utensilios ─────────────────────────────────
CREATE OR REPLACE VIEW utensil_upcoming_reviews AS
SELECT
    id, nombre, codigo_interno, categoria, estado,
    fecha_proxima_revision, ubicacion, responsable_baja,
    (fecha_proxima_revision - CURRENT_DATE) AS dias_para_revision
FROM kitchen_utensils
WHERE org_id = 'default'
  AND NOT dado_de_baja
  AND fecha_proxima_revision IS NOT NULL
ORDER BY fecha_proxima_revision;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT 'supply_movements'   AS tabla, COUNT(*) FROM supply_movements
UNION ALL
SELECT 'utensil_movements'  AS tabla, COUNT(*) FROM utensil_movements
UNION ALL
SELECT 'supply_stock_alerts (view)' AS tabla, COUNT(*) FROM supply_stock_alerts
UNION ALL
SELECT 'utensil_upcoming_reviews (view)' AS tabla, COUNT(*) FROM utensil_upcoming_reviews;
