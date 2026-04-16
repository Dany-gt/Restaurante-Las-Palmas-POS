
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    // ── D3: supply_categories (sin sort_order) ────────
    console.log('[D3] Seeding supply_categories...');
    const supplyCats = [
        { name: 'DESECHABLES' },
        { name: 'EMPAQUE PARA LLEVAR' },
        { name: 'LIMPIEZA' },
        { name: 'COCINA CONSUMIBLES' },
        { name: 'OFICINA Y POS' },
    ];
    for (const cat of supplyCats) {
        const check = await s.from('supply_categories').select('id').eq('name', cat.name).maybeSingle();
        if (!check.data) {
            const r = await s.from('supply_categories').insert(cat).select('id, name');
            if (r.error) console.log('  ✗', cat.name, r.error.message);
            else console.log('  ✓', cat.name);
        } else {
            console.log('  — ya existe:', cat.name);
        }
    }

    // ── D4: utensil_categories (sin sort_order) ───────
    console.log('\n[D4] Seeding utensil_categories...');
    const utensilCats = [
        { name: 'VAJILLA' },
        { name: 'CRISTALERÍA' },
        { name: 'CUBIERTOS' },
        { name: 'UTENSILIOS DE COCINA' },
        { name: 'EQUIPOS MENORES' },
        { name: 'ALMACENAMIENTO' },
        { name: 'LIMPIEZA DE COCINA' },
        { name: 'PRESENTACIÓN Y SERVICIO' },
    ];
    for (const cat of utensilCats) {
        const check = await s.from('utensil_categories').select('id').eq('name', cat.name).maybeSingle();
        if (!check.data) {
            const r = await s.from('utensil_categories').insert(cat).select('id, name');
            if (r.error) console.log('  ✗', cat.name, r.error.message);
            else console.log('  ✓', cat.name);
        } else {
            console.log('  — ya existe:', cat.name);
        }
    }

    // ── D1: menu_categories (seed si vacía) ───────────
    console.log('\n[D1] Seeding menu_categories...');
    const { count: mc } = await s.from('menu_categories').select('id', { count: 'exact', head: true });
    if (mc === 0) {
        // Detecta columna de nombre
        const testN = await s.from('menu_categories').insert({ nombre: '__T__' }).select();
        const colName = testN.error ? 'name' : 'nombre';
        await s.from('menu_categories').delete().eq(colName, '__T__');
        const menuCats = ['ENTRADAS','SOPAS Y CONSOMÉS','CEVICHES','AGUACHILES','CALDOS',
            'PLATOS FUERTES','MARISCOS A LA PLANCHA','COMIDA CHINA','DESAYUNOS',
            'POSTRES','BEBIDAS','ESPECIALES DEL CHEF','COMBOS'];
        for (const [i, n] of menuCats.entries()) {
            const r = await s.from('menu_categories').insert({ [colName]: n, sort_order: i + 1 }).select('id');
            if (r.error) console.log('  ✗', n, r.error.message);
            else console.log('  ✓', n);
        }
    } else {
        console.log('  — ya tiene', mc, 'registros, no se siembra');
    }

    // ── D2: product_categories (seed si vacía) ───────
    console.log('\n[D2] Seeding product_categories...');
    const { count: pc } = await s.from('product_categories').select('id', { count: 'exact', head: true });
    if (pc === 0) {
        const testN = await s.from('product_categories').insert({ nombre: '__T__' }).select();
        const colName = testN.error ? 'name' : 'nombre';
        await s.from('product_categories').delete().eq(colName, '__T__');
        const prodCats = ['ACEITES','BEBIDAS (BODEGA)','CAMARONES','CARNES','MARISCOS',
            'POLLO','RES','CHILES','CÍTRICOS','CREMAS','EMBUTIDOS','ENDULZANTES',
            'ESPECIAS Y CONDIMENTOS','FRUTAS','GRANOS Y CEREALES','HARINAS','HIELO',
            'LÁCTEOS','LICORES','MIXER Y COMPLEMENTOS','PANES','SALSAS','VERDURAS','OTROS INSUMOS'];
        for (const [i, n] of prodCats.entries()) {
            const r = await s.from('product_categories').insert({ [colName]: n, sort_order: i + 1 }).select('id');
            if (r.error) console.log('  ✗', n, r.error.message);
            else console.log('  ✓', n);
        }
    } else {
        console.log('  — ya tiene', pc, 'registros, no se siembra');
    }

    console.log('\n=== Done ===');
}

run().catch(console.error);
