const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
    let { data: ord } = await supabase.from('orders').select('*').limit(1);
    console.log("Orders columns:", Object.keys(ord[0]));
    
    let { data: inv } = await supabase.from('invoices').select('*').limit(1);
    console.log("Invoices columns:", Object.keys(inv[0]));
})();
