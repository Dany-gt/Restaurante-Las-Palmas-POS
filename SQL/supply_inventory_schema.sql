-- ══════════════════════════════════════════════════════════════════════════════
-- INVENTARIO DE SUMINISTROS Y UTENSILIOS — Las Palmas POS
-- Módulo independiente del inventario de materia prima
-- Ejecutar en: Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Tabla principal ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supply_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  TEXT NOT NULL DEFAULT 'default',

    -- Tipo diferenciador
    tipo                    TEXT NOT NULL CHECK (tipo IN ('insumo', 'utensilio')),

    -- Información básica
    nombre                  TEXT NOT NULL,
    categoria               TEXT,
    descripcion             TEXT,
    codigo_interno          TEXT UNIQUE,
    unidad_medida           TEXT DEFAULT 'unidad',
    contenido_por_unidad    TEXT,

    -- Imágenes (array de URLs públicas)
    imagen_urls             TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Stock
    stock_actual            NUMERIC(12,2) DEFAULT 0,
    stock_minimo            NUMERIC(12,2) DEFAULT 5,
    stock_maximo            NUMERIC(12,2) DEFAULT 100,
    ubicacion               TEXT DEFAULT 'Bodega principal',
    unidades_por_paquete    NUMERIC(12,2) DEFAULT 1,

    -- Compra
    proveedor_id            UUID NULL,
    proveedor_nombre        TEXT,
    precio_unitario         NUMERIC(12,2) DEFAULT 0,
    precio_unidad_minima    NUMERIC(12,2) DEFAULT 0,
    fecha_ultima_compra     DATE,
    dias_entre_compras      INTEGER DEFAULT 30,

    -- Consumo (insumos)
    consumo_diario_promedio NUMERIC(12,2) DEFAULT 0,

    -- Utensilios específico
    estado_conservacion     TEXT DEFAULT 'Óptimo',
    vida_util_meses         INTEGER DEFAULT 24,
    fecha_adquisicion       DATE,
    costo_reposicion        NUMERIC(12,2) DEFAULT 0,

    -- Auditoría
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices de búsqueda ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supply_items_org_tipo ON supply_items (org_id, tipo);
CREATE INDEX IF NOT EXISTS idx_supply_items_nombre   ON supply_items (nombre);
CREATE INDEX IF NOT EXISTS idx_supply_items_categoria ON supply_items (categoria);
CREATE INDEX IF NOT EXISTS idx_supply_items_stock    ON supply_items (stock_actual, stock_minimo);

-- ── Trigger: actualizar updated_at automáticamente ──────────────────────────
CREATE OR REPLACE FUNCTION touch_supply_items()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supply_items_updated ON supply_items;
CREATE TRIGGER trg_supply_items_updated
    BEFORE UPDATE ON supply_items
    FOR EACH ROW EXECUTE FUNCTION touch_supply_items();

-- ── Tabla de movimientos de stock (trazabilidad) ─────────────────────────────
CREATE TABLE IF NOT EXISTS supply_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL DEFAULT 'default',
    supply_item_id  UUID NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida', 'ajuste', 'pérdida')),
    cantidad        NUMERIC(12,2) NOT NULL,
    stock_antes     NUMERIC(12,2),
    stock_despues   NUMERIC(12,2),
    motivo          TEXT,
    usuario         TEXT,
    referencia      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_movements_item ON supply_movements (supply_item_id, created_at DESC);

-- ── Vista: alertas de stock ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW supply_stock_alerts AS
SELECT
    id,
    org_id,
    tipo,
    nombre,
    codigo_interno,
    categoria,
    ubicacion,
    stock_actual,
    stock_minimo,
    stock_maximo,
    unidad_medida,
    CASE
        WHEN stock_actual <= 0           THEN 'empty'
        WHEN stock_actual <= stock_minimo * 0.5 THEN 'critical'
        WHEN stock_actual <= stock_minimo THEN 'low'
        ELSE 'ok'
    END AS status,
    CASE
        WHEN consumo_diario_promedio > 0
        THEN FLOOR(stock_actual / consumo_diario_promedio)
        ELSE NULL
    END AS dias_restantes,
    precio_unitario,
    stock_actual * precio_unitario AS valor_en_bodega
FROM supply_items
WHERE org_id = 'default'
ORDER BY status DESC, nombre;

-- ── Storage bucket (ejecutar también en Storage settings de Supabase) ────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('inventory-images', 'inventory-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT
    'supply_items'      AS tabla, COUNT(*) AS registros FROM supply_items
UNION ALL
SELECT
    'supply_movements'  AS tabla, COUNT(*) AS registros FROM supply_movements;
