-- ============================================
-- KDS SOUND ALERTS - DATABASE SCHEMA UPDATE
-- ============================================
-- This script adds sound alert configuration to system_settings

-- Add sound alert columns to system_settings table
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS kds_alert_sound_url TEXT,
ADD COLUMN IF NOT EXISTS kds_alert_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS kds_alert_volume DECIMAL(3,2) DEFAULT 0.80;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'system_settings'
AND column_name LIKE 'kds_alert%';

-- Display success message
SELECT 'KDS Sound Alert columns added successfully!' as message;
