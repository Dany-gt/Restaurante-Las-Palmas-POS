-- ==============================================================================
-- SCRIPT DE ACTUALIZACIÓN: SERVICIO A DOMICILIO Y NÚMEROS CORRELATIVOS DE ORDEN
-- ==============================================================================

-- 1. ACTUALIZACIONES PARA SERVICIO A DOMICILIO (CLIENTES Y DIRECCIONES)
-- Basado en los requerimientos de "Formulario Completo" y manejo de múltiples direcciones

-- A. Actualizar tabla CUSTOMERS con campos extendidos
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone2 TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS coordinates TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS current_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0;

-- B. Crear tabla de DIRECCIONES ADICIONALES (Para soportar Casa, Oficina, etc.)
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT DEFAULT 'Principal', -- Ej: Casa, Trabajo
    address TEXT NOT NULL,
    reference TEXT,
    city TEXT,
    zone TEXT,
    coordinates TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas de seguridad para direcciones
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for customer_addresses" ON public.customer_addresses;
CREATE POLICY "Allow all for customer_addresses" ON public.customer_addresses FOR ALL USING (true) WITH CHECK (true);


-- 2. REPARACIÓN DE TABLA ORDENES Y MOTORISTAS (Foreign Keys)

-- A. Asegurar tabla de MOTORISTAS (delivery_drivers)
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vehicle_info TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for delivery_drivers" ON public.delivery_drivers;
CREATE POLICY "Allow all for delivery_drivers" ON public.delivery_drivers FOR ALL USING (true) WITH CHECK (true);

-- B. Corregir relación en ORDERS (Si existe una FK incorrecta, se borra y se recrea)
DO $$
BEGIN
    -- Intentar borrar la restricción vieja si existe
    BEGIN
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_driver_id_fkey;
    EXCEPTION
        WHEN undefined_object THEN NULL;
    END;

    -- Agregar la columna driver_id si no existe
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id UUID;

    -- Crear la nueva restricción apuntando a delivery_drivers
    ALTER TABLE public.orders 
        ADD CONSTRAINT orders_driver_id_fkey 
        FOREIGN KEY (driver_id) 
        REFERENCES public.delivery_drivers(id);
END $$;


-- 3. IMPLEMENTACIÓN DE NÚMERO CORRELATIVO SIN PÉRDIDA (Gapless Sequence)
-- Usamos una tabla separada para controlar el conteo de forma transaccional.
-- Si la transacción falla (ROLLBACK), el contador vuelve a su estado anterior, evitando huecos.

-- A. Crear tabla de secuencias
CREATE TABLE IF NOT EXISTS public.system_sequences (
    seq_name TEXT PRIMARY KEY,
    current_value BIGINT DEFAULT 0
);

ALTER TABLE public.system_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for system_sequences" ON public.system_sequences;
CREATE POLICY "Allow all for system_sequences" ON public.system_sequences FOR ALL USING (true) WITH CHECK (true);

-- Inicializar la secuencia de órdenes si no existe
INSERT INTO public.system_sequences (seq_name, current_value)
VALUES ('order_number', 0)
ON CONFLICT (seq_name) DO NOTHING;

-- B. Agregar columna order_number a la tabla ORDERS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number BIGINT;

-- C. Crear Función y Trigger para asignar el número automáticamente
-- Esta función incrementa el valor en la tabla 'system_sequences' y lo asigna.
-- Al ser parte de la transacción del INSERT, si el INSERT falla, este UPDATE también se revierte.
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val BIGINT;
BEGIN
    -- Solo asignar si no viene ya con un número
    IF NEW.order_number IS NULL THEN
        UPDATE public.system_sequences
        SET current_value = current_value + 1
        WHERE seq_name = 'order_number'
        RETURNING current_value INTO next_val;
        
        NEW.order_number := next_val;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Borrar trigger anterior si existe para evitar duplicados
DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;

-- Crear el Trigger
CREATE TRIGGER trg_assign_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

-- D. Opcional: Indexar por número de orden para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
