const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testUrls() {
    const { data: sounds, error } = await supabase
        .from('sound_library')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching sounds:', error);
        return;
    }

    for (const s of sounds) {
        console.log(`Testing ${s.name}: ${s.file_url}`);
        try {
            const resp = await axios.head(s.file_url);
            console.log(`  Result: ${resp.status} ${resp.statusText}`);
        } catch (e) {
            console.log(`  Result: FAILED (${e.message})`);
        }
    }
}

testUrls();
