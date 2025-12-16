-- Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with proper security
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create secure RLS policies for profiles
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure RLS is enabled on kyc_verifications table
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with proper security
DROP POLICY IF EXISTS "Users can view own KYC verifications" ON public.kyc_verifications;
DROP POLICY IF EXISTS "Users can create own KYC verifications" ON public.kyc_verifications;
DROP POLICY IF EXISTS "Admins can manage all KYC verifications" ON public.kyc_verifications;

-- Create secure RLS policies for kyc_verifications
CREATE POLICY "Users can view own KYC verifications" 
ON public.kyc_verifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own KYC verifications" 
ON public.kyc_verifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all KYC verifications" 
ON public.kyc_verifications 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update KYC verifications" 
ON public.kyc_verifications 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete KYC verifications" 
ON public.kyc_verifications 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));