-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: Credenciales SAT en system_settings
-- ═══════════════════════════════════════════════════════════
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS sat_username TEXT DEFAULT '';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS sat_password TEXT DEFAULT '';
