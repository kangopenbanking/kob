
-- Create homepage hero slides table for admin-managed hero section
CREATE TABLE public.homepage_hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  cta_text TEXT,
  cta_link TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  overlay_opacity NUMERIC DEFAULT 0.4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.homepage_hero_slides ENABLE ROW LEVEL SECURITY;

-- Public read for active slides
CREATE POLICY "Anyone can view active hero slides"
  ON public.homepage_hero_slides
  FOR SELECT
  USING (is_active = true);

-- Admin write via has_role
CREATE POLICY "Admins can manage hero slides"
  ON public.homepage_hero_slides
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for hero media
INSERT INTO storage.buckets (id, name, public) VALUES ('homepage-hero', 'homepage-hero', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view homepage hero media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'homepage-hero');

CREATE POLICY "Admins can upload homepage hero media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'homepage-hero' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update homepage hero media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'homepage-hero' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete homepage hero media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'homepage-hero' AND public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_homepage_hero_slides_updated_at
  BEFORE UPDATE ON public.homepage_hero_slides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
