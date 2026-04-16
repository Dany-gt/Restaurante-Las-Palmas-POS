-- Add SMTP configuration fields to system_settings table
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS smtp_host text,
ADD COLUMN IF NOT EXISTS smtp_port integer,
ADD COLUMN IF NOT EXISTS smtp_user text,
ADD COLUMN IF NOT EXISTS smtp_pass text;
