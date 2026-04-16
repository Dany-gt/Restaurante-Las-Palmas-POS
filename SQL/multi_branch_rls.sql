-- ==========================================
-- PHASE 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
-- WARNING: BEFORE RUNNING THIS SCRIPT, ENSURE
-- ALL EXISTING DATA HAS A branch_id ASSIGNED.
-- (Run multi_branch_migration.sql and 
-- multi_branch_supplemental.sql FIRST).
-- ==========================================

-- 1. ENABLE RLS ON ALL RELEVANT TABLES
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 2. DROP EXISTING "ALLOW ALL" POLICIES IF THEY EXIST
-- (To prevent conflicts and ensure true isolation)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'orders', 'profiles', 'tables', 'pos_terminals',
        'printers', 'kitchen_stations', 'cash_registers', 
        'sections', 'system_settings'
    ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for %s" ON %s', t, t);
    END LOOP;
END $$;


-- 3. CREATE ISOLATION POLICIES
-- These policies assume that the front-end will send the user's branch_id
-- OR that we can derive it from the authenticated user.
-- IN A MULTI-TENANT SUPABASE SETUP WITH CUSTOM AUTH (not using Supabase Auth strictly),
-- RLS relies on the claims passed in the JWT OR we filter on the frontend.
-- IF WE ARE RELYING PURELY ON FRONTEND FILTERING for now due to custom auth, 
-- we MUST KEEP the "Allow all" policies, meaning RLS acts as a safety net 
-- if implemented via custom claims, but will block everything if no claims exist.

-- LET'S PAUSE AND VERIFY HOW AUTHENTICATION WORKS IN THIS APP.
-- The app seems to use a custom PIN-based login (profiles table) rather than 
-- Supabase Auth users for the POS interface.
-- If this is the case, standard Supabase RLS `auth.uid()` WILL NOT WORK for POS users.
