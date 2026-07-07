
-- ─────────────────────────────────────────────────────────────
-- GIVETING MODULE — Fundraising for Kang Consumers App
-- ─────────────────────────────────────────────────────────────

-- Categories lookup
CREATE TABLE public.giveting_categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.giveting_categories TO anon, authenticated;
GRANT ALL ON public.giveting_categories TO service_role;
ALTER TABLE public.giveting_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.giveting_categories FOR SELECT USING (active = true);
CREATE POLICY "categories_admin_manage" ON public.giveting_categories FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.giveting_categories (slug, label, icon, sort_order) VALUES
  ('medical','Medical','heart-pulse',1),
  ('emergencies','Emergencies','life-buoy',2),
  ('memorial','Memorial','flower',3),
  ('education','Education','graduation-cap',4),
  ('community','Community','users',5),
  ('animals','Animals','paw-print',6),
  ('business','Business','briefcase',7),
  ('faith','Faith','church',8),
  ('family','Family','home',9),
  ('sports','Sports','trophy',10),
  ('travel','Travel','plane',11),
  ('volunteer','Volunteer','hand-heart',12),
  ('wishes','Wishes','sparkles',13),
  ('competitions','Competitions','medal',14),
  ('creative','Creative','palette',15),
  ('events','Events','calendar',16),
  ('environment','Environment','leaf',17);

-- Campaigns
CREATE TABLE public.giveting_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  story TEXT NOT NULL DEFAULT '',
  category_slug TEXT NOT NULL REFERENCES public.giveting_categories(slug),
  currency TEXT NOT NULL DEFAULT 'XAF' CHECK (currency IN ('XAF','XOF','EUR','USD','GBP')),
  goal_amount_minor BIGINT NOT NULL CHECK (goal_amount_minor > 0),
  cover_media_url TEXT,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  beneficiary_type TEXT NOT NULL DEFAULT 'self' CHECK (beneficiary_type IN ('self','other','charity')),
  beneficiary_name TEXT,
  beneficiary_relation TEXT,
  location_country TEXT,
  location_city TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','active','paused','completed','archived')),
  verified_badge BOOLEAN NOT NULL DEFAULT false,
  total_raised_minor BIGINT NOT NULL DEFAULT 0,
  donor_count INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_giveting_campaigns_owner ON public.giveting_campaigns(owner_user_id);
CREATE INDEX idx_giveting_campaigns_status ON public.giveting_campaigns(status);
CREATE INDEX idx_giveting_campaigns_category ON public.giveting_campaigns(category_slug);
CREATE INDEX idx_giveting_campaigns_published ON public.giveting_campaigns(published_at DESC NULLS LAST);

GRANT SELECT ON public.giveting_campaigns TO anon, authenticated;
GRANT INSERT, UPDATE ON public.giveting_campaigns TO authenticated;
GRANT ALL ON public.giveting_campaigns TO service_role;
ALTER TABLE public.giveting_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_public_read_active" ON public.giveting_campaigns FOR SELECT
  USING (status IN ('active','completed'));
CREATE POLICY "campaigns_owner_read" ON public.giveting_campaigns FOR SELECT
  USING (auth.uid() = owner_user_id);
CREATE POLICY "campaigns_admin_read" ON public.giveting_campaigns FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "campaigns_owner_insert" ON public.giveting_campaigns FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "campaigns_owner_update" ON public.giveting_campaigns FOR UPDATE
  USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "campaigns_admin_all" ON public.giveting_campaigns FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Donations (writes only via edge function)
CREATE TABLE public.giveting_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.giveting_campaigns(id) ON DELETE CASCADE,
  donor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_display_name TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  fx_rate_to_campaign NUMERIC(18,8) NOT NULL DEFAULT 1,
  converted_amount_minor BIGINT NOT NULL,
  tip_minor BIGINT NOT NULL DEFAULT 0,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('pending','succeeded','refunded','failed')),
  source TEXT NOT NULL DEFAULT 'wallet' CHECK (source IN ('wallet','offline','card')),
  idempotency_key TEXT NOT NULL UNIQUE,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_giveting_donations_campaign ON public.giveting_donations(campaign_id, created_at DESC);
CREATE INDEX idx_giveting_donations_donor ON public.giveting_donations(donor_user_id);

GRANT SELECT ON public.giveting_donations TO anon, authenticated;
GRANT ALL ON public.giveting_donations TO service_role;
ALTER TABLE public.giveting_donations ENABLE ROW LEVEL SECURITY;

-- Public sees succeeded donations for active campaigns (donor wall)
CREATE POLICY "donations_public_read" ON public.giveting_donations FOR SELECT
  USING (status = 'succeeded' AND EXISTS (
    SELECT 1 FROM public.giveting_campaigns c WHERE c.id = campaign_id AND c.status IN ('active','completed')
  ));
CREATE POLICY "donations_donor_read" ON public.giveting_donations FOR SELECT
  USING (auth.uid() = donor_user_id);
CREATE POLICY "donations_owner_read" ON public.giveting_donations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.giveting_campaigns c WHERE c.id = campaign_id AND c.owner_user_id = auth.uid()));
CREATE POLICY "donations_admin_all" ON public.giveting_donations FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Updates
CREATE TABLE public.giveting_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.giveting_campaigns(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_giveting_updates_campaign ON public.giveting_updates(campaign_id, created_at DESC);
GRANT SELECT ON public.giveting_updates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.giveting_updates TO authenticated;
GRANT ALL ON public.giveting_updates TO service_role;
ALTER TABLE public.giveting_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "updates_public_read" ON public.giveting_updates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.giveting_campaigns c WHERE c.id = campaign_id AND c.status IN ('active','completed')));
CREATE POLICY "updates_owner_manage" ON public.giveting_updates FOR ALL
  USING (auth.uid() = author_user_id) WITH CHECK (auth.uid() = author_user_id);

-- Comments
CREATE TABLE public.giveting_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.giveting_campaigns(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donation_id UUID REFERENCES public.giveting_donations(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_giveting_comments_campaign ON public.giveting_comments(campaign_id, created_at DESC);
GRANT SELECT ON public.giveting_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.giveting_comments TO authenticated;
GRANT ALL ON public.giveting_comments TO service_role;
ALTER TABLE public.giveting_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON public.giveting_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.giveting_campaigns c WHERE c.id = campaign_id AND c.status IN ('active','completed')));
CREATE POLICY "comments_author_insert" ON public.giveting_comments FOR INSERT
  WITH CHECK (auth.uid() = author_user_id);
CREATE POLICY "comments_author_delete" ON public.giveting_comments FOR DELETE
  USING (auth.uid() = author_user_id);

-- Followers
CREATE TABLE public.giveting_followers (
  campaign_id UUID NOT NULL REFERENCES public.giveting_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.giveting_followers TO authenticated;
GRANT ALL ON public.giveting_followers TO service_role;
ALTER TABLE public.giveting_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers_self_manage" ON public.giveting_followers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Withdrawals (writes only via edge function)
CREATE TABLE public.giveting_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.giveting_campaigns(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('wallet','bank','momo')),
  destination_ref TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  fee_minor BIGINT NOT NULL DEFAULT 0,
  net_minor BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','settled','failed','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_giveting_withdrawals_campaign ON public.giveting_withdrawals(campaign_id, created_at DESC);
GRANT SELECT ON public.giveting_withdrawals TO authenticated;
GRANT ALL ON public.giveting_withdrawals TO service_role;
ALTER TABLE public.giveting_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals_owner_read" ON public.giveting_withdrawals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.giveting_campaigns c WHERE c.id = campaign_id AND c.owner_user_id = auth.uid()));
CREATE POLICY "withdrawals_admin_all" ON public.giveting_withdrawals FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at triggers
CREATE TRIGGER trg_giveting_campaigns_updated
  BEFORE UPDATE ON public.giveting_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_giveting_withdrawals_updated
  BEFORE UPDATE ON public.giveting_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
