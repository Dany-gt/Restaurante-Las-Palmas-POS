-- ═══════════════════════════════════════════════════════════════
-- SEPARACIÓN DE 4 DOMINIOS — LAS PALMAS POS
-- ────────────────────────────────────────────────────────────────
-- supply_categories  → EXISTE (cols: id, name)
-- utensil_categories → EXISTE (cols: id, name)
-- menu_categories    → CREAR
-- product_categories → CREAR
-- ═══════════════════════════════════════════════════════════════

-- ── Agregar sort_order a las tablas existentes ──────────────────
ALTER TABLE supply_categories  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE utensil_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ── Crear las 2 tablas nuevas ───────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT    NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_categories (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT    NOT NULL,
  parent_id   UUID    REFERENCES product_categories(id),
  sort_order  INTEGER DEFAULT 0,
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nuevas columnas en products ─────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS menu_category_id    UUID REFERENCES menu_categories(id);
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_category_id UUID REFERENCES product_categories(id);
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS es_platillo         BOOLEAN DEFAULT false;

-- ── Nuevas columnas en inventory_items ──────────────────────────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS supply_category_id  UUID REFERENCES supply_categories(id);
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS utensil_category_id UUID REFERENCES utensil_categories(id);

-- ── Índices ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_menu_cat    ON products(menu_category_id);
CREATE INDEX IF NOT EXISTS idx_products_prod_cat    ON products(product_category_id);
CREATE INDEX IF NOT EXISTS idx_inv_supply_cat       ON inventory_items(supply_category_id)  WHERE tipo = 'insumo';
CREATE INDEX IF NOT EXISTS idx_inv_utensil_cat      ON inventory_items(utensil_category_id) WHERE tipo = 'utensilio';

-- ── Datos D1: menu_categories ────────────────────────────────────
INSERT INTO menu_categories (nombre, sort_order) VALUES
  ('ENTRADAS', 1), ('SOPAS Y CONSOMÉS', 2), ('CEVICHES', 3),
  ('AGUACHILES', 4), ('CALDOS', 5), ('PLATOS FUERTES', 6),
  ('MARISCOS A LA PLANCHA', 7), ('COMIDA CHINA', 8),
  ('DESAYUNOS', 9), ('POSTRES', 10), ('BEBIDAS', 11),
  ('ESPECIALES DEL CHEF', 12), ('COMBOS', 13)
ON CONFLICT DO NOTHING;

-- ── Datos D2: product_categories ────────────────────────────────
INSERT INTO product_categories (nombre, sort_order) VALUES
  ('ACEITES', 1), ('BEBIDAS (BODEGA)', 2), ('CAMARONES', 3),
  ('CARNES', 4), ('MARISCOS', 5), ('POLLO', 6), ('RES', 7),
  ('CHILES', 8), ('CÍTRICOS', 9), ('CREMAS', 10),
  ('EMBUTIDOS', 11), ('ENDULZANTES', 12),
  ('ESPECIAS Y CONDIMENTOS', 13), ('FRUTAS', 14),
  ('GRANOS Y CEREALES', 15), ('HARINAS', 16), ('HIELO', 17),
  ('LÁCTEOS', 18), ('LICORES', 19), ('MIXER Y COMPLEMENTOS', 20),
  ('PANES', 21), ('SALSAS', 22), ('VERDURAS', 23),
  ('OTROS INSUMOS', 24)
ON CONFLICT DO NOTHING;

-- ── Datos D3: supply_categories (usa columna 'name') ────────────
INSERT INTO supply_categories (name, sort_order) VALUES
  ('DESECHABLES', 1), ('EMPAQUE PARA LLEVAR', 2),
  ('LIMPIEZA', 3), ('COCINA CONSUMIBLES', 4), ('OFICINA Y POS', 5)
ON CONFLICT DO NOTHING;

-- ── Datos D4: utensil_categories (usa columna 'name') ───────────
INSERT INTO utensil_categories (name, sort_order) VALUES
  ('VAJILLA', 1), ('CRISTALERÍA', 2), ('CUBIERTOS', 3),
  ('UTENSILIOS DE COCINA', 4), ('EQUIPOS MENORES', 5),
  ('ALMACENAMIENTO', 6), ('LIMPIEZA DE COCINA', 7),
  ('PRESENTACIÓN Y SERVICIO', 8)
ON CONFLICT DO NOTHING;
