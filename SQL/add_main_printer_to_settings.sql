-- Add main_printer_id to system_settings to allow selecting a default printer for general tasks
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS main_printer_id BIGINT REFERENCES printers(id);
