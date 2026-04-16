-- ═══════════════════════════════════════════════════════════════
-- MULTI-SUCURSAL MIGRATION — Phase 1: Schema
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension (likely already active)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. BRANCHES TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  phone TEXT,
  email TEXT,
  is_main BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. INSERT MAIN BRANCH ─────────────────────────────────────
INSERT INTO branches (name, location, is_main)
VALUES ('Cevichería y Restaurante Las Palmas No. 2', 'Ubicación actual', true);

-- ─── 3. ADD branch_id TO EXISTING TABLES ───────────────────────

-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Profiles (users)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Tables (mesas)
ALTER TABLE tables ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- POS Terminals (printers)
ALTER TABLE pos_terminals ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- ─── 4. MIGRATE EXISTING DATA TO MAIN BRANCH ──────────────────
-- Assign all existing records to the main branch
DO $$
DECLARE
  main_id UUID;
BEGIN
  SELECT id INTO main_id FROM branches WHERE is_main = true LIMIT 1;
  
  IF main_id IS NOT NULL THEN
    UPDATE orders SET branch_id = main_id WHERE branch_id IS NULL;
    UPDATE profiles SET branch_id = main_id WHERE branch_id IS NULL;
    UPDATE tables SET branch_id = main_id WHERE branch_id IS NULL;
    UPDATE pos_terminals SET branch_id = main_id WHERE branch_id IS NULL;
    
    RAISE NOTICE 'All existing data migrated to main branch: %', main_id;
  END IF;
END $$;

-- ─── 5. ENABLE REALTIME FOR BRANCHES ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'branches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE branches;
  END IF;
END $$;

-- ─── 6. VERIFY MIGRATION ──────────────────────────────────────
SELECT 'branches' AS tabla, COUNT(*) AS registros FROM branches
UNION ALL
SELECT 'orders con branch_id', COUNT(*) FROM orders WHERE branch_id IS NOT NULL
UNION ALL
SELECT 'profiles con branch_id', COUNT(*) FROM profiles WHERE branch_id IS NOT NULL
UNION ALL
SELECT 'tables con branch_id', COUNT(*) FROM tables WHERE branch_id IS NOT NULL
UNION ALL
SELECT 'pos_terminals con branch_id', COUNT(*) FROM pos_terminals WHERE branch_id IS NOT NULL;
