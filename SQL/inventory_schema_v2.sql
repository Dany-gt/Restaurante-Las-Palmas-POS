-- ══════════════════════════════════════════════════════════════════════════════
-- INVENTARIO UNIFICADO — Las Palmas POS v2
-- Ejecutar en: Supabase SQL Editor
-- NOTA: Limpia y recrea las tablas del módulo de inventario unificado.
--       Las tablas de supply_items y kitchen_utensils antiguas NO se tocan.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── PASO 1: Limpiar vistas y tablas del módulo nuevo (en orden por FKs) ───────
DROP VIEW  IF EXISTS inventory_stock_alerts;
DROP TABLE IF EXISTS physical_count_lines  CASCADE;
DROP TABLE IF EXISTS physical_counts       CASCADE;
DROP TABLE IF EXISTS inventory_movements   CASCADE;
DROP TABLE IF EXISTS inventory_photos      CASCADE;
DROP TABLE IF EXISTS inventory_items       CASCADE;
DROP TABLE IF EXISTS inventory_categories  CASCADE;

-- ── PASO 2: CATEGORÍAS ────────────────────────────────────────────────────────
CREATE TABLE inventory_categories (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     TEXT    NOT NULL DEFAULT 'default',
  nombre     TEXT    NOT NULL,
  tipo       TEXT    NOT NULL CHECK (tipo IN ('insumo','utensilio')),
  icono      TEXT,
  color      TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, nombre, tipo)
);

-- ── PASO 3: ITEMS ─────────────────────────────────────────────────────────────
CREATE TABLE inventory_items (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  TEXT    NOT NULL DEFAULT 'default',
  codigo                  TEXT    UNIQUE,
  nombre                  TEXT    NOT NULL,
  descripcion             TEXT,
  tipo                    TEXT    NOT NULL CHECK (tipo IN ('insumo','utensilio')),
  categoria_id            UUID    REFERENCES inventory_categories(id) ON DELETE SET NULL,

  -- Detalles generales
  marca                   TEXT,
  modelo                  TEXT,
  material                TEXT,
  tamano_capacidad        TEXT,
  unidad_medida           TEXT,
  contenido_por_unidad    TEXT,

  -- Stock (insumos)
  stock_actual            NUMERIC(10,2) DEFAULT 0,
  stock_minimo            NUMERIC(10,2) DEFAULT 0,
  stock_maximo            NUMERIC(10,2) DEFAULT 0,
  ubicacion               TEXT,

  -- Cantidades (utensilios)
  cantidad_total          INTEGER DEFAULT 0,
  cantidad_en_uso         INTEGER DEFAULT 0,
  cantidad_bodega         INTEGER DEFAULT 0,
  cantidad_reparacion     INTEGER DEFAULT 0,
  cantidad_minima         INTEGER DEFAULT 1,

  -- Estado y vida útil (utensilios)
  estado                  TEXT    DEFAULT 'bueno'
                          CHECK (estado IN ('excelente','bueno','regular','reparacion','baja')),
  fecha_adquisicion       DATE,
  costo_adquisicion       NUMERIC(10,2),
  vida_util_anos          INTEGER,
  fecha_proxima_revision  DATE,

  -- Compra / proveedor
  proveedor_id            UUID,
  precio_compra           NUMERIC(10,2),
  precio_unitario_minimo  NUMERIC(10,2),
  fecha_ultima_compra     DATE,
  dias_entre_compras      INTEGER,

  -- Consumo estimado (insumos)
  consumo_diario_promedio NUMERIC(10,3),
  dias_stock_restante     INTEGER,

  -- Imagen principal
  imagen_principal_url    TEXT,

  -- Control
  activo                  BOOLEAN DEFAULT true,
  notas                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── PASO 4: FOTOS ─────────────────────────────────────────────────────────────
CREATE TABLE inventory_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  tipo        TEXT DEFAULT 'general'
              CHECK (tipo IN ('principal','estado','adquisicion','baja','general')),
  descripcion TEXT,
  fecha_foto  TIMESTAMPTZ DEFAULT NOW(),
  subido_por  TEXT DEFAULT 'Admin',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PASO 5: MOVIMIENTOS ───────────────────────────────────────────────────────
CREATE TABLE inventory_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              TEXT NOT NULL DEFAULT 'default',
  item_id             UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL
                      CHECK (tipo IN ('entrada','salida','ajuste','baja','conteo')),
  cantidad_anterior   NUMERIC(10,2),
  cantidad_movimiento NUMERIC(10,2),
  cantidad_nueva      NUMERIC(10,2),
  motivo              TEXT
                      CHECK (motivo IN ('compra','uso','perdida','rotura',
                                        'inventario_fisico','ajuste','baja','devolucion','otro')),
  referencia          TEXT,
  responsable         TEXT DEFAULT 'Admin',
  notas               TEXT,
  foto_evidencia_url  TEXT,
  fecha_movimiento    TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── PASO 6: CONTEOS FÍSICOS ───────────────────────────────────────────────────
CREATE TABLE physical_counts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL DEFAULT 'default',
  tipo         TEXT CHECK (tipo IN ('insumos','utensilios','completo')),
  fecha_conteo DATE NOT NULL,
  responsable  TEXT,
  estado       TEXT DEFAULT 'en_proceso'
               CHECK (estado IN ('en_proceso','completado','aprobado')),
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE physical_count_lines (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  conteo_id        UUID    NOT NULL REFERENCES physical_counts(id) ON DELETE CASCADE,
  item_id          UUID    NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  cantidad_sistema NUMERIC(10,2),
  cantidad_contada NUMERIC(10,2),
  diferencia       NUMERIC(10,2),
  ajustado         BOOLEAN DEFAULT false,
  notas            TEXT
);

-- ── PASO 7: ÍNDICES ───────────────────────────────────────────────────────────
CREATE INDEX idx_inv_items_org_tipo   ON inventory_items(org_id, tipo);
CREATE INDEX idx_inv_items_categoria  ON inventory_items(categoria_id);
CREATE INDEX idx_inv_items_estado     ON inventory_items(estado);
CREATE INDEX idx_inv_items_activo     ON inventory_items(activo);
CREATE INDEX idx_inv_photos_item      ON inventory_photos(item_id);
CREATE INDEX idx_inv_movements_item   ON inventory_movements(item_id, fecha_movimiento DESC);
CREATE INDEX idx_inv_movements_fecha  ON inventory_movements(org_id, fecha_movimiento DESC);
CREATE INDEX idx_pcl_conteo           ON physical_count_lines(conteo_id);

-- ── PASO 8: TRIGGER updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_inventory_items()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_items_updated ON inventory_items;
CREATE TRIGGER trg_inventory_items_updated
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION touch_inventory_items();

-- ── PASO 9: CATEGORÍAS INICIALES ─────────────────────────────────────────────
INSERT INTO inventory_categories (org_id, nombre, tipo, sort_order) VALUES
  ('default', 'Desechables',            'insumo',    1),
  ('default', 'Empaque para llevar',    'insumo',    2),
  ('default', 'Limpieza',               'insumo',    3),
  ('default', 'Cocina consumibles',     'insumo',    4),
  ('default', 'Oficina y POS',          'insumo',    5),
  ('default', 'Vajilla',                'utensilio', 1),
  ('default', 'Cristalería',            'utensilio', 2),
  ('default', 'Cubiertos',              'utensilio', 3),
  ('default', 'Utensilios de cocina',   'utensilio', 4),
  ('default', 'Equipos menores',        'utensilio', 5),
  ('default', 'Almacenamiento',         'utensilio', 6),
  ('default', 'Presentación y servicio','utensilio', 7)
ON CONFLICT (org_id, nombre, tipo) DO NOTHING;

-- ── PASO 10: VISTA ALERTAS ────────────────────────────────────────────────────
CREATE VIEW inventory_stock_alerts AS
SELECT
  i.id,
  i.org_id,
  i.tipo,
  i.nombre,
  i.codigo,
  i.ubicacion,
  i.stock_actual,
  i.stock_minimo,
  i.stock_maximo,
  i.unidad_medida,
  i.cantidad_total,
  i.cantidad_en_uso,
  i.cantidad_minima,
  c.nombre AS categoria_nombre,
  i.imagen_principal_url,
  CASE
    WHEN i.tipo = 'insumo'    AND i.stock_actual  <= 0                   THEN 'empty'
    WHEN i.tipo = 'insumo'    AND i.stock_actual  <= i.stock_minimo      THEN 'critical'
    WHEN i.tipo = 'insumo'    AND i.stock_actual  <= i.stock_minimo*1.5  THEN 'low'
    WHEN i.tipo = 'utensilio' AND i.cantidad_total < i.cantidad_minima   THEN 'critical'
    ELSE 'ok'
  END AS alert_status,
  CASE
    WHEN i.consumo_diario_promedio > 0
    THEN FLOOR(i.stock_actual / i.consumo_diario_promedio)
    ELSE NULL
  END AS dias_restantes
FROM inventory_items i
LEFT JOIN inventory_categories c ON c.id = i.categoria_id
WHERE i.activo = true
  AND i.org_id = 'default'
ORDER BY
  CASE WHEN i.tipo='insumo' AND i.stock_actual<=0 THEN 1
       WHEN i.tipo='insumo' AND i.stock_actual<=i.stock_minimo THEN 2
       WHEN i.tipo='insumo' AND i.stock_actual<=i.stock_minimo*1.5 THEN 3
       ELSE 4 END,
  i.nombre;

-- ── VERIFICACIÓN ──────────────────────────────────────────────────────────────
SELECT
  t.table_name,
  CASE WHEN t.table_type='VIEW' THEN 'Vista OK' ELSE 'Tabla OK' END AS resultado
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'inventory_categories', 'inventory_items', 'inventory_photos',
    'inventory_movements',  'physical_counts', 'physical_count_lines',
    'inventory_stock_alerts'
  )
ORDER BY t.table_name;
