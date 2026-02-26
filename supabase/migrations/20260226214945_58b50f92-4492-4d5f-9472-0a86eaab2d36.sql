
-- Create institution_walkthroughs table
CREATE TABLE public.institution_walkthroughs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  slide_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text NOT NULL,
  media_type text NOT NULL DEFAULT 'icon',
  media_url text,
  icon_name text DEFAULT 'Shield',
  bg_color text,
  text_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.institution_walkthroughs ENABLE ROW LEVEL SECURITY;

-- Admin/institution owners can manage
CREATE POLICY "Admins can manage walkthroughs"
  ON public.institution_walkthroughs
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.is_institution_owner(auth.uid(), institution_id) OR
    public.is_institution_staff_admin(auth.uid(), institution_id)
  );

-- Public read for PWA
CREATE POLICY "Public can read walkthroughs"
  ON public.institution_walkthroughs
  FOR SELECT
  USING (true);

-- Create pwa-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pwa-media', 'pwa-media', true);

-- Storage policies for pwa-media
CREATE POLICY "Authenticated users can upload pwa-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pwa-media');

CREATE POLICY "Public can read pwa-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pwa-media');

CREATE POLICY "Authenticated users can update pwa-media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pwa-media');

CREATE POLICY "Authenticated users can delete pwa-media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pwa-media');

-- Index for fast lookups
CREATE INDEX idx_institution_walkthroughs_institution_id 
  ON public.institution_walkthroughs(institution_id, slide_order);
