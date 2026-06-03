const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(supabaseUrlMatch[1].trim(), supabaseKeyMatch[1].trim());

async function main() {
    const { data: crs } = await supabase.from('cash_registers').select('name, branch_id');
    const { data: branches } = await supabase.from('branches').select('id, name');
    
    console.log('Branches:', branches);
    console.log('Cash Registers:', crs);
}
main();
