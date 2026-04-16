-- Add image_url column to categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Verify the column was added (optional, for checking reference)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'categories' AND column_name = 'image_url';
