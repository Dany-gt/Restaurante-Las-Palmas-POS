const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMenuCategories() {
    // Check if menu_categories table exists and what it contains
    const { data, error } = await supabase
        .from('menu_categories')
        .select('*');

    if (error) {
        console.error('Error fetching menu_categories:', error);
        return;
    }

    console.log('--- MENU CATEGORIES ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('-----------------------');
}

checkMenuCategories();
