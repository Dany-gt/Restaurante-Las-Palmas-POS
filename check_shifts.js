const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: shifts, error } = await supabase.from('shifts').select('*').limit(1);
    console.log('shifts error:', error);
    if (shifts && shifts.length > 0) {
        console.log('shifts columns:', Object.keys(shifts[0]));
    }

    const { data: crs, error: e2 } = await supabase.from('cash_registers').select('*').limit(2);
    console.log('cash registers error:', e2);
    console.log('cash registers:', crs);
}

main();
