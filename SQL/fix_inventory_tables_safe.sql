-- ══════════════════════════════════════════════════════════════════════════════
-- REPARACIÓN SEGURA DE INVENTARIOS (SUMINISTROS E INSUMOS)
-- ══════════════════════════════════════════════════════════════════════════════
-- Este script REPARA el módulo de insumos SIN BORRAR datos de productos.
-- NO utiliza DROP TABLE para garantizar la integridad de tu información.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Asegurar que existe la tabla de CATEGORÍAS DE INVENTARIO
CREATE TABLE IF NOT EXISTS inventory_categories (
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

-- 2. Asegurar que existe la tabla de ÍTEMS DE INVENTARIO (Insumos/Suministros)
CREATE TABLE IF NOT EXISTS inventory_items (
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

-- 3. MOVIMIENTOS E HISTORIAL
CREATE TABLE IF NOT EXISTS inventory_movements (
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

-- 4. CATEGORÍAS INICIALES (Sólo si no existen)
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

-- 5. REPARACIÓN DE COLUMNAS (Por si las tablas ya existían pero estaban incompletas)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='activo') THEN
    ALTER TABLE inventory_items ADD COLUMN activo BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='org_id') THEN
    ALTER TABLE inventory_items ADD COLUMN org_id TEXT NOT NULL DEFAULT 'default';
  END IF;
END $$;
