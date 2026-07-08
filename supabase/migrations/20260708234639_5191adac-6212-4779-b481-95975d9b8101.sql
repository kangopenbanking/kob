
CREATE TABLE public.kang_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('due_soon','payment_failed','payment_success','system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kang_notifications_user_unread ON public.kang_notifications(user_id, is_read, created_at DESC);

GRANT SELECT, UPDATE ON public.kang_notifications TO authenticated;
GRANT ALL ON public.kang_notifications TO service_role;

ALTER TABLE public.kang_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own kang notifications"
  ON public.kang_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users update own kang notifications"
  ON public.kang_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
