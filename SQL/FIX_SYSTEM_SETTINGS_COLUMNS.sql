-- SCRIPT DE CORRECCIÓN PARA SYSTEM_SETTINGS
-- Ejecutar este script en el Editor SQL de Supabase para habilitar los nuevos ajustes.

ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS enable_kitchen_printing BOOLEAN DEFAULT true;

ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS kds_alert_enabled BOOLEAN DEFAULT true;

ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS kds_alert_volume DECIMAL(3,2) DEFAULT 0.50;

COMMENT ON COLUMN system_settings.enable_kitchen_printing IS 'Habilita o deshabilita la impresión automática de comandas al enviar una orden.';
