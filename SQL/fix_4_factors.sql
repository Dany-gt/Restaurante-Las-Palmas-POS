-- 1. Eliminar las restricciones antiguas que solo permitían 'insumo' y 'utensilio'
ALTER TABLE inventory_categories DROP CONSTRAINT IF EXISTS inventory_categories_tipo_check;
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_tipo_check;

-- 2. Añadir las nuevas restricciones para soportar los 4 factores por separado
ALTER TABLE inventory_categories ADD CONSTRAINT inventory_categories_tipo_check 
    CHECK (tipo IN ('materia_prima', 'suministro', 'utensilio', 'equipo', 'insumo'));

ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_tipo_check 
    CHECK (tipo IN ('materia_prima', 'suministro', 'utensilio', 'equipo', 'insumo'));

-- 3. Mover las categorías que NO son comida al factor 'suministro'
UPDATE inventory_categories 
SET tipo = 'suministro' 
WHERE nombre IN ('Desechables', 'Empaque para llevar', 'Limpieza', 'Cocina consumibles', 'Oficina y POS', 'DESECHABLES');

-- 4. Asegurar que Suministros tengan sus items actualizados
UPDATE inventory_items SET tipo = 'suministro' 
WHERE categoria_id IN (SELECT id FROM inventory_categories WHERE tipo = 'suministro');

-- 5. Las categorías de Materia Prima actuales se mueven al factor independiente
UPDATE inventory_categories 
SET tipo = 'materia_prima' 
WHERE tipo = 'insumo';

UPDATE inventory_items 
SET tipo = 'materia_prima' 
WHERE tipo = 'insumo';
