
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('name')
        .order('name');

    if (error) {
        console.error('Error fetching categories:', error);
        return;
    }

    console.log('--- DB CATEGORIES ---');
    data.forEach(c => console.log(`'${c.name.toUpperCase()}',`));
    console.log('---------------------');
}

checkCategories();
