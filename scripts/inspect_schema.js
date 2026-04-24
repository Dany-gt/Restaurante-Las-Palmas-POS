const SUPABASE_URL = 'https://cofdsbczmrkriohlgyct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function check() {
    for (const table of ['purchase_invoices', 'sales_invoices']) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers });
        const data = await res.json();
        console.log(`--- SCHEMA SAMPLE: ${table} ---`);
        console.log(JSON.stringify(data[0] || {}, null, 2));
    }
}

check();
