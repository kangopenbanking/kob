
-- Table for in-app legal/info pages (Terms, Privacy, KYC, KYB, Security, Contact)
CREATE TABLE public.app_legal_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'legal',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique slug per page
CREATE UNIQUE INDEX idx_app_legal_pages_slug ON public.app_legal_pages(slug);

ALTER TABLE public.app_legal_pages ENABLE ROW LEVEL SECURITY;

-- Anyone can read active pages
CREATE POLICY "Anyone can read active legal pages"
  ON public.app_legal_pages FOR SELECT
  USING (is_active = true);

-- Admins can manage
CREATE POLICY "Admins can manage legal pages"
  ON public.app_legal_pages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Table for product manuals (3 separate guides)
CREATE TABLE public.product_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_type TEXT NOT NULL CHECK (manual_type IN ('banks', 'customers', 'developers')),
  section_title TEXT NOT NULL,
  section_slug TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES public.product_manuals(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_product_manuals_type_slug ON public.product_manuals(manual_type, section_slug);

ALTER TABLE public.product_manuals ENABLE ROW LEVEL SECURITY;

-- Anyone can read active manual sections
CREATE POLICY "Anyone can read active manual sections"
  ON public.product_manuals FOR SELECT
  USING (is_active = true);

-- Admins can manage
CREATE POLICY "Admins can manage manual sections"
  ON public.product_manuals FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Glossary table
CREATE TABLE public.product_glossary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  manual_type TEXT NOT NULL CHECK (manual_type IN ('banks', 'customers', 'developers', 'all')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read glossary"
  ON public.product_glossary FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage glossary"
  ON public.product_glossary FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_app_legal_pages_updated_at
  BEFORE UPDATE ON public.app_legal_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_manuals_updated_at
  BEFORE UPDATE ON public.product_manuals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
