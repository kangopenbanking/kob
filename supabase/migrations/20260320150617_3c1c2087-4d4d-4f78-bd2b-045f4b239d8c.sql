ALTER TABLE public.pos_store_profiles 
ADD COLUMN IF NOT EXISTS sub_category TEXT,
ADD COLUMN IF NOT EXISTS custom_attributes_json JSONB DEFAULT '[]'::jsonb;