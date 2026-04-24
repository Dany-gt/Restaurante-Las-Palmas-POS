-- ══════════════════════════════════════════════════════
-- DIAGNÓSTICO: ¿Existe inventory_items?
-- Ejecuta estas consultas UNA POR UNA en Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- PASO 1: Ver si la tabla existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('inventory_items', 'inventory_categories', 'inventory_movements');

-- PASO 2 (si existe): Ver columnas de inventory_items
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items'
ORDER BY ordinal_position;
