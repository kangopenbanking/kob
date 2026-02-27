
-- Enums for piggybank
CREATE TYPE public.piggybank_plan_type AS ENUM ('savings', 'rent');
CREATE TYPE public.piggybank_frequency AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE public.piggybank_plan_status AS ENUM ('active', 'paused', 'completed', 'cancelled');
CREATE TYPE public.piggybank_payment_status AS ENUM ('pending', 'paid', 'missed', 'late');

-- Enums for njangi
CREATE TYPE public.njangi_frequency AS ENUM ('weekly', 'monthly');
CREATE TYPE public.njangi_payout_method AS ENUM ('random', 'manual');
CREATE TYPE public.njangi_group_status AS ENUM ('forming', 'active', 'completed', 'dissolved');
CREATE TYPE public.njangi_member_status AS ENUM ('active', 'removed');
CREATE TYPE public.njangi_contribution_status AS ENUM ('pending', 'paid', 'missed', 'late');
CREATE TYPE public.njangi_selection_method AS ENUM ('random', 'manual');

-- ═══ PIGGYBANK PLANS ═══
CREATE TABLE public.piggybank_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  institution_id UUID REFERENCES public.institutions(id),
  plan_name TEXT NOT NULL,
  plan_type public.piggybank_plan_type NOT NULL DEFAULT 'savings',
  target_amount NUMERIC NOT NULL DEFAULT 0,
  schedule_frequency public.piggybank_frequency NOT NULL DEFAULT 'monthly',
  installment_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status public.piggybank_plan_status NOT NULL DEFAULT 'active',
  rent_reference VARCHAR(10) UNIQUE,
  landlord_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ PIGGYBANK PAYMENTS ═══
CREATE TABLE public.piggybank_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.piggybank_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status public.piggybank_payment_status NOT NULL DEFAULT 'pending',
  credit_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ NJANGI GROUPS ═══
CREATE TABLE public.njangi_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  institution_id UUID REFERENCES public.institutions(id),
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  contribution_amount NUMERIC NOT NULL DEFAULT 0,
  frequency public.njangi_frequency NOT NULL DEFAULT 'monthly',
  payout_method public.njangi_payout_method NOT NULL DEFAULT 'random',
  late_interest_rate NUMERIC NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 5,
  status public.njangi_group_status NOT NULL DEFAULT 'forming',
  current_cycle INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ NJANGI MEMBERS ═══
CREATE TABLE public.njangi_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.njangi_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.njangi_member_status NOT NULL DEFAULT 'active',
  has_received_payout BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(group_id, user_id)
);

-- ═══ NJANGI CONTRIBUTIONS ═══
CREATE TABLE public.njangi_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.njangi_groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.njangi_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cycle_number INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status public.njangi_contribution_status NOT NULL DEFAULT 'pending',
  late_interest_amount NUMERIC NOT NULL DEFAULT 0,
  credit_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ NJANGI PAYOUTS ═══
CREATE TABLE public.njangi_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.njangi_groups(id) ON DELETE CASCADE,
  recipient_member_id UUID NOT NULL REFERENCES public.njangi_members(id),
  cycle_number INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  selection_method public.njangi_selection_method NOT NULL DEFAULT 'random',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ UPDATED_AT TRIGGERS ═══
CREATE TRIGGER update_piggybank_plans_updated_at
  BEFORE UPDATE ON public.piggybank_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_njangi_groups_updated_at
  BEFORE UPDATE ON public.njangi_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ RLS ═══
ALTER TABLE public.piggybank_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piggybank_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.njangi_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.njangi_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.njangi_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.njangi_payouts ENABLE ROW LEVEL SECURITY;

-- PiggyBank Plans: users manage own
CREATE POLICY "Users can read own piggybank plans" ON public.piggybank_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own piggybank plans" ON public.piggybank_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own piggybank plans" ON public.piggybank_plans FOR UPDATE USING (auth.uid() = user_id);

-- PiggyBank Payments: users manage own
CREATE POLICY "Users can read own piggybank payments" ON public.piggybank_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own piggybank payments" ON public.piggybank_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own piggybank payments" ON public.piggybank_payments FOR UPDATE USING (auth.uid() = user_id);

-- Njangi Groups: members can read, creator can manage
CREATE POLICY "Members can read njangi groups" ON public.njangi_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.njangi_members nm WHERE nm.group_id = id AND nm.user_id = auth.uid() AND nm.status = 'active')
  OR creator_id = auth.uid()
);
CREATE POLICY "Users can create njangi groups" ON public.njangi_groups FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator can update njangi groups" ON public.njangi_groups FOR UPDATE USING (auth.uid() = creator_id);

-- Njangi Members: group members can read
CREATE POLICY "Members can read njangi members" ON public.njangi_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.njangi_members nm2 WHERE nm2.group_id = group_id AND nm2.user_id = auth.uid() AND nm2.status = 'active')
);
CREATE POLICY "Users can join njangi groups" ON public.njangi_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Njangi Contributions: group members can read, own contributions writable
CREATE POLICY "Members can read njangi contributions" ON public.njangi_contributions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.njangi_members nm WHERE nm.group_id = group_id AND nm.user_id = auth.uid() AND nm.status = 'active')
);
CREATE POLICY "Users can create own contributions" ON public.njangi_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contributions" ON public.njangi_contributions FOR UPDATE USING (auth.uid() = user_id);

-- Njangi Payouts: group members can read
CREATE POLICY "Members can read njangi payouts" ON public.njangi_payouts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.njangi_members nm WHERE nm.group_id = group_id AND nm.user_id = auth.uid() AND nm.status = 'active')
);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.njangi_contributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.piggybank_payments;
