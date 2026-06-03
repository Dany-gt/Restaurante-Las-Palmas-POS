const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching shifts', error);
    return;
  }

  for (const shift of shifts) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, status, shift_id, created_at')
      .eq('shift_id', shift.id);
      
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, shift_id')
      .eq('shift_id', shift.id);
      
    console.log(`Shift ${shift.id} - ${shift.start_time}: Orders by shift_id = ${orders?.length || 0}, Expenses = ${expenses?.length || 0}`);
    if (orders?.length > 0) {
       console.log('Sample order statuses:', orders.map(o => o.status));
    }
    
    // Test alternative: search by start_time and end_time
    const { data: altOrders } = await supabase
      .from('orders')
      .select('id, total, status, shift_id, created_at')
      .gte('created_at', shift.start_time)
      .lte('created_at', shift.end_time || new Date().toISOString());
      
    console.log(`  -> Orders by time window: ${altOrders?.length || 0}`);
  }
}

test();
