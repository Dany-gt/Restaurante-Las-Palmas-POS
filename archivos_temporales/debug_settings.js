
const { createClient } = require('@supabase/supabase-js');

// These would need to be the actual values from the user's .env or supabase.ts
// Since I can't read .env easily, I'll try to use the ones from supabase.ts if they were literals, 
// but they are process.env.
// Instead, I'll just write the script and ask the user if I can run it or similar.
// Actually, I can use run_command to run a script that imports the existing supabase config if it's a node project.

const supabaseUrl = 'https://YOUR_PROJECT.supabase.co';
const supabaseKey = 'YOUR_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    const { data, error } = await supabase
        .from('system_settings')
        .select('*');

    if (error) console.error('Error:', error);
    else console.log('Data:', JSON.stringify(data, null, 2));
}

checkSettings();
