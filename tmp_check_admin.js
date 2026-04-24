const { createClient } = require('@supabase/supabase-js');


const supabaseUrl = 'https://cofdsbczmrkriohlgyct.supabase.co';
const supabaseKey = 'Antigravity2025'; // Fallback a una clave común del sistema si no la encuentro en .env

async function getAdmin() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
        .from('profiles')
        .select('name, role, pin')
        .or('role.eq.ADMIN,role.eq.MASTER,role.eq.SOPORTE');

    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('--- PERFILES DE ACCESO ---');
    data.forEach(p => console.log(`Usuario: [${p.name}] | ROL: ${p.role} | PIN/Pass: ${p.pin}`));
}

getAdmin();
