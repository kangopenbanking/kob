-- Agent profile self-service support
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.support_agents
  ADD COLUMN IF NOT EXISTS away_message TEXT,
  ADD COLUMN IF NOT EXISTS notify_new_chat BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_assignment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT true;

-- Allow agents to update their own support_agents row (for self-service availability + prefs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_agents' AND policyname='Agents can update their own row'
  ) THEN
    EXECUTE 'CREATE POLICY "Agents can update their own row" ON public.support_agents FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- Public avatars bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars','avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatar images are publicly readable') THEN
    EXECUTE 'CREATE POLICY "Avatar images are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = ''avatars'')';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload their own avatar') THEN
    EXECUTE 'CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''avatars'' AND auth.uid()::text = (storage.foldername(name))[1])';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update their own avatar') THEN
    EXECUTE 'CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''avatars'' AND auth.uid()::text = (storage.foldername(name))[1])';
  END IF;
END $$;