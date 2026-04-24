const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
    console.log("Testing generic query");
    let query = supabase.from('invoices').select('*').limit(5);
    let { data, error } = await query;
    console.log("Generic error:", error);
    
    console.log("Testing with .or");
    query = supabase.from('invoices').select('*').or('series.eq.CONT,uuid.is.null,uuid.eq."",document_number.ilike.%PENDIENTE%');
    let res = await query;
    console.log("OR error:", res.error);
    console.log("OR length:", res.data ? res.data.length : 0);
})();
