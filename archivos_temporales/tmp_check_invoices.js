const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://cofdsbczmrkriohlgyct.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY');

async function check() {
    const { data } = await s.from('invoices').select('*').order('created_at', { ascending: false }).limit(5);
    console.log('--- DATA START ---');
    data.forEach((d, i) => {
        console.log(`INV ${i}: ${d.created_at} | Series: ${d.series} | Status: ${d.status} | Order: ${d.order_id}`);
    });
    console.log('--- DATA END ---');
}

check();
