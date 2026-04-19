const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const url = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
const key = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];
const supabase = createClient(url, key);

const sql = `
CREATE OR REPLACE FUNCTION void_order_item_rpc(
  p_item_id UUID,
  p_void_reason TEXT,
  p_voided_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_quantity INT;
  v_order_id UUID;
  v_branch_id UUID;
  v_status TEXT;
BEGIN
  -- 1. Get info and check if already voided
  SELECT product_id, quantity, order_id, status 
  INTO v_product_id, v_quantity, v_order_id, v_status
  FROM order_items 
  WHERE id = p_item_id;
  
  IF v_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item no encontrado');
  END IF;

  IF v_status = 'voided' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item ya está anulado');
  END IF;

  -- 2. Get branch_id from order
  SELECT branch_id INTO v_branch_id FROM orders WHERE id = v_order_id;

  -- 3. Mark as voided
  UPDATE order_items 
  SET status = 'voided', 
      void_reason = p_void_reason, 
      voided_at = p_voided_at,
      updated_at = NOW()
  WHERE id = p_item_id;

  -- 4. Restore Stock in products (master)
  UPDATE products 
  SET stock_actual = COALESCE(stock_actual, 0) + v_quantity,
      stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
      updated_at = NOW()
  WHERE id = v_product_id;

  -- 5. Restore Stock in branch inventory (if exists)
  IF v_branch_id IS NOT NULL THEN
    UPDATE product_branch_inventory 
    SET quantity = quantity + v_quantity,
        updated_at = NOW()
    WHERE product_id = v_product_id 
      AND branch_id = v_branch_id;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
`;

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: sql });
  if (error) {
      console.error('Error running RPC:', error);
  } else {
      console.log('RPC Created successfully');
  }
}
run();
