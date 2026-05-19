const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMenuCategoriesList() {
    const { data, error } = await supabase
        .from('menu_categories')
        .select('id, nombre, parent_id');

    if (error) {
        console.error('Error fetching menu_categories:', error);
        return;
    }

    console.log('--- ALL MENU CATEGORIES ---');
    data.forEach(c => console.log(`${c.nombre} (${c.id}) parent_id: ${c.parent_id}`));
    console.log('---------------------------');
}

checkMenuCategoriesList();
