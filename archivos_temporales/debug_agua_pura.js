
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAguaPura() {
    console.log('--- BUSCANDO AGUA PURA BOTELLA ---');
    const { data: products, error: pError } = await supabase.from('products').select('id, name').ilike('name', '%Agua Pura%');

    if (pError) {
        console.error(pError);
        return;
    }

    if (products.length === 0) {
        console.log('No se encontró el producto.');
        return;
    }

    for (const p of products) {
        console.log(`\nProducto: ${p.name} (ID: ${p.id})`);

        const { data: options } = await supabase.from('product_option_groups').select('*, option_groups(name)').eq('product_id', p.id);
        console.log(`Opciones asociadas: ${options?.length || 0}`);
        options?.forEach(o => console.log(` - Group ID: ${o.group_id}, Name: ${o.option_groups?.name}`));

        const { data: modifiers } = await supabase.from('product_modifier_groups').select('*, modifier_groups(name)').eq('product_id', p.id);
        console.log(`Modificadores asociados: ${modifiers?.length || 0}`);
        modifiers?.forEach(m => console.log(` - Group ID: ${m.group_id}, Name: ${m.modifier_groups?.name}`));
    }
}

debugAguaPura();
