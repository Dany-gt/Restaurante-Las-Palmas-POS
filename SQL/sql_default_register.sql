-- INSERTAR CAJA POR DEFECTO
-- Ejecuta esto si no tienes ninguna caja creada
INSERT INTO cash_registers (name, is_active)
VALUES ('Caja Principal', true);

SELECT 'Caja Principal creada exitosamente.' as resultado;
