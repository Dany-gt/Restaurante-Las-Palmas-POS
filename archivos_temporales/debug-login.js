
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
const envLocal = path.resolve(process.cwd(), '.env.local');
let rawKey = "";
if (fs.existsSync(envLocal)) {
    console.log(`Loading env from ${envLocal}`);
    const envConfig = dotenv.parse(fs.readFileSync(envLocal));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} else {
    console.error(`.env.local not found at ${envLocal}`);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (supabaseKey) {
    supabaseKey = supabaseKey.trim();
}

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

// Direct HTTPS test
const url = new URL(supabaseUrl);
const options = {
    hostname: url.hostname,
    port: 443,
    path: '/rest/v1/system_settings?select=*&limit=1', // Try fetching settings
    method: 'GET',
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Origin': 'http://localhost:3000', // Simulate origin
        'Referer': 'http://localhost:3000/'
    }
};

console.log("\nTrying direct HTTPS request (with Origin)...");
const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();


// Run Supabase Client check as well
const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
        headers: {
            'Origin': 'http://localhost:3000'
        }
    }
});

async function runDebug() {
    console.log("\n--- Debugging Login and Logo (Client) ---");

    // 1. Check System Settings (Logo)
    console.log("\nChecking System Settings (Logo)...");
    const { data: settings, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1);

    if (settingsError) {
        console.error("Error fetching settings:", settingsError);
    } else {
        console.log("System Settings:", JSON.stringify(settings, null, 2));
    }

    // 2. Check Profiles (Login)
    console.log("\nChecking Profiles (Users)...");
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, full_name, role, pin');

    if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
    } else {
        console.log(`Found ${profiles.length} profiles.`);
        profiles.forEach(p => {
            console.log(`- User: ${p.name || p.full_name}, Role: ${p.role}, PIN: ${p.pin}`);
        });
    }
}

setTimeout(runDebug, 2000); 
