const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', '2026-06-02T14:29:05.304-06:00')
      .lte('created_at', '2026-06-02T16:08:00.000-06:00')
      .limit(2);
  console.log('Orders sample:', JSON.stringify(orders, null, 2));
}
test();
