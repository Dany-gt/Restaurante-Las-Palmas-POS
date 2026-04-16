-- =============================================
-- ADD MISSING FIELDS TO PROFILES TABLE
-- RESTAURANTE LAS PALMAS POS
-- =============================================

DO $$ 
BEGIN 
    -- Add email column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
    END IF;

    -- Add phone column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
    END IF;

    -- Add username column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
        ALTER TABLE profiles ADD COLUMN username TEXT;
        -- Optional: Add unique constraint if desired
        -- ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;

    -- Add password column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='password') THEN
        ALTER TABLE profiles ADD COLUMN password TEXT;
    END IF;

END $$;
