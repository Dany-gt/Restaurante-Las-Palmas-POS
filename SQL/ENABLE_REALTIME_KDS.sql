-- HABILITAR REALTIME PARA EL VISOR DE COCINA (KDS)
-- Ejecute esto en el SQL Editor de Supabase si los pedidos no aparecen automáticamente

-- Asegurarse de que la publicación para Realtime existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Añadir las tablas necesarias a la publicación de Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE kitchen_stations;

-- Nota: Si las tablas ya estaban añadidas, el comando anterior podría dar error. 
-- Puede usar estos comandos específicos si lo prefiere:
-- ALTER PUBLICATION supabase_realtime SET TABLE orders, order_items, kitchen_stations, profiles;
