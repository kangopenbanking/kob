-- Add missing columns to api_clients for developer API key management
ALTER TABLE public.api_clients 
ADD COLUMN IF NOT EXISTS developer_email TEXT,
ADD COLUMN IF NOT EXISTS developer_company TEXT,
ADD COLUMN IF NOT EXISTS developer_use_case TEXT,
ADD COLUMN IF NOT EXISTS api_environment TEXT DEFAULT 'sandbox',
ADD COLUMN IF NOT EXISTS rate_limit_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS monthly_requests_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS requests_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_request_at TIMESTAMPTZ;

-- Add index for faster developer lookups
CREATE INDEX IF NOT EXISTS idx_api_clients_developer_email ON public.api_clients(developer_email);