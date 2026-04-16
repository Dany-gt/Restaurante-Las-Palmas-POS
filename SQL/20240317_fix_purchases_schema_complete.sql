-- Migration to fix missing columns in inventory_purchases and inventory_purchase_items

-- 1. Add missing columns to inventory_purchases
ALTER TABLE public.inventory_purchases ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'NO PAGADA';
ALTER TABLE public.inventory_purchases ADD COLUMN IF NOT EXISTS executed_by TEXT;
ALTER TABLE public.inventory_purchases ADD COLUMN IF NOT EXISTS voided_by TEXT;

-- 2. Add missing column to inventory_purchase_items
ALTER TABLE public.inventory_purchase_items ADD COLUMN IF NOT EXISTS equivalence DECIMAL(12,4) DEFAULT 1;

-- Add comments for clarity
COMMENT ON COLUMN public.inventory_purchases.payment_status IS 'Estado del pago de la factura (PAGADA, NO PAGADA, etc)';
COMMENT ON COLUMN public.inventory_purchase_items.equivalence IS 'Factor de conversión al momento de la compra';
