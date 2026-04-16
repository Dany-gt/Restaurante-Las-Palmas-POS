const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cofdsbczmrkriohlgyct.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6mXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY'
);

const sql = `
  ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS status text DEFAULT 'paid';
  ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS tipo_dte text;
  ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS isr_retenido numeric DEFAULT 0;
  ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS iva_retenido numeric DEFAULT 0;
  ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS customer_nit text;
  ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS customer_name text;
`;

async function fix() {
  console.log("Running SQL to fix sales_invoices schema...");
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error("Error executing SQL:", error);
    // If exec_sql doesn't exist, we might need another way
  } else {
    console.log("SQL executed successfully:", data);
  }
}

fix();
