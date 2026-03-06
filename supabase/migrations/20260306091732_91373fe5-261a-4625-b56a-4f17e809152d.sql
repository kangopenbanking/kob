-- Add passenger_gender column to travel_tickets for proper gender tracking
ALTER TABLE public.travel_tickets ADD COLUMN IF NOT EXISTS passenger_gender TEXT DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.travel_tickets.passenger_gender IS 'Gender of the passenger: male or female';