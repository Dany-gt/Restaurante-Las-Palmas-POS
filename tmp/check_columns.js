import { supabase } from '../supabase';

async function checkColumns() {
  const tables = ['purchase_invoices', 'sales_invoices'];
  for (const table of tables) {
    console.log(`\n--- TABLE: ${table} ---`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      continue;
    }

    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('No data found to infer columns.');
    }
  }
}

checkColumns();
