
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShiftsWithBranches() {
    console.log('Checking shifts with branch info...');
    const { data, error } = await supabase
        .from('shifts')
        .select('id, start_time, branch_id, cash_register_id')
        .order('start_time', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data.length} latest shifts.`);
        data.forEach(s => {
            console.log(`Shift ID: ${s.id}, Start: ${s.start_time}, BranchID: ${s.branch_id}, RegisterID: ${s.cash_register_id}`);
        });
    }

    const { data: bData } = await supabase.from('branches').select('id, name');
    console.log('Available branches:', bData);
}

checkShiftsWithBranches();
