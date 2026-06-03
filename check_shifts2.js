const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const supabaseUrlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: shifts, error } = await supabase.from('shifts').select('id, branch_id').limit(10).order('created_at', { ascending: false });
    console.log('recent shifts branch_ids:', shifts.map(s => s.branch_id));
}
main();
