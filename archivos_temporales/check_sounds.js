const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSounds() {
    const { data: sounds, error } = await supabase
        .from('sound_library')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching sounds:', error);
        return;
    }

    console.log('--- Sound Library ---');
    sounds.forEach(s => {
        console.log(`ID: ${s.id}`);
        console.log(`Name: ${s.name}`);
        console.log(`URL: ${s.file_url}`);
        console.log(`Size: ${s.file_size}`);
        console.log('---');
    });

    const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('kds_default_sound_id, kds_alert_enabled, kds_alert_volume, waiter_sound_id')
        .eq('id', 1)
        .single();

    if (settingsError) {
        console.error('Error fetching settings:', settingsError);
        return;
    }

    console.log('--- System Settings ---');
    console.log(settings);
}

checkSounds();
