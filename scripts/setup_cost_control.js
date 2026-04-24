const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function setup() {
    console.log('--- Starting Cost Control Database Setup ---');

    // 1. Create Tables (Note: create table via RPC only works if you have a helper function prepared, 
    // otherwise it might fail. In many Supabase projects, users manually create tables. 
    // To be safe, I will try to use the rpc('exec_sql') if it exists, 
    // but the most reliable way for me as an agent is to provide the SQL for the user to run if I can't.
    // However, I can try to check if I can define the function first.)

    // For this environment, I'll try to insert data directly if tables exist.
    // If they don't, I'll provide the SQL to the user in the final notification.

    try {
        const { data: configCheck, error: configError } = await supabase.from('cost_control_config').select('*').limit(1);

        if (configError && configError.code === 'PGRST204') {
            console.error('Table cost_control_config does not exist. Please run the SQL script first.');
            return;
        }

        console.log('Tables exist. Inserting initial data...');

        // Insert Config
        const { error: err1 } = await supabase.from('cost_control_config').upsert({
            org_id: 'default',
            monthly_sales: 275000,
            operating_days: 26
        }, { onConflict: 'org_id' });
        if (err1) console.error('Error inserting config:', err1);

        // Clear existing items to avoid duplicates if re-running
        await supabase.from('cost_items').delete().eq('org_id', 'default');

        // Insert Raw Materials
        const rawMaterials = [
            { section: 'raw_material', description: 'Materia prima cocina', amount: 0, sort_order: 1, is_deletable: false },
            { section: 'raw_material', description: 'Materia prima cevichería', amount: 0, sort_order: 2, is_deletable: false },
            { section: 'raw_material', description: 'Materia prima bebidas', amount: 0, sort_order: 3, is_deletable: false },
            { section: 'raw_material', description: 'Otros insumos directos', amount: 0, sort_order: 4, is_deletable: false }
        ];
        const { error: err2 } = await supabase.from('cost_items').insert(rawMaterials);
        if (err2) console.error('Error inserting raw materials:', err2);

        // Insert MOD
        const mods = [
            { section: 'mod', description: 'Cocineras', persons: 5, base_salary: 3816.90, benefits_pct: 47.67, sort_order: 1, is_deletable: false },
            { section: 'mod', description: 'Preparador', persons: 1, base_salary: 3816.90, benefits_pct: 47.67, sort_order: 2, is_deletable: false },
            { section: 'mod', description: 'Cevicheros', persons: 2, base_salary: 3816.90, benefits_pct: 47.67, sort_order: 3, is_deletable: false }
        ];
        const { error: err3 } = await supabase.from('cost_items').insert(mods);
        if (err3) console.error('Error inserting MOD:', err3);

        // Insert Fixed
        const fixed = [
            { section: 'fixed', description: 'Planilla meseros (5 con prestaciones)', amount: 19084.50, sort_order: 1 },
            { section: 'fixed', description: 'Planilla admin / aux (Danilo)', amount: 3816.90, sort_order: 2 },
            { section: 'fixed', description: 'Planilla limpieza / jardinero', amount: 3816.90, sort_order: 3 },
            { section: 'fixed', description: 'Alquiler del local', amount: 11788.10, sort_order: 4 },
            { section: 'fixed', description: 'Energía eléctrica', amount: 2876.00, sort_order: 5 },
            { section: 'fixed', description: 'Agua potable', amount: 180.00, sort_order: 6 },
            { section: 'fixed', description: 'Internet y telefonía (Tigo + Claro)', amount: 463.00, sort_order: 7 },
            { section: 'fixed', description: 'Prohigiene', amount: 991.67, sort_order: 8 },
            { section: 'fixed', description: 'Extracción de basura', amount: 20.00, sort_order: 9 },
            { section: 'fixed', description: 'Mantenimiento extractores', amount: 733.33, sort_order: 10 },
            { section: 'fixed', description: 'Mantenimiento A/C', amount: 600.00, sort_order: 11 },
            { section: 'fixed', description: 'Servicio agua potable adicional', amount: 180.00, sort_order: 12 },
            { section: 'fixed', description: 'Pago de contador', amount: 1000.00, sort_order: 13 },
            { section: 'fixed', description: 'Paladar (sistema)', amount: 300.00, sort_order: 14 },
            { section: 'fixed', description: 'Seguridad Goian', amount: 295.00, sort_order: 15 },
            { section: 'fixed', description: 'SKY', amount: 199.00, sort_order: 16 },
            { section: 'fixed', description: 'Tigo Residencial', amount: 244.00, sort_order: 17 },
            { section: 'fixed', description: 'IRTRA / otros patronales', amount: 343.52, sort_order: 18 },
            { section: 'fixed', description: 'INTECAP', amount: 343.52, sort_order: 19 }
        ];
        const { error: err4 } = await supabase.from('cost_items').insert(fixed);
        if (err4) console.error('Error inserting fixed:', err4);

        // Insert Variable
        const variable = [
            { section: 'variable', description: 'Combustible y gas propano', amount: 4500.00, sort_order: 1 },
            { section: 'variable', description: 'Energía eléctrica variable', amount: 2876.00, sort_order: 2 },
            { section: 'variable', description: 'Artículos de limpieza', amount: 1405.32, sort_order: 3 },
            { section: 'variable', description: 'Desechables', amount: 1500.00, sort_order: 4 },
            { section: 'variable', description: 'Rollos para impresora', amount: 158.33, sort_order: 5 },
            { section: 'variable', description: 'Combustible vehículo / Corsa', amount: 1500.00, sort_order: 6 },
            { section: 'variable', description: 'Transporte', amount: 300.00, sort_order: 7 },
            { section: 'variable', description: 'Fumigación', amount: 620.00, sort_order: 8 },
            { section: 'variable', description: 'Papelería de oficina', amount: 50.00, sort_order: 9 },
            { section: 'variable', description: 'Adornos / decoración', amount: 200.00, sort_order: 10 },
            { section: 'variable', description: 'Mantenimiento establecimiento', amount: 3000.00, sort_order: 11 },
            { section: 'variable', description: 'Horas extras (variable)', amount: 0, sort_order: 12 },
            { section: 'variable', description: 'Repuestos mantenimiento A/C', amount: 0, sort_order: 13 }
        ];
        const { error: err5 } = await supabase.from('cost_items').insert(variable);
        if (err5) console.error('Error inserting variable:', err5);

        console.log('--- Database Setup Completed Successfully ---');
    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

setup();
