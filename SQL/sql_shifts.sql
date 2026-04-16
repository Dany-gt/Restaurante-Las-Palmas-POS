-- TABLA PARA CONTROL DE TURNOS DE CAJA
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID REFERENCES cash_registers(id),
    cashier_id UUID REFERENCES profiles(id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    start_amount DECIMAL(10,2) DEFAULT 0.00,
    end_amount DECIMAL(10,2),
    status TEXT CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for shifts" ON shifts FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
