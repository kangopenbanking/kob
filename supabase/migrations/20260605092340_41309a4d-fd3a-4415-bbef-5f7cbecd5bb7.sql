
CREATE TABLE public.daily_needs_how_it_works_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT NOT NULL CHECK (vertical IN ('food','pharmacy')),
  position INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  bg_color TEXT NOT NULL DEFAULT 'hsl(25, 90%, 93%)',
  icon_color TEXT NOT NULL DEFAULT 'hsl(25, 90%, 45%)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dn_hiw_vertical_position_idx
  ON public.daily_needs_how_it_works_steps(vertical, position);

GRANT SELECT ON public.daily_needs_how_it_works_steps TO anon, authenticated;
GRANT ALL    ON public.daily_needs_how_it_works_steps TO service_role;

ALTER TABLE public.daily_needs_how_it_works_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read how-it-works steps"
  ON public.daily_needs_how_it_works_steps
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert how-it-works steps"
  ON public.daily_needs_how_it_works_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update how-it-works steps"
  ON public.daily_needs_how_it_works_steps
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete how-it-works steps"
  ON public.daily_needs_how_it_works_steps
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER dn_hiw_updated_at
  BEFORE UPDATE ON public.daily_needs_how_it_works_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
