-- Migration to fix missing equivalence column and add error checking to purchases
ALTER TABLE public.inventory_purchase_items ADD COLUMN IF NOT EXISTS equivalence DECIMAL(12,4) DEFAULT 1;

COMMENT ON COLUMN public.inventory_purchase_items.equivalence IS 'Factor de conversión/contenido al momento de la compra (unidades base por unidad comprada)';
