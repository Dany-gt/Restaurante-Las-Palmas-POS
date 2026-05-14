const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
    // Check system_settings columns
    const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1);

    if (settingsError) {
        console.error('Error fetching settings:', settingsError);
    } else {
        console.log('System Settings Columns:', Object.keys(settings[0] || {}));
        console.log('Current Settings Values:', settings[0]);
    }

    // Check ALERTA DIGITAL entry
    const { data: alertaDigital, error: alertaError } = await supabase
        .from('sound_library')
        .select('*')
        .ilike('name', '%ALERTA DIGITAL%');

    if (alertaError) {
        console.error('Error fetching Alerta Digital:', alertaError);
    } else {
        console.log('Alerta Digital Record:', alertaDigital);
    }
}

checkSchema();
