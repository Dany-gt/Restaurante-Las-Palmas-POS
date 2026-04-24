-- ============================================
-- KDS SOUND LIBRARY & STATION ASSIGNMENT
-- Migration Script
-- ============================================
-- This script enhances the sound alert system with:
-- 1. A sound_library table to store multiple sounds
-- 2. Per-station sound assignment
-- 3. Migration of existing sound data

-- Step 1: Create sound_library table
CREATE TABLE IF NOT EXISTS sound_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    duration_seconds DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sound_library_active ON sound_library(is_active);

-- Step 3: Migrate existing sound URL to library (if exists)
DO $$
DECLARE
    existing_url TEXT;
    new_sound_id UUID;
BEGIN
    -- Check if the old column exists and has data
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'system_settings' 
        AND column_name = 'kds_alert_sound_url'
    ) THEN
        SELECT kds_alert_sound_url INTO existing_url 
        FROM system_settings 
        WHERE id = 1 AND kds_alert_sound_url IS NOT NULL;
        
        IF existing_url IS NOT NULL THEN
            -- Insert existing sound into library
            INSERT INTO sound_library (name, file_url, is_active)
            VALUES ('Default Alert', existing_url, true)
            RETURNING id INTO new_sound_id;
            
            -- Add new column for sound reference
            ALTER TABLE system_settings 
            ADD COLUMN IF NOT EXISTS kds_default_sound_id UUID;
            
            -- Add foreign key constraint
            ALTER TABLE system_settings
            ADD CONSTRAINT fk_default_sound 
            FOREIGN KEY (kds_default_sound_id) 
            REFERENCES sound_library(id) ON DELETE SET NULL;
            
            -- Update system_settings to reference new sound
            UPDATE system_settings 
            SET kds_default_sound_id = new_sound_id 
            WHERE id = 1;
            
            RAISE NOTICE 'Migrated existing sound to library with ID: %', new_sound_id;
        END IF;
    ELSE
        -- Column doesn't exist, just add the new one
        ALTER TABLE system_settings 
        ADD COLUMN IF NOT EXISTS kds_default_sound_id UUID;
        
        ALTER TABLE system_settings
        ADD CONSTRAINT fk_default_sound 
        FOREIGN KEY (kds_default_sound_id) 
        REFERENCES sound_library(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 4: Add sound_id to kitchen_stations
ALTER TABLE kitchen_stations 
ADD COLUMN IF NOT EXISTS sound_id UUID;

-- Add foreign key constraint
ALTER TABLE kitchen_stations
ADD CONSTRAINT fk_kitchen_station_sound 
FOREIGN KEY (sound_id) 
REFERENCES sound_library(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kitchen_stations_sound ON kitchen_stations(sound_id);

-- Step 5: Verify the migration
SELECT 
    'sound_library' as table_name,
    COUNT(*) as record_count
FROM sound_library
UNION ALL
SELECT 
    'kitchen_stations with sound',
    COUNT(*)
FROM kitchen_stations
WHERE sound_id IS NOT NULL;

-- Display success message
SELECT 'Sound library system created successfully!' as message;

-- Optional: Display current state
SELECT 
    'Current Sound Library:' as info,
    id,
    name,
    file_url,
    is_active
FROM sound_library;
