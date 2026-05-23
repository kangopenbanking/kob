
-- Smart Budgeting feature tables

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My Budget',
  period text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_limit numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budgets_consumer ON public.budgets(consumer_id, status);

CREATE TABLE IF NOT EXISTS public.budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL,
  category_key text NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'DotsThree',
  colour text NOT NULL DEFAULT '#64748B',
  category_limit numeric(14,2) NOT NULL DEFAULT 0,
  spent numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(budget_id, category_key)
);
CREATE INDEX IF NOT EXISTS idx_budget_categories_budget ON public.budget_categories(budget_id);

CREATE TABLE IF NOT EXISTS public.budget_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  category_key text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_consumer ON public.budget_alerts(consumer_id, dismissed);

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  name text NOT NULL,
  target_amount numeric(14,2) NOT NULL,
  current_amount numeric(14,2) NOT NULL DEFAULT 0,
  deadline date,
  icon text NOT NULL DEFAULT 'Target',
  colour text NOT NULL DEFAULT '#0EA5E9',
  round_up_enabled boolean NOT NULL DEFAULT false,
  round_up_nearest integer,
  linked_piggy_bank_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_savings_goals_consumer ON public.savings_goals(consumer_id, status);

CREATE TABLE IF NOT EXISTS public.budget_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  question text,
  answer text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 0.8,
  suggested_action jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_insights_consumer ON public.budget_insights(consumer_id, lang, generated_at DESC);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_insights ENABLE ROW LEVEL SECURITY;

-- Owner-only policies
DO $$ BEGIN
  CREATE POLICY "owner_all_budgets" ON public.budgets FOR ALL USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "owner_all_budget_categories" ON public.budget_categories FOR ALL USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "owner_all_budget_alerts" ON public.budget_alerts FOR ALL USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "owner_all_savings_goals" ON public.savings_goals FOR ALL USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "owner_all_budget_insights" ON public.budget_insights FOR ALL USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.budget_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_budgets_updated ON public.budgets;
CREATE TRIGGER trg_budgets_updated BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();

DROP TRIGGER IF EXISTS trg_budget_categories_updated ON public.budget_categories;
CREATE TRIGGER trg_budget_categories_updated BEFORE UPDATE ON public.budget_categories FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();

DROP TRIGGER IF EXISTS trg_savings_goals_updated ON public.savings_goals;
CREATE TRIGGER trg_savings_goals_updated BEFORE UPDATE ON public.savings_goals FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();
