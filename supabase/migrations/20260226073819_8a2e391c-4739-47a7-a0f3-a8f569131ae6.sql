
ALTER TABLE public.institutions 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '217 91% 35%',
ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT 'Your trusted banking partner';
