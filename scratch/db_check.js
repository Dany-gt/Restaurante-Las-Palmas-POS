const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://cofdsbczmrkriohlgyct.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY');

async function check() {
  console.log('--- BUSCANDO AGUA EN PRODUCTS ---');
  const { data: products, error: e1 } = await supabase.from('products').select('*').ilike('name', '%agua%');
  if (e1) console.error(e1);
  else console.log(JSON.stringify(products, null, 2));

  console.log('--- BUSCANDO AGUA EN INVENTORY_ITEMS ---');
  const { data: inv, error: e2 } = await supabase.from('inventory_items').select('*').ilike('name', '%agua%');
  if (e2) console.error(e2);
  else console.log(JSON.stringify(inv, null, 2));
}
check();
