-- Add idempotency_key column to travel_bookings for duplicate prevention
ALTER TABLE public.travel_bookings 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_travel_bookings_idempotency_key 
ON public.travel_bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;