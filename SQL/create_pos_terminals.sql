
-- Create POS terminals table
CREATE TABLE IF NOT EXISTS pos_terminals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    serial TEXT,
    status TEXT DEFAULT 'online',
    type TEXT DEFAULT 'Físico',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE pos_terminals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON pos_terminals
    FOR SELECT USING (true);

CREATE POLICY "Enable all access for admins" ON pos_terminals
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'authenticated' -- Add specific admin logic here if needed, or just allow for now
    );

-- Insert initial data
INSERT INTO pos_terminals (name, serial, status, type, logo_url)
VALUES 
('NEO NET', 'NEO-001', 'online', 'Físico', NULL),
('CREDOMATIC', 'BAC-001', 'online', 'Físico', NULL),
('VISANET LINK', 'VISA-001', 'online', 'Virtual', NULL)
ON CONFLICT DO NOTHING;
