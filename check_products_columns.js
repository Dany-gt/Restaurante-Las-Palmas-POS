const { createClient } = require('@supabase/supabase-client');
const fs = require('fs');

// Read supabase URL and Key from a file or environment
// In this project they are in supabase.ts usually, but I'll try to find them.
const content = fs.readFileSync('supabase.ts', 'utf8');
const urlMatch = content.match(/const supabaseUrl = ['"](.*)['"]/);
const keyMatch = content.match(/const supabaseAnonKey = ['"](.*)['"]/);

if (!urlMatch || !keyMatch) {
    console.error('Could not find supabase config');
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkColumns() {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns in products:', Object.keys(data[0]));
        console.log('Sample row:', data[0]);
    } else {
        console.log('No data in products table');
    }
}

checkColumns();
