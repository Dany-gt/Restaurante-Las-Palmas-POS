const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategoryIds() {
    const { data: cats, error } = await supabase
        .from('categories')
        .select('id, name, section');

    if (error) {
        console.error('Error fetching categories:', error);
        return;
    }

    console.log('--- ALL CATEGORIES ---');
    console.log(JSON.stringify(cats, null, 2));
    console.log('----------------------');
}

checkCategoryIds();
