-- Phase 1B-R1I-c.1E — representative pre-migration schema for the four target tables.
-- Mirrors the current live cloud definitions captured in phase-1b-budgeting-schema-inventory.md.
-- Executed against the LOCAL kob_c1e database only.

CREATE OR REPLACE FUNCTION public.budget_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id  uuid NOT NULL,
  name         text NOT NULL DEFAULT 'My Budget',
  period       text NOT NULL DEFAULT 'monthly',
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  total_limit  numeric(14,2) NOT NULL DEFAULT 0,
  currency     text NOT NULL DEFAULT 'XAF',
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_budgets_consumer ON public.budgets(consumer_id, status);
CREATE TRIGGER trg_budgets_updated BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all_budgets ON public.budgets
  USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;

CREATE TABLE public.budget_categories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id      uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  consumer_id    uuid NOT NULL,
  category_key   text NOT NULL,
  name           text NOT NULL,
  icon           text NOT NULL DEFAULT 'DotsThree',
  colour         text NOT NULL DEFAULT '#64748B',
  category_limit numeric(14,2) NOT NULL DEFAULT 0,
  spent          numeric(14,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, category_key)
);
CREATE INDEX idx_budget_categories_budget ON public.budget_categories(budget_id);
CREATE TRIGGER trg_budget_categories_updated BEFORE UPDATE ON public.budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all_budget_categories ON public.budget_categories
  USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_categories TO authenticated;
GRANT ALL ON public.budget_categories TO service_role;

CREATE TABLE public.savings_goals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id          uuid NOT NULL,
  name                 text NOT NULL,
  target_amount        numeric(14,2) NOT NULL,
  current_amount       numeric(14,2) NOT NULL DEFAULT 0,
  deadline             date,
  icon                 text NOT NULL DEFAULT 'Target',
  colour               text NOT NULL DEFAULT '#0EA5E9',
  round_up_enabled     boolean NOT NULL DEFAULT false,
  round_up_nearest     integer,
  linked_piggy_bank_id uuid,
  status               text NOT NULL DEFAULT 'active',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_savings_goals_consumer ON public.savings_goals(consumer_id, status);
CREATE TRIGGER trg_savings_goals_updated BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all_savings_goals ON public.savings_goals
  USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO authenticated;
GRANT ALL ON public.savings_goals TO service_role;

CREATE TABLE public.roundup_settings (
  consumer_id          uuid PRIMARY KEY,
  enabled              boolean NOT NULL DEFAULT false,
  threshold            integer NOT NULL DEFAULT 100 CHECK (threshold IN (10,50,100,500,1000)),
  min_save             integer NOT NULL DEFAULT 10   CHECK (min_save >= 0),
  max_save             integer NOT NULL DEFAULT 2000 CHECK (max_save >= 0),
  daily_cap            integer NOT NULL DEFAULT 5000 CHECK (daily_cap >= 0),
  min_balance_floor    integer NOT NULL DEFAULT 0    CHECK (min_balance_floor >= 0),
  default_goal_id      uuid REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  paused_until         timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  source_filter        text NOT NULL DEFAULT 'both' CHECK (source_filter IN ('wallet','bank','both')),
  credit_boost_enabled boolean NOT NULL DEFAULT true
);
CREATE TRIGGER trg_roundup_settings_updated BEFORE UPDATE ON public.roundup_settings
  FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();
ALTER TABLE public.roundup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_select_roundup_settings ON public.roundup_settings FOR SELECT USING (consumer_id = auth.uid());
CREATE POLICY owner_insert_roundup_settings ON public.roundup_settings FOR INSERT WITH CHECK (consumer_id = auth.uid());
CREATE POLICY owner_update_roundup_settings ON public.roundup_settings FOR UPDATE USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roundup_settings TO authenticated;
GRANT ALL ON public.roundup_settings TO service_role;

-- NEVER_DELETE financial-history tables (minimal shape sufficient for row-count integrity checks).
CREATE TABLE public.roundup_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  goal_id uuid REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.roundup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Representative existing rows.
INSERT INTO public.budgets(id, consumer_id, start_date, end_date)
VALUES
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date, current_date + 30),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_date, current_date + 30);

INSERT INTO public.budget_categories(budget_id, consumer_id, category_key, name)
SELECT '11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','food','Food';

INSERT INTO public.savings_goals(id, consumer_id, name, target_amount)
VALUES ('33333333-3333-3333-3333-333333333333','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Vacation', 100000);

INSERT INTO public.roundup_settings(consumer_id, enabled)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
