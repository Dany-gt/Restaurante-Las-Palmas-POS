-- SQL para asegurar que ambas tablas de categorías (Menú y Materias Primas)
-- tengan todas las columnas necesarias para el nuevo Modal de Mantenimiento.

-- 1. Asegurarse de que exista la columna de imagen_url en ambas tablas
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS imagen_url TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- 2. Asegurarse de que exista la columna parent_id para las SubCategorías
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES menu_categories(id);
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES product_categories(id);

-- 3. Asegurarse de que exista la columna branch_ids para las Sucursales
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}';
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}';

-- 4. Asegurarse de que exista la columna sort_order para la Prioridad
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
