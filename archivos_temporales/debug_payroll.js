const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cofdsbczmrkriohlgyct.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZmRzYmN6bXJrcmlvaGxneWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQyNTcsImV4cCI6MjA4NDg0MDI1N30.39aB4hkeoa_bnxEB62ZB1coM6BbzE75tm2CKcSgFPvY'
);

async function check() {
  const { data, error } = await supabase
    .from('payroll_quincena_records')
    .select('*, payroll_employees(position, department)')
    .eq('period_label', '2026-04');

  if (error) {
    console.error('Error fetching payroll:', error);
    return;
  }

  console.log('--- Results for 2026-04 ---');
  console.log('Total records:', data.length);
  
  if (data.length > 0) {
    data.forEach((r, i) => {
      console.log(`Record ${i + 1}:`);
      console.log('  Employee ID:', r.employee_id);
      console.log('  Base Salary:', r.base_salary_at_time);
      console.log('  Employee Data:', JSON.stringify(r.payroll_employees));
    });
  } else {
    const { data: labels } = await supabase
      .from('payroll_quincena_records')
      .select('period_label')
      .limit(5);
    console.log('Sample period_labels in DB:', labels.map(l => l.period_label));
  }
}

check();
