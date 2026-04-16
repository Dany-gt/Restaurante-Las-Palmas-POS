const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

(async () => {
             let query = supabase
                .from('invoices')
                .select(`
                    id,
                    created_at,
                    series,
                    document_number,
                    uuid,
                    customer_nit,
                    customer_name,
                    authorization_number,
                    grand_total,
                    status,
                    pdf_url,
                    order:orders (
                        id,
                        order_number,
                        order_type,
                        branch_id,
                        cancellation_reason,
                        subtotal,
                        discount_amount,
                        tip_amount,
                        total,
                        tables:table_id (
                            number,
                            section
                        ),
                        profiles!waiter_id (name),
                        cancelled_profile:profiles!cancelled_by (name)
                    )
                `)
                .order('created_at', { ascending: false });

            // Filtro de Fechas
            query = query.gte('created_at', `2026-01-01T00:00:00`);
            query = query.lte('created_at', `2026-03-31T23:59:59`);
            query = query.or('series.eq.CONT,uuid.is.null,uuid.eq."",document_number.ilike.%PENDIENTE%');

            const { data: res, error } = await query;
            console.log("Error:", error);
            console.log("Length:", res ? res.length : 0);
            if(res && res.length > 0) {
                console.log("Sample:", JSON.stringify(res[0], null, 2));
            }
})();
