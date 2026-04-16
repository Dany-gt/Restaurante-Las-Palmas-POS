import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Configuración de variables de entorno desde .env.local
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Error: No se encontraron las credenciales de Supabase en .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    console.log('--- Verificando Conexión a Base de Datos ---');

    // Probar tabla de proveedores
    const { data: sData, error: sError } = await supabase.from('suppliers').select().limit(1);

    if (sError) {
        console.error('Error en tabla suppliers:', sError.message);
    } else {
        console.log('✓ Tabla suppliers: Conexión OK');
        if (sData && sData.length > 0) {
            console.log('  Columnas encontradas:', Object.keys(sData[0]).join(', '));
        }
    }

    // Probar tabla de sucursales de proveedores
    const { data: bData, error: bError } = await supabase.from('supplier_branches').select().limit(1);

    if (bError) {
        console.error('Error en tabla supplier_branches:', bError.message);
    } else {
        console.log('✓ Tabla supplier_branches: Existe y es accesible');
    }
}

check().catch(err => console.error('Error de ejecución:', err));
