const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://cofdsbczmrkriohlgyct.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY');

(async () => {
    const { data: custs } = await supabase.from('customers').select('id, name, created_at, current_balance').order('created_at', { ascending: false }).limit(2);
    console.log('Recent customers from table:', custs);
    
    if (custs && custs.length > 0) {
        const { data: viewData } = await supabase.from('receivables_summary').select('*').in('id', custs.map(c => c.id));
        console.log('Customers in view receivables_summary:', viewData);
    }
})();
