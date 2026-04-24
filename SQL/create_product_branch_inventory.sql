-- ══════════════════════════════════════════════════════════════════════════════
-- TABLA: product_branch_inventory
-- Stock por Sucursal para Productos de Inventario (es_platillo = false)
-- ══════════════════════════════════════════════════════════════════════════════
-- Esta tabla almacena la existencia y punto de reorden de cada insumo/producto
-- del módulo de Inventario, segregado por sucursal.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_branch_inventory (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    branch_id   UUID        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    quantity    NUMERIC(12, 3) NOT NULL DEFAULT 0,
    min_stock   NUMERIC(12, 3) NOT NULL DEFAULT 0,
    is_enabled  BOOLEAN     NOT NULL DEFAULT true,
    is_assigned BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, branch_id)
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_pbi_product_id ON product_branch_inventory (product_id);
CREATE INDEX IF NOT EXISTS idx_pbi_branch_id  ON product_branch_inventory (branch_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_product_branch_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pbi_updated_at ON product_branch_inventory;
CREATE TRIGGER trg_pbi_updated_at
    BEFORE UPDATE ON product_branch_inventory
    FOR EACH ROW EXECUTE FUNCTION update_product_branch_inventory_timestamp();

-- RLS (Row Level Security) — ajustar según políticas del proyecto
ALTER TABLE product_branch_inventory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'product_branch_inventory'
      AND policyname = 'Acceso total autenticado'
  ) THEN
    EXECUTE 'CREATE POLICY "Acceso total autenticado" ON product_branch_inventory FOR ALL USING (auth.role() = ''authenticated'')';
  END IF;
END $$;
