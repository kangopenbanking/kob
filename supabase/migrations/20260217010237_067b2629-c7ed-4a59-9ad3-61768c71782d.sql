-- Fix: Remove public access to captcha_challenges table
-- Captcha operations are handled server-side via edge functions using SERVICE_ROLE_KEY

DROP POLICY IF EXISTS "Public can view captcha metadata" ON captcha_challenges;
DROP POLICY IF EXISTS "Anyone can create captcha challenges" ON captcha_challenges;
DROP POLICY IF EXISTS "Anyone can view their captcha challenge" ON captcha_challenges;
DROP POLICY IF EXISTS "Anyone can update captcha attempts" ON captcha_challenges;

-- Only service_role (used by edge functions) should access this table
CREATE POLICY "Service role only access"
ON captcha_challenges FOR ALL TO service_role
USING (true) WITH CHECK (true);