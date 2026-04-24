-- Add branch_id to delivery_drivers table
ALTER TABLE IF EXISTS delivery_drivers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Link existing drivers to the main branch
DO $$
DECLARE
    main_branch_id UUID;
BEGIN
    SELECT id INTO main_branch_id FROM branches WHERE is_main = true LIMIT 1;
    
    IF main_branch_id IS NOT NULL THEN
        UPDATE delivery_drivers SET branch_id = main_branch_id WHERE branch_id IS NULL;
    END IF;
END $$;
