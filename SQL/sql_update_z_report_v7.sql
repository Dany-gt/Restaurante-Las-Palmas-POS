-- Add information for card processors and improved Z-Report
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS card_processor TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- Index for faster shift closure queries
CREATE INDEX IF NOT EXISTS idx_orders_created_at_status ON public.orders(created_at, status);
CREATE INDEX IF NOT EXISTS idx_expenses_shift_id ON public.expenses(shift_id);
