const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cofdsbczmrkriohlgyct.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY'
);

async function checkOrders() {
  try {
    // Check max order number in orders table
    const { data: maxOrder, error: err1 } = await supabase
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1);
      
    if (err1) console.error('Error fetching max order:', err1);
    else console.log('Max order_number in orders table:', maxOrder);

    // Check min order number
    const { data: minOrder, error: err2 } = await supabase
      .from('orders')
      .select('order_number')
      .not('order_number', 'is', null)
      .order('order_number', { ascending: true })
      .limit(1);
      
    if (err2) console.error('Error fetching min order:', err2);
    else console.log('Min order_number in orders table:', minOrder);

    // Check custom system_sequences table if it exists
    const { data: seq, error: err3 } = await supabase
      .from('system_sequences')
      .select('*')
      .eq('seq_name', 'order_number');
      
    if (err3) console.error('No system_sequences table or error:', err3.message);
    else console.log('system_sequences table value:', seq);

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkOrders();
