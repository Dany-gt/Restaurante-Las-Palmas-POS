import { supabase } from './supabase';

async function checkColumns() {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columnas encontradas en products:', Object.keys(data[0]));
        console.log('Ejemplo de producto:', data[0]);
    } else {
        console.log('No se encontraron productos.');
    }
}

checkColumns();
