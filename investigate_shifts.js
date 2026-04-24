
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShifts() {
    console.log('Checking shifts table...');
    const { data, error } = await supabase
        .from('shifts')
        .select('id, start_time, end_time, status, shift_number')
        .order('start_time', { ascending: false });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Found ${data.length} shifts.`);
        if (data.length > 0) {
            console.log('Latest 5 shifts:');
            data.slice(0, 5).forEach(s => {
                console.log(`ID: ${s.id}, Start: ${s.start_time}, End: ${s.end_time}, Status: ${s.status}, No: ${s.shift_number}`);
            });
        }
    }
}

checkShifts();
