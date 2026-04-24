-- Arreglar el error de Foreign Key (Motoristas)
-- La tabla 'orders' estaba apuntando a una tabla 'drivers' antigua/vacía, 
-- pero la App usa 'delivery_drivers'.

-- 1. Eliminar la restricción incorrecta
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_driver_id_fkey;

-- 2. Crear la restricción correcta apuntando a 'delivery_drivers'
-- Asegúrate de que 'delivery_drivers' existe y tiene los datos que ves en pantalla.
ALTER TABLE orders 
    ADD CONSTRAINT orders_driver_id_fkey 
    FOREIGN KEY (driver_id) 
    REFERENCES delivery_drivers(id);

-- Opción B: Si prefieres que se llame 'drivers' y no 'delivery_drivers', dímelo,
-- pero este script asume que quieres trabajar con la que ya funciona en la App.
