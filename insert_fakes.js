const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function injectFakes() {
    console.log("Inyectando facturas falsas para demostración visual...");

    const fakePurchase = {
        org_id: 'default',
        invoice_date: '2026-04-05',
        invoice_number: 'DEMO-COMPRA-ANULADA',
        description: 'Turbo Sync SAT: DEMO FACTURA ANULADA PEQUEÑO CONTRIBUYENTE',
        total_amount: 150.00,
        iva_amount: 0.00,
        net_amount: 150.00,
        category: 'Otros',
        fel_uuid: 'FFFFFFFF-AAAA-BBBB-CCCC-111111111111',
        status: 'annulled',
        tipo_dte: 'FPEQ',
        supplier_nit: '99999999',
        supplier_name: 'DEMOSTRACION VISUAL ANULADA SA.'
    };

    const fakeSale = {
        org_id: 'default',
        invoice_date: '2026-04-05',
        invoice_number: 'DEMO-VENTA-NCRE',
        description: 'Turbo Sync SAT: DEMO NOTA CREDITO',
        total_amount: -50.00,
        iva_amount: -5.36,
        net_amount: -44.64,
        category: 'Ventas',
        fel_uuid: 'FFFFFFFF-AAAA-BBBB-CCCC-222222222222',
        status: 'paid', // Las notas de credito no necesariamente estan anuladas, pero son tipo NCRE
        tipo_dte: 'NCRE',
        customer_nit: 'CF',
        customer_name: 'DEMO NOTA DE CREDITO'
    };

    const fakeSaleAnulada = {
        org_id: 'default',
        invoice_date: '2026-04-05',
        invoice_number: 'DEMO-VENTA-ANULADA',
        description: 'Turbo Sync SAT: DEMO VENTA ANULADA',
        total_amount: 200.00,
        iva_amount: 21.43,
        net_amount: 178.57,
        category: 'Ventas',
        fel_uuid: 'FFFFFFFF-AAAA-BBBB-CCCC-333333333333',
        status: 'annulled',
        tipo_dte: 'FACT',
        customer_nit: 'CF',
        customer_name: 'DEMO CLIENTE ANULADO'
    };
    
    await supabase.from('purchase_invoices').insert([fakePurchase]);
    await supabase.from('sales_invoices').insert([fakeSale, fakeSaleAnulada]);

    console.log("Inyeccion lista! Dile al usuario que refresque.");
}

injectFakes();
