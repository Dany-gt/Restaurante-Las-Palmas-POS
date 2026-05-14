-- DIAGNÓSTICO: Verificar órdenes activas en mesas ocupadas
-- Ejecuta estas consultas en Supabase SQL Editor para diagnosticar el problema

-- 1. Ver todas las mesas ocupadas
SELECT 
    id,
    number,
    section,
    status
FROM tables
WHERE status = 'occupied'
ORDER BY section, number;

-- 2. Ver TODAS las órdenes (sin filtros) para mesas ocupadas
SELECT 
    o.id,
    o.order_number,
    o.table_id,
    t.number as mesa_numero,
    t.section as mesa_seccion,
    o.status,
    o.created_at,
    o.waiter_id,
    COUNT(oi.id) as cantidad_items
FROM orders o
LEFT JOIN tables t ON t.id = o.table_id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE t.status = 'occupied'
GROUP BY o.id, o.order_number, o.table_id, t.number, t.section, o.status, o.created_at, o.waiter_id
ORDER BY t.section, t.number, o.created_at DESC;

-- 3. Ver órdenes NO completadas ni canceladas (lo que DEBERÍA mostrar el sistema)
SELECT 
    o.id,
    o.order_number,
    o.table_id,
    t.number as mesa_numero,
    t.section as mesa_seccion,
    o.status,
    o.created_at,
    COUNT(oi.id) as cantidad_items
FROM orders o
LEFT JOIN tables t ON t.id = o.table_id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE t.status = 'occupied'
  AND o.status != 'completed'
  AND o.status != 'cancelled'
GROUP BY o.id, o.order_number, o.table_id, t.number, t.section, o.status, o.created_at
ORDER BY t.section, t.number, o.created_at DESC;

-- 4. Ver los items de una orden específica (reemplaza 'ORDER_ID_AQUI' con el ID real)
-- SELECT 
--     oi.id,
--     oi.order_id,
--     p.name as producto,
--     oi.quantity,
--     oi.unit_price,
--     oi.status,
--     oi.notes
-- FROM order_items oi
-- LEFT JOIN products p ON p.id = oi.product_id
-- WHERE oi.order_id = 'ORDER_ID_AQUI';

-- 5. Verificar si hay órdenes con estados inesperados
SELECT DISTINCT status, COUNT(*) as cantidad
FROM orders
GROUP BY status
ORDER BY cantidad DESC;
