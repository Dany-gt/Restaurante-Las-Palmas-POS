-- FIX: ADD MISSING RELATIONSHIP COLUMNS TO EXPENSES
-- Run this in Supabase SQL Editor

-- 1. Add branch_id
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- 2. Add register_id (Caja)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS register_id UUID REFERENCES cash_registers(id);

-- 3. Add shift_id (Turno)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES cashier_shifts(id);

-- 4. Re-run Category Table potentially missing
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
