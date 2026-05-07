-- ====================================================================================
-- SCRIPT DE LIMPIEZA TOTAL: PASO A PRODUCCIÓN
-- ====================================================================================
-- IMPORTANTE: Este script borrará TODAS las ventas, cortes de caja y facturas de prueba.
-- Úsalo únicamente el día que vayas a entregar el sistema al cliente final.
--
-- Lo que CONSERVA: Productos, Categorías, Mesas, Usuarios, Clientes, Configuración.
-- Lo que BORRA: Órdenes, Tickets, Facturas, Gastos, Turnos (Cortes Z).
-- ====================================================================================

BEGIN;

-- 1. Borrar detalle y órdenes de prueba
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.orders CASCADE;

-- 2. Borrar facturas de prueba
TRUNCATE TABLE public.invoices CASCADE;

-- 3. Borrar turnos de caja (cortes X/Z) y gastos de prueba
TRUNCATE TABLE public.expenses CASCADE;
TRUNCATE TABLE public.shifts CASCADE;

-- 4. Borrar pagos de créditos (si usaron cuentas por cobrar en pruebas)
TRUNCATE TABLE public.credit_payments CASCADE;

-- ====================================================================================
-- REINICIO DE SECUENCIAS (NÚMEROS DE ORDEN)
-- ====================================================================================

-- Reiniciar el contador SERIAL de PostgreSQL (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'orders_order_number_seq') THEN
        ALTER SEQUENCE public.orders_order_number_seq RESTART WITH 1;
    END IF;
END $$;

-- Reiniciar el contador en la tabla manual system_sequences (si se usa)
UPDATE public.system_sequences 
SET current_val = 0 
WHERE seq_name = 'order_number';

-- ====================================================================================
-- INVENTARIO (OPCIONAL)
-- ====================================================================================
-- Si durante las pruebas el inventario quedó con números negativos o falsos y quieres
-- que el cliente inicie su inventario físico real desde 0, DESCOMENTA las siguientes dos líneas:

-- TRUNCATE TABLE public.kardex CASCADE;
-- UPDATE public.branch_inventory SET quantity = 0;

COMMIT;

-- Recargar el esquema para que los cambios surtan efecto en la API
NOTIFY pgrst, 'reload schema';

-- Fin del script. ¡Éxito en tu entrega!
