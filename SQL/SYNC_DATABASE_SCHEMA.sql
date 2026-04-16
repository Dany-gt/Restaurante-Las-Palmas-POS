-- ============================================
-- SCRIPT DE SINCRONIZACIÓN MAESTRO
-- RESTAURANTE LAS PALMAS POS
-- ============================================

-- 1. MEJORAS EN CONFIGURACIÓN DEL SISTEMA (Impresión y Sonido)
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS enable_kitchen_printing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kds_alert_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kds_alert_volume DECIMAL(3,2) DEFAULT 0.80,
ADD COLUMN IF NOT EXISTS kds_default_sound_id UUID;

-- 2. MEJORAS EN PRODUCTOS (Seguimiento de tiempos)
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP WITH TIME ZONE;

-- 3. COMENTARIOS PARA DOCUMENTACIÓN
COMMENT ON COLUMN system_settings.enable_kitchen_printing IS 'Controla si se imprime ticket de cocina al enviar orden.';
COMMENT ON COLUMN order_items.preparing_at IS 'Marca de tiempo cuando el cocinero inició la preparación.';

-- 4. ÍNDICE PARA DESEMPEÑO EN KDS
CREATE INDEX IF NOT EXISTS idx_order_items_preparing_at ON order_items(preparing_at);

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
