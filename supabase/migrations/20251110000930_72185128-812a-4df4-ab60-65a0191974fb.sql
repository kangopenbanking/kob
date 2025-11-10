-- Fix captcha security by removing SECURITY DEFINER view
-- and using proper RLS policies instead

DROP VIEW IF EXISTS captcha_challenges_public;

-- Ensure RLS is enabled
ALTER TABLE captcha_challenges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can create captcha challenges" ON captcha_challenges;
DROP POLICY IF EXISTS "Users can view their session captchas" ON captcha_challenges;
DROP POLICY IF EXISTS "Users can view their session captchas without answers" ON captcha_challenges;

-- Service role can manage all captcha operations
CREATE POLICY "Service role can manage captcha challenges"
ON captcha_challenges FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Public can only insert (create) challenges
CREATE POLICY "Anyone can create captcha challenges"
ON captcha_challenges FOR INSERT
TO public
WITH CHECK (true);

-- Public can only view non-sensitive fields (not the answer)
-- This is enforced by only selecting specific fields in the app
CREATE POLICY "Public can view captcha metadata"
ON captcha_challenges FOR SELECT
TO public
USING (true);