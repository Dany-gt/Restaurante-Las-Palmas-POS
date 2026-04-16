const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkStations() {
    const { data: stations, error } = await supabase
        .from('kitchen_stations')
        .select('id, name, sound_id');

    if (error) {
        console.error('Error fetching stations:', error);
    } else {
        console.log('Kitchen Stations Sounds:', stations);
    }
}

checkStations();
