-- AGREGAR OPCIÓN PARA DESACTIVAR IMPRESIÓN MANUAL DE COCINA
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS enable_kitchen_printing BOOLEAN DEFAULT true;

-- NOTA: Esto permite que los pedidos se envíen al KDS sin abrir el cuadro de diálogo de impresión del navegador.
