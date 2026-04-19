ALTER TABLE public.pos_products
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS sub_category TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_products_category ON public.pos_products(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_products_sub_category ON public.pos_products(sub_category) WHERE sub_category IS NOT NULL;