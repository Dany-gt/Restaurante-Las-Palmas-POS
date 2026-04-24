const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://cofdsbczmrkriohlgyct.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY');

const sql = `
DROP VIEW IF EXISTS "public"."receivables_summary";

CREATE OR REPLACE VIEW "public"."receivables_summary" AS
 SELECT 
    c.id,
    c.name AS customer_name,
    c.nit AS client_nit,
    c.phone AS telephone,
    c.credit_limit AS limite_credito,
    c.authorized_discount AS descuento,
    COALESCE(c.current_balance, (0)::numeric) AS saldo,
    c.email,
    c.address,
    c.created_at AS fecha_registro,
    c.is_active,
    COALESCE(sum(
        CASE
            WHEN ((t.type)::text = 'CARGO'::text) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_cargos,
    COALESCE(sum(
        CASE
            WHEN ((t.type)::text = 'ABONO'::text) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_pagos,
    COALESCE(sum(
        CASE
            WHEN ((t.type)::text = 'CARGO'::text) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_vendido,
    COALESCE(sum(
        CASE
            WHEN ((t.type)::text = 'ABONO'::text) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_abonado,
    max(
        CASE
            WHEN ((t.type)::text = 'ABONO'::text) THEN t.created_at
            ELSE NULL::timestamp with time zone
        END) AS ultimo_pago,
    max(
        CASE
            WHEN ((t.type)::text = 'CARGO'::text) THEN t.created_at
            ELSE NULL::timestamp with time zone
        END) AS ultimo_cargo
   FROM (public.customers c
     LEFT JOIN public.credit_transactions t ON ((c.id = t.customer_id)))
  GROUP BY c.id;
`;

(async () => {
    const { data: sqlRes, error } = await supabase.rpc('execute_sql', { sql });
    console.log('Result:', sqlRes);
    if (error) console.error('Error:', error);
})();
