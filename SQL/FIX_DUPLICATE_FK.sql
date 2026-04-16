-- ============================================
-- ARREGLAR FOREIGN KEYS DUPLICADAS
-- Ejecutar en SQL Editor de Supabase
-- ============================================

-- PASO 1: Ver todas las foreign keys actuales entre order_items y orders
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'order_items'
    AND ccu.table_name = 'orders';

-- ============================================
-- PASO 2: ELIMINAR FOREIGN KEYS DUPLICADAS
-- Ejecuta cada DROP por separado según los nombres que aparezcan arriba
-- ============================================

-- Si tienes múltiples FKs, elimina las extras. Ejemplo:
-- DROP CONSTRAINT IF EXISTS order_items_order_id_fkey1;
-- DROP CONSTRAINT IF EXISTS order_items_order_id_fkey2;

-- Comando genérico para eliminar TODAS las FKs de order_id y recrear una sola:
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Buscar y eliminar todas las FK constraints de order_items.order_id
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'order_items'
            AND kcu.column_name = 'order_id'
            AND ccu.table_name = 'orders'
    )
    LOOP
        RAISE NOTICE 'Eliminando constraint: %', r.constraint_name;
        EXECUTE format('ALTER TABLE order_items DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
END $$;

-- ============================================
-- PASO 3: CREAR UNA SOLA FOREIGN KEY CORRECTA
-- ============================================
ALTER TABLE order_items
ADD CONSTRAINT order_items_order_id_fkey
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- ============================================
-- PASO 4: VERIFICAR QUE SOLO HAY UNA FK
-- ============================================
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'order_items'
    AND ccu.table_name = 'orders';

-- Debería mostrar SOLO UNA fila con constraint_name = 'order_items_order_id_fkey'

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================
SELECT 'FK arreglada correctamente!' AS resultado;
