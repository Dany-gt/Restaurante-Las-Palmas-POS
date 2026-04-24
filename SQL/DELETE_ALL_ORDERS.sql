-- SCRIPT PARA BORRAR TODAS LAS ORDENES
-- Usar con precaución. Borra todo el historial de ventas.

TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE orders CASCADE;

-- Opcional: Reiniciar secuencias si se desea (depende de cómo se generen los IDs)
-- Si los IDs son UUIDs no es necesario.
-- Si hay order_number serial:
-- ALTER SEQUENCE orders_order_number_seq RESTART WITH 1;

NOTIFY pgrst, 'reload schema';
