
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function listSounds() {
    console.log('Listing sounds in sound_library...');
    const { data: sounds, error } = await supabase.from('sound_library').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (error) console.error('Error fetching sounds:', error);
    else {
        sounds.forEach(s => {
            console.log(`ID: ${s.id} | Name: ${s.name} | URL: ${s.file_url}`);
        });
    }
}

listSounds();
