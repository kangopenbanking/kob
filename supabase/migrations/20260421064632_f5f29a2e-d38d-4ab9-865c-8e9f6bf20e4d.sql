
-- Make user_id nullable for anonymous posts
ALTER TABLE public.forum_threads ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.forum_replies ALTER COLUMN user_id DROP NOT NULL;

-- Replace insert policies to allow anonymous posting
DROP POLICY IF EXISTS "Authenticated users can create threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Authenticated users can create replies" ON public.forum_replies;

CREATE POLICY "Anyone can create threads"
ON public.forum_threads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

CREATE POLICY "Anyone can create replies"
ON public.forum_replies
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);
