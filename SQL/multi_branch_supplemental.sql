-- PHASE 4 SUPPLEMENTAL: EXTENDED BRANCH ISOLATION
-- Add branch_id to remaining configuration tables

DO $$ 
DECLARE 
    main_branch_id UUID;
BEGIN
    -- 1. Get the ID of the main branch (Las Palmas No. 2)
    -- We assume it was created in Phase 1
    SELECT id INTO main_branch_id FROM branches WHERE is_main = true LIMIT 1;

    -- If not found (safety), create a default one
    IF main_branch_id IS NULL THEN
        INSERT INTO branches (name, is_main) VALUES ('Sucursal Principal', true) RETURNING id INTO main_branch_id;
    END IF;

    -- 2. Update PRINTERS table
    ALTER TABLE IF EXISTS printers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
    UPDATE printers SET branch_id = main_branch_id WHERE branch_id IS NULL;

    -- 3. Update KITCHEN_STATIONS table
    ALTER TABLE IF EXISTS kitchen_stations ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
    UPDATE kitchen_stations SET branch_id = main_branch_id WHERE branch_id IS NULL;

    -- 4. Update CASH_REGISTERS table
    ALTER TABLE IF EXISTS cash_registers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
    UPDATE cash_registers SET branch_id = main_branch_id WHERE branch_id IS NULL;

    -- 9. Add branch association to system_settings (Global Identity)
    ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES branches(id);

    -- 10. Link system_settings to the main branch
    UPDATE system_settings SET sucursal_id = (SELECT id FROM branches WHERE is_main = true LIMIT 1) WHERE sucursal_id IS NULL;

    -- 5. Update SECTIONS table (Areas)
    ALTER TABLE IF EXISTS sections ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);
    UPDATE sections SET branch_id = main_branch_id WHERE branch_id IS NULL;

    -- 6. Ensure existing users (profiles) are also linked if they weren't
    UPDATE profiles SET branch_id = main_branch_id WHERE branch_id IS NULL;
    
    -- 7. Ensure existing tables are also linked
    UPDATE tables SET branch_id = main_branch_id WHERE branch_id IS NULL;
    
    -- 8. Ensure existing POS terminals are linked
    UPDATE pos_terminals SET branch_id = main_branch_id WHERE branch_id IS NULL;

END $$;
