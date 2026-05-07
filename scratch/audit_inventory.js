const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1];
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditAguaPura() {
    console.log('--- AUDIT AGUA PURA ---');
    
    // 1. Find all products named Agua Pura
    const { data: products } = await supabase.from('products').select('*').ilike('name', '%Agua Pura%');
    console.log('Products found:', products?.length);
    products?.forEach(p => console.log(` - ID: ${p.id}, Name: ${p.name}, es_platillo: ${p.es_platillo}`));

    // 2. Check inventory_item_branches
    const { data: itemBranches } = await supabase.from('inventory_item_branches').select('*, branches(name)').order('branch_id');
    const relevantStocks = itemBranches?.filter(s => products?.some(p => p.id === s.item_id));
    console.log('\nInventory Item Branches (Insumos):');
    relevantStocks?.forEach(s => console.log(` - ItemID: ${s.item_id}, Branch: ${s.branches?.name}, Qty: ${s.quantity}`));

    // 3. Check product_branch_inventory
    const { data: productInventory } = await supabase.from('product_branch_inventory').select('*');
    const relevantProdStocks = productInventory?.filter(s => products?.some(p => p.id === s.product_id));
    console.log('\nProduct Branch Inventory (Venta):');
    relevantProdStocks?.forEach(s => console.log(` - ProdID: ${s.product_id}, Qty: ${s.quantity}`));

    // 4. Check Recipes
    const { data: recipes } = await supabase.from('inventory_item_recipes').select('*');
    const relevantRecipes = recipes?.filter(r => products?.some(p => p.id === r.child_id || p.id === r.parent_id));
    console.log('\nRecipes found:', relevantRecipes?.length);
}

auditAguaPura();
