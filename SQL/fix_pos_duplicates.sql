-- ==============================================================================
-- CLEANUP DUPLICATE POS TERMINALS
-- ==============================================================================

BEGIN;

-- 1. Identificar y eliminar duplicados manteniendo el más antiguo
DELETE FROM pos_terminals a USING pos_terminals b
WHERE a.id > b.id 
AND a.serial = b.serial;

-- 2. Agregar restricción única para evitar futuros duplicados
ALTER TABLE pos_terminals 
DROP CONSTRAINT IF EXISTS unique_pos_serial;

ALTER TABLE pos_terminals 
ADD CONSTRAINT unique_pos_serial UNIQUE (serial);

COMMIT;
