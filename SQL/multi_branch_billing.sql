-- ==============================================================================
-- MULTI-SUCURSAL MIGRATION — Phase 6: Multi-Branch Billing (FEL)
-- Run this in the Supabase SQL Editor
-- ==============================================================================

-- 1. ADD BILLING COLUMNS TO BRANCHES TABLE
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS enable_billing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_copies INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS print_logo_on_invoice BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS commercial_name TEXT,
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS nit TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_address_1 TEXT,
ADD COLUMN IF NOT EXISTS billing_address_2 TEXT,
ADD COLUMN IF NOT EXISTS municipality TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS branch_code TEXT,
ADD COLUMN IF NOT EXISTS scenario_code TEXT DEFAULT '1',
ADD COLUMN IF NOT EXISTS ws_prefix TEXT,
ADD COLUMN IF NOT EXISTS ws_key TEXT,
ADD COLUMN IF NOT EXISTS signer_token TEXT,
ADD COLUMN IF NOT EXISTS invoice_phrases TEXT,
ADD COLUMN IF NOT EXISTS certifier_legend TEXT,
ADD COLUMN IF NOT EXISTS isr_retention BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS iva_retention BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS no_iva_credit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exempt_iva BOOLEAN DEFAULT false;

-- 2. MIGRATE EXISTING BILLING CONFIGURATION FROM GLOBAL SETTINGS TO MAIN BRANCH
DO $$
DECLARE
  main_id UUID;
  global_settings RECORD;
BEGIN
  -- Get the main branch ID
  SELECT id INTO main_id FROM branches WHERE is_main = true LIMIT 1;
  
  -- Get the global settings
  SELECT * INTO global_settings FROM system_settings WHERE id = 1;

  IF main_id IS NOT NULL AND global_settings IS NOT NULL THEN
    UPDATE branches SET
      enable_billing = COALESCE(global_settings.enable_billing, branches.enable_billing),
      billing_copies = COALESCE(global_settings.billing_copies, branches.billing_copies),
      print_logo_on_invoice = COALESCE(global_settings.print_logo_on_invoice, branches.print_logo_on_invoice),
      commercial_name = COALESCE(global_settings.commercial_name, branches.commercial_name),
      legal_name = COALESCE(global_settings.legal_name, branches.legal_name),
      nit = COALESCE(global_settings.nit, branches.nit),
      billing_email = COALESCE(global_settings.billing_email, branches.billing_email),
      billing_address_1 = COALESCE(global_settings.billing_address_1, branches.billing_address_1),
      billing_address_2 = COALESCE(global_settings.billing_address_2, branches.billing_address_2),
      municipality = COALESCE(global_settings.municipality, branches.municipality),
      department = COALESCE(global_settings.department, branches.department),
      branch_code = COALESCE(global_settings.branch_code, branches.branch_code),
      scenario_code = COALESCE(global_settings.scenario_code, branches.scenario_code),
      ws_prefix = COALESCE(global_settings.ws_prefix, branches.ws_prefix),
      ws_key = COALESCE(global_settings.ws_key, branches.ws_key),
      signer_token = COALESCE(global_settings.signer_token, branches.signer_token),
      invoice_phrases = COALESCE(global_settings.invoice_phrases, branches.invoice_phrases),
      certifier_legend = COALESCE(global_settings.certifier_legend, branches.certifier_legend),
      isr_retention = COALESCE(global_settings.isr_retention, branches.isr_retention),
      iva_retention = COALESCE(global_settings.iva_retention, branches.iva_retention),
      no_iva_credit = COALESCE(global_settings.no_iva_credit, branches.no_iva_credit),
      exempt_iva = COALESCE(global_settings.exempt_iva, branches.exempt_iva)
    WHERE id = main_id;
    
    RAISE NOTICE 'Billing settings successfully migrated to main branch: %', main_id;
  ELSE
    RAISE WARNING 'Main branch or system settings not found. Skipping migration.';
  END IF;
END $$;

-- 3. REMOVE BILLING COLUMNS FROM SYSTEM SETTINGS (OPTIONAL/CLEANUP)
-- We will leave them for now to avoid breaking the frontend mid-migration. 
-- Once the frontend code is fully updated, these can be dropped.

-- ALTER TABLE system_settings 
-- DROP COLUMN IF EXISTS enable_billing,
-- DROP COLUMN IF EXISTS billing_copies,
-- ...
