
-- ═══════════════════════════════════════════════════════════════════
-- BANK OPERATIONS ENHANCEMENT: Withdrawal Controls, Approvals, Overdraft
-- ═══════════════════════════════════════════════════════════════════

-- 1. Operational Role Type Enum
CREATE TYPE public.operational_role_type AS ENUM (
  'teller', 'assistant_manager', 'branch_manager', 'general_manager'
);

-- 2. Approval Status Enum
CREATE TYPE public.approval_status AS ENUM (
  'draft', 'submitted', 'pending_assistant_manager', 'pending_branch_manager',
  'pending_general_manager', 'approved', 'rejected', 'expired', 'executed', 'cancelled'
);

-- 3. Approval Action Type Enum
CREATE TYPE public.approval_action_type AS ENUM (
  'submit', 'approve', 'reject', 'escalate', 'cancel', 'execute', 'expire'
);

-- 4. Overdraft Status Enum
CREATE TYPE public.overdraft_status AS ENUM (
  'active', 'suspended', 'revoked', 'pending_approval', 'inactive'
);

-- 5. Approval Request Type Enum
CREATE TYPE public.approval_request_type AS ENUM (
  'withdrawal_override', 'overdraft_approval', 'limit_override', 'exceptional_withdrawal'
);

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 1: institution_operational_roles
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.institution_operational_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  role_type public.operational_role_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, user_id, role_type)
);

CREATE INDEX idx_ior_institution ON public.institution_operational_roles(institution_id);
CREATE INDEX idx_ior_branch ON public.institution_operational_roles(branch_id);
CREATE INDEX idx_ior_user ON public.institution_operational_roles(user_id);
CREATE INDEX idx_ior_role_type ON public.institution_operational_roles(role_type);

ALTER TABLE public.institution_operational_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on institution_operational_roles"
  ON public.institution_operational_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Institution owners can manage operational roles"
  ON public.institution_operational_roles FOR ALL TO authenticated
  USING (public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view own operational role"
  ON public.institution_operational_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 2: withdrawal_policies
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.withdrawal_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  channel TEXT,
  role_type public.operational_role_type NOT NULL,
  single_txn_limit NUMERIC NOT NULL DEFAULT 0,
  daily_total_limit NUMERIC NOT NULL DEFAULT 0,
  auto_approve_threshold NUMERIC NOT NULL DEFAULT 0,
  requires_dual_approval_above NUMERIC,
  escalation_target_role public.operational_role_type,
  can_override_lower_role BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wp_institution ON public.withdrawal_policies(institution_id);
CREATE INDEX idx_wp_branch ON public.withdrawal_policies(branch_id);
CREATE INDEX idx_wp_role_type ON public.withdrawal_policies(role_type);
CREATE INDEX idx_wp_status ON public.withdrawal_policies(status);

ALTER TABLE public.withdrawal_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on withdrawal_policies"
  ON public.withdrawal_policies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Institution owners and admins manage withdrawal_policies"
  ON public.withdrawal_policies FOR ALL TO authenticated
  USING (public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view withdrawal_policies for their institution"
  ON public.withdrawal_policies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid() AND sa.institution_id = withdrawal_policies.institution_id AND sa.is_active = true
  ));

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 3: staff_authorizations
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.staff_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  role_type public.operational_role_type NOT NULL,
  max_override_limit NUMERIC,
  can_approve_overdraft BOOLEAN NOT NULL DEFAULT false,
  can_approve_withdrawal_override BOOLEAN NOT NULL DEFAULT false,
  can_suspend_overdraft BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, user_id)
);

CREATE INDEX idx_sa_institution ON public.staff_authorizations(institution_id);
CREATE INDEX idx_sa_branch ON public.staff_authorizations(branch_id);
CREATE INDEX idx_sa_user ON public.staff_authorizations(user_id);
CREATE INDEX idx_sa_role_type ON public.staff_authorizations(role_type);
CREATE INDEX idx_sa_status ON public.staff_authorizations(status);

ALTER TABLE public.staff_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on staff_authorizations"
  ON public.staff_authorizations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Institution owners and admins manage staff_authorizations"
  ON public.staff_authorizations FOR ALL TO authenticated
  USING (public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view own authorization"
  ON public.staff_authorizations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 4: withdrawal_requests
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  initiated_by_user_id UUID,
  initiated_by_staff_id UUID,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  channel TEXT NOT NULL DEFAULT 'branch',
  source_type TEXT NOT NULL DEFAULT 'teller',
  source_endpoint TEXT,
  current_status public.approval_status NOT NULL DEFAULT 'draft',
  policy_result JSONB,
  required_role public.operational_role_type,
  approval_request_id UUID,
  execution_reference TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wr_institution ON public.withdrawal_requests(institution_id);
CREATE INDEX idx_wr_branch ON public.withdrawal_requests(branch_id);
CREATE INDEX idx_wr_account ON public.withdrawal_requests(account_id);
CREATE INDEX idx_wr_status ON public.withdrawal_requests(current_status);
CREATE INDEX idx_wr_created ON public.withdrawal_requests(created_at);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on withdrawal_requests"
  ON public.withdrawal_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Institution staff can view withdrawal_requests"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid() AND sa.institution_id = withdrawal_requests.institution_id AND sa.is_active = true
  ) OR public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can create withdrawal_requests"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid() AND sa.institution_id = withdrawal_requests.institution_id AND sa.is_active = true
  ) OR public.is_institution_owner(auth.uid(), institution_id));

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 5: approval_requests
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  request_type public.approval_request_type NOT NULL,
  current_stage public.approval_status NOT NULL DEFAULT 'submitted',
  required_role public.operational_role_type,
  submitted_by UUID NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'submitted',
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ar_institution ON public.approval_requests(institution_id);
CREATE INDEX idx_ar_branch ON public.approval_requests(branch_id);
CREATE INDEX idx_ar_entity ON public.approval_requests(entity_type, entity_id);
CREATE INDEX idx_ar_status ON public.approval_requests(status);
CREATE INDEX idx_ar_required_role ON public.approval_requests(required_role);
CREATE INDEX idx_ar_created ON public.approval_requests(created_at);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on approval_requests"
  ON public.approval_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Institution staff can view approval_requests"
  ON public.approval_requests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid() AND sa.institution_id = approval_requests.institution_id AND sa.is_active = true
  ) OR public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 6: approval_actions
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  action public.approval_action_type NOT NULL,
  acted_by UUID NOT NULL,
  acted_role public.operational_role_type,
  comments TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aa_approval ON public.approval_actions(approval_request_id);
CREATE INDEX idx_aa_acted_by ON public.approval_actions(acted_by);
CREATE INDEX idx_aa_created ON public.approval_actions(created_at);

ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on approval_actions"
  ON public.approval_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Institution staff can view approval_actions"
  ON public.approval_actions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.approval_requests ar
    JOIN public.staff_assignments sa ON sa.institution_id = ar.institution_id
    WHERE ar.id = approval_actions.approval_request_id AND sa.user_id = auth.uid() AND sa.is_active = true
  ));

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 7: account_overdraft_profiles
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.account_overdraft_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  eligible BOOLEAN NOT NULL DEFAULT false,
  recommended_limit NUMERIC NOT NULL DEFAULT 0,
  approved_limit NUMERIC NOT NULL DEFAULT 0,
  utilised_amount NUMERIC NOT NULL DEFAULT 0,
  available_amount NUMERIC NOT NULL DEFAULT 0,
  risk_band TEXT NOT NULL DEFAULT 'F',
  manual_approval_required BOOLEAN NOT NULL DEFAULT true,
  status public.overdraft_status NOT NULL DEFAULT 'inactive',
  review_date DATE,
  last_scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

CREATE INDEX idx_aop_account ON public.account_overdraft_profiles(account_id);
CREATE INDEX idx_aop_institution ON public.account_overdraft_profiles(institution_id);
CREATE INDEX idx_aop_status ON public.account_overdraft_profiles(status);
CREATE INDEX idx_aop_review ON public.account_overdraft_profiles(review_date);

ALTER TABLE public.account_overdraft_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on account_overdraft_profiles"
  ON public.account_overdraft_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Account owners can view own overdraft profile"
  ON public.account_overdraft_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_overdraft_profiles.account_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Institution staff can manage overdraft profiles"
  ON public.account_overdraft_profiles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid() AND sa.institution_id = account_overdraft_profiles.institution_id AND sa.is_active = true
  ) OR public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid() AND sa.institution_id = account_overdraft_profiles.institution_id AND sa.is_active = true
  ) OR public.is_institution_owner(auth.uid(), institution_id) OR public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════════
-- TABLE 8: overdraft_score_factors
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.overdraft_score_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_overdraft_profile_id UUID NOT NULL REFERENCES public.account_overdraft_profiles(id) ON DELETE CASCADE,
  salary_score NUMERIC NOT NULL DEFAULT 0,
  savings_score NUMERIC NOT NULL DEFAULT 0,
  balance_score NUMERIC NOT NULL DEFAULT 0,
  tenure_score NUMERIC NOT NULL DEFAULT 0,
  activity_score NUMERIC NOT NULL DEFAULT 0,
  repayment_score NUMERIC NOT NULL DEFAULT 0,
  credit_score_input NUMERIC NOT NULL DEFAULT 0,
  final_score NUMERIC NOT NULL DEFAULT 0,
  recommendation TEXT,
  factor_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_osf_profile ON public.overdraft_score_factors(account_overdraft_profile_id);
CREATE INDEX idx_osf_created ON public.overdraft_score_factors(created_at);

ALTER TABLE public.overdraft_score_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on overdraft_score_factors"
  ON public.overdraft_score_factors FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Institution staff can view overdraft_score_factors"
  ON public.overdraft_score_factors FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_overdraft_profiles aop
    JOIN public.staff_assignments sa ON sa.institution_id = aop.institution_id
    WHERE aop.id = overdraft_score_factors.account_overdraft_profile_id AND sa.user_id = auth.uid() AND sa.is_active = true
  ));

-- ═══════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Evaluate withdrawal policy
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.evaluate_withdrawal_policy(
  _institution_id UUID,
  _branch_id UUID,
  _staff_user_id UUID,
  _amount NUMERIC,
  _currency TEXT DEFAULT 'XAF',
  _channel TEXT DEFAULT 'branch'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_staff_role operational_role_type;
  v_policy RECORD;
  v_daily_total NUMERIC;
  v_result JSONB;
BEGIN
  -- Get staff operational role
  SELECT role_type INTO v_staff_role
  FROM institution_operational_roles
  WHERE institution_id = _institution_id AND user_id = _staff_user_id AND is_active = true
  LIMIT 1;

  IF v_staff_role IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_operational_role', 'message', 'Staff member has no operational role assigned');
  END IF;

  -- Find applicable policy (branch-specific first, then institution-wide)
  SELECT * INTO v_policy
  FROM withdrawal_policies
  WHERE institution_id = _institution_id
    AND role_type = v_staff_role
    AND currency = _currency
    AND status = 'active'
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    AND (channel IS NULL OR channel = _channel)
    AND (branch_id IS NULL OR branch_id = _branch_id)
  ORDER BY branch_id NULLS LAST, effective_from DESC
  LIMIT 1;

  IF v_policy IS NULL THEN
    -- No policy found = allow (backward compatible)
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_policy', 'staff_role', v_staff_role::text);
  END IF;

  -- Check single transaction limit
  IF _amount > v_policy.single_txn_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'exceeds_single_txn_limit',
      'staff_role', v_staff_role::text,
      'limit', v_policy.single_txn_limit,
      'amount', _amount,
      'escalation_target', v_policy.escalation_target_role::text,
      'requires_dual_approval', v_policy.requires_dual_approval_above IS NOT NULL AND _amount > v_policy.requires_dual_approval_above,
      'policy_id', v_policy.id
    );
  END IF;

  -- Check daily cumulative limit
  SELECT COALESCE(SUM(t.amount), 0) INTO v_daily_total
  FROM transactions t
  WHERE t.credit_debit_indicator = 'Debit'
    AND t.booking_datetime::date = CURRENT_DATE
    AND EXISTS (
      SELECT 1 FROM accounts a WHERE a.id = t.account_id AND a.institution_id = _institution_id
    );

  IF (v_daily_total + _amount) > v_policy.daily_total_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'exceeds_daily_limit',
      'staff_role', v_staff_role::text,
      'daily_limit', v_policy.daily_total_limit,
      'daily_used', v_daily_total,
      'amount', _amount,
      'escalation_target', v_policy.escalation_target_role::text,
      'policy_id', v_policy.id
    );
  END IF;

  -- Within limits
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'within_policy',
    'staff_role', v_staff_role::text,
    'policy_id', v_policy.id
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Get role hierarchy level
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_role_hierarchy_level(_role operational_role_type)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _role
    WHEN 'teller' THEN 1
    WHEN 'assistant_manager' THEN 2
    WHEN 'branch_manager' THEN 3
    WHEN 'general_manager' THEN 4
    ELSE 0
  END;
$$;
