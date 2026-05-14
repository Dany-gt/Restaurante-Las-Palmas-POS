
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local for credentials
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking system_settings columns...');
    const { data: settings, error: sError } = await supabase.from('system_settings').select('*').limit(1);
    if (sError) console.error('Error fetching settings:', sError);
    else {
        console.log('Columns in system_settings:', Object.keys(settings[0]));
    }

    console.log('\nChecking sound_library columns...');
    const { data: sounds, error: dError } = await supabase.from('sound_library').select('*').limit(1);
    if (dError) console.error('Error fetching sounds:', dError);
    else if (sounds.length > 0) {
        console.log('Columns in sound_library:', Object.keys(sounds[0]));
    } else {
        console.log('sound_library table is empty');
    }
}

check();
