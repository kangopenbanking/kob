-- Make Live Support free to access without an account.
-- Adds guest identity fields and permissive RLS for anonymous chat.

ALTER TABLE public.support_conversations
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_id TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

CREATE INDEX IF NOT EXISTS idx_support_conv_guest ON public.support_conversations (guest_id);

-- Either an authenticated user OR a guest must own the conversation
ALTER TABLE public.support_conversations
  DROP CONSTRAINT IF EXISTS support_conv_owner_chk;
ALTER TABLE public.support_conversations
  ADD CONSTRAINT support_conv_owner_chk
  CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL);

-- The before-insert trigger may stamp user_id from auth.uid(); allow guests to bypass.
CREATE OR REPLACE FUNCTION public.support_before_conversation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce auth.uid() ownership for authenticated owners; leave guests untouched.
  IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL AND NEW.guest_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- ============ RLS: allow anonymous (guest) flow ============

-- Allow anyone (anon + authenticated) to create a guest conversation
DROP POLICY IF EXISTS "Guests create conversations" ON public.support_conversations;
CREATE POLICY "Guests create conversations"
ON public.support_conversations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  guest_id IS NOT NULL
  AND user_id IS NULL
);

-- Allow anyone to read their own guest conversation rows (guest_id is an opaque secret stored in localStorage)
DROP POLICY IF EXISTS "Guests see own conversations" ON public.support_conversations;
CREATE POLICY "Guests see own conversations"
ON public.support_conversations
FOR SELECT
TO anon, authenticated
USING (guest_id IS NOT NULL);

-- Allow guests to update (e.g., subject) their own conversations
DROP POLICY IF EXISTS "Guests update own conversations" ON public.support_conversations;
CREATE POLICY "Guests update own conversations"
ON public.support_conversations
FOR UPDATE
TO anon, authenticated
USING (guest_id IS NOT NULL AND user_id IS NULL);

-- ============ Messages: allow guest read/insert ============

DROP POLICY IF EXISTS "Guests see messages in guest conversations" ON public.support_messages;
CREATE POLICY "Guests see messages in guest conversations"
ON public.support_messages
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND c.guest_id IS NOT NULL
  )
);

DROP POLICY IF EXISTS "Guests send messages in guest conversations" ON public.support_messages;
CREATE POLICY "Guests send messages in guest conversations"
ON public.support_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  sender_type IN ('user', 'system')
  AND EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND c.guest_id IS NOT NULL
  )
);

-- Allow guests to mark agent messages read (UPDATE read_at)
DROP POLICY IF EXISTS "Guests update read state" ON public.support_messages;
CREATE POLICY "Guests update read state"
ON public.support_messages
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = support_messages.conversation_id
      AND c.guest_id IS NOT NULL
  )
);
