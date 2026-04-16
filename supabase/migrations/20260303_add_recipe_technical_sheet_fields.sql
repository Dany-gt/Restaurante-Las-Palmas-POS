-- Add recipe technical sheet fields to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS classification TEXT,
ADD COLUMN IF NOT EXISTS portions INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS portion_size TEXT,
ADD COLUMN IF NOT EXISTS serving_temp TEXT,
ADD COLUMN IF NOT EXISTS prep_time TEXT,
ADD COLUMN IF NOT EXISTS prepared_by TEXT,
ADD COLUMN IF NOT EXISTS prep_procedure TEXT,
ADD COLUMN IF NOT EXISTS observations TEXT;
