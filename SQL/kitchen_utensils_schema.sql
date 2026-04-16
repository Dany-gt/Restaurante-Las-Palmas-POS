-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: kitchen_utensils — Utensilios de Cocina
-- Módulo independiente del inventario de insumos/suministros
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kitchen_utensils (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  TEXT NOT NULL DEFAULT 'default',

    -- Información básica
    nombre                  TEXT NOT NULL,
    categoria               TEXT,
    descripcion             TEXT,
    marca_modelo            TEXT,
    codigo_interno          TEXT UNIQUE,
    material                TEXT DEFAULT 'Acero inoxidable',
    tamano_capacidad        TEXT,

    -- Imágenes (hasta 5 fotos)
    imagen_urls             TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Inventario
    cantidad_total          INTEGER DEFAULT 1,
    cantidad_en_uso         INTEGER DEFAULT 0,
    cantidad_en_bodega      INTEGER DEFAULT 1,
    cantidad_en_reparacion  INTEGER DEFAULT 0,
    cantidad_minima         INTEGER DEFAULT 1,
    ubicacion               TEXT DEFAULT 'Cocina',

    -- Estado y vida útil
    estado                  TEXT DEFAULT 'Bueno'
                            CHECK (estado IN ('Excelente','Bueno','Regular','Necesita reparación','Dado de baja')),
    fecha_adquisicion       DATE,
    costo_adquisicion       NUMERIC(12,2) DEFAULT 0,
    vida_util_anos          INTEGER DEFAULT 3,
    fecha_proxima_revision  DATE,
    proveedor_nombre        TEXT,

    -- Control de bajas
    dado_de_baja            BOOLEAN DEFAULT FALSE,
    motivo_baja             TEXT CHECK (motivo_baja IN ('Roto','Perdido','Robado','Desgaste','Obsoleto') OR motivo_baja IS NULL),
    fecha_baja              DATE,
    responsable_baja        TEXT,
    foto_evidencia_baja     TEXT,

    -- Auditoría
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_kitchen_utensils_org   ON kitchen_utensils (org_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_utensils_estado ON kitchen_utensils (estado);
CREATE INDEX IF NOT EXISTS idx_kitchen_utensils_cat    ON kitchen_utensils (categoria);
CREATE INDEX IF NOT EXISTS idx_kitchen_utensils_baja   ON kitchen_utensils (dado_de_baja);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION touch_kitchen_utensils()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_kitchen_utensils_updated ON kitchen_utensils;
CREATE TRIGGER trg_kitchen_utensils_updated
    BEFORE UPDATE ON kitchen_utensils
    FOR EACH ROW EXECUTE FUNCTION touch_kitchen_utensils();

-- Vista resumen de activos
CREATE OR REPLACE VIEW kitchen_utensils_summary AS
SELECT
    categoria,
    COUNT(*) FILTER (WHERE NOT dado_de_baja)            AS total_items,
    SUM(cantidad_total) FILTER (WHERE NOT dado_de_baja) AS unidades_activas,
    SUM(cantidad_en_uso) FILTER (WHERE NOT dado_de_baja) AS en_uso,
    SUM(cantidad_en_reparacion)                          AS en_reparacion,
    COUNT(*) FILTER (WHERE dado_de_baja)                 AS dados_de_baja,
    SUM(cantidad_total * costo_adquisicion) FILTER (WHERE NOT dado_de_baja) AS valor_activos
FROM kitchen_utensils
WHERE org_id = 'default'
GROUP BY categoria
ORDER BY categoria;

-- Verificación
SELECT 'kitchen_utensils' AS tabla, COUNT(*) AS registros FROM kitchen_utensils;
