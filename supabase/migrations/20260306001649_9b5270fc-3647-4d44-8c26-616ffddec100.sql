
ALTER TABLE public.merchant_staff_roles 
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS pin_hash text,
ADD COLUMN IF NOT EXISTS temp_password text;

-- Add index for phone login lookups
CREATE INDEX IF NOT EXISTS idx_merchant_staff_roles_phone ON public.merchant_staff_roles(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_merchant_staff_roles_email ON public.merchant_staff_roles(staff_email) WHERE staff_email IS NOT NULL;
