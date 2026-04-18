const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cofdsbczmrkriohlgyct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixItems() {
    console.log('Buscando Agua Pura en productos incorrectos...');
    
    // 1. Encontrar el producto mal guardado
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%AGUA PURA BOTELLA%')
        .eq('es_platillo', false);

    if (pError) {
        console.error('Error buscando productos:', pError);
        return;
    }

    if (!products || products.length === 0) {
        console.log('No se encontraron registros de Agua Pura Botella como producto.');
        return;
    }

    console.log(`Encontrados ${products.length} registros para corregir.`);

    // 2. Encontrar la categoría "AGUA PURA" en menu_categories
    const { data: categories, error: cError } = await supabase
        .from('menu_categories')
        .select('id, nombre')
        .ilike('nombre', '%AGUA PURA%');

    if (cError) {
        console.error('Error buscando categorías:', cError);
        return;
    }

    const aguaPuraId = categories?.find(c => c.nombre.toUpperCase().includes('AGUA PURA'))?.id;

    if (!aguaPuraId) {
        console.log('No se encontró la categoría AGUA PURA en menu_categories. Buscando cualquier categoría...');
        const candidate = categories?.[0]?.id;
        if (candidate) {
            console.log(`Usando categoría candidata: ${categories[0].nombre}`);
            await updateItems(products, candidate);
        } else {
            console.error('No se encontró ninguna categoría candidata.');
        }
        return;
    }

    console.log(`ID de categoría encontrado: ${aguaPuraId}`);
    await updateItems(products, aguaPuraId);
}

async function updateItems(products, categoryId) {
    for (const p of products) {
        console.log(`Corrigiendo ${p.name} (ID: ${p.id})...`);
        const { error: uError } = await supabase
            .from('products')
            .update({
                es_platillo: true,
                menu_category_id: categoryId,
                category_id: null
            })
            .eq('id', p.id);

        if (uError) {
            console.error(`Error actualizando ID ${p.id}:`, uError);
        } else {
            console.log(`ID ${p.id} actualizado con éxito.`);
        }
    }
}

fixItems();
