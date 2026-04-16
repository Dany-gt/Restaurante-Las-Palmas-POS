-- ═══════════════════════════════════════════════════════════
-- ACTUALIZACIÓN DE ESQUEMA: ESTRATEGIA DE TRES CAPAS
-- ═══════════════════════════════════════════════════════════

-- 1. Añadir categoría por defecto a la tabla de proveedores
-- Esto permite la "Capa 1: Memoria por NIT"
ALTER TABLE IF EXISTS accounting_suppliers 
ADD COLUMN IF NOT EXISTS default_category TEXT;

-- 2. Comentario para documentación
COMMENT ON COLUMN accounting_suppliers.default_category IS 'Categoría contable preferida para este proveedor (Memoria por NIT)';
