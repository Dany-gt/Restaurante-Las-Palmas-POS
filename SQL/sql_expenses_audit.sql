-- Migration to add cancellation and audit fields to expenses
DO $$ 
BEGIN 
    -- 1. Add is_void column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'is_void') THEN
        ALTER TABLE public.expenses ADD COLUMN is_void BOOLEAN DEFAULT FALSE;
    END IF;

    -- 2. Add voided_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'voided_at') THEN
        ALTER TABLE public.expenses ADD COLUMN voided_at TIMESTAMPTZ;
    END IF;

    -- 3. Add voided_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'voided_by') THEN
        ALTER TABLE public.expenses ADD COLUMN voided_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload config';
