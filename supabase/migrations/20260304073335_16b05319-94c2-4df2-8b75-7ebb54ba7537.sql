-- Add foreign key from kyc_verifications.user_id to profiles.id
-- This enables PostgREST to resolve the profiles() join in queries
ALTER TABLE public.kyc_verifications
ADD CONSTRAINT kyc_verifications_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;