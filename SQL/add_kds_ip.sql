-- Agrega la columna local_kds_ip para el puente de red WiFi local de la cocina
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS local_kds_ip VARCHAR DEFAULT '';

-- Refrescar la caché HTTP cambiando un campo dummy si fuese necesario
COMMENT ON COLUMN system_settings.local_kds_ip IS 'IP interna del servidor Node (KDS Bridge) para envío secundario de pedidos en fallas de internet';
