const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addColumns() {
  console.log('Adding beverage tax columns to historico_auditoria_sat...');
  
  // We use RPC if available, or just try to insert a dummy record with the columns to see if it fails
  // Actually, without a 'query' RPC, we can't run ALTER TABLE easily via anon key.
  // However, usually these projects have a Service Role key or a 'exec_sql' function.
  
  console.log('Note: If this fails, the user must run the SQL manually in Supabase Dashboard.');
  console.log('SQL to run:');
  console.log('ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS impuesto_bebidas_alcoh NUMERIC(12,2) DEFAULT 0;');
  console.log('ALTER TABLE historico_auditoria_sat ADD COLUMN IF NOT EXISTS impuesto_bebidas_no_alcoh NUMERIC(12,2) DEFAULT 0;');
}

addColumns();
