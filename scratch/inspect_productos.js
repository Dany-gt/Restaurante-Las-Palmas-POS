const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://cofdsbczmrkriohlgyct.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectTable() {
    console.log('Inspeccionando tabla productos...');
    const { data, error } = await supabase.from('productos').select('*').limit(1);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    if (data && data.length > 0) {
        console.log('Columnas encontradas:', Object.keys(data[0]));
        console.log('Muestra de datos:', data[0]);
    } else {
        console.log('La tabla está vacía. Intentando obtener columnas de otra forma...');
        // Intentar un insert fallido para ver errores o simplemente confiar en el código previo
    }
}

inspectTable();
