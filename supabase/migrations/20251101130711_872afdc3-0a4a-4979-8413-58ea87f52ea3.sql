-- CrediQ - Cameroon Credit Standard (CCS) - Complete Database Schema

-- ============================================================================
-- PHASE 1: CORE TABLES
-- ============================================================================

-- CrediQ User Profiles (from questionnaire)
CREATE TABLE IF NOT EXISTS public.crediq_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Employment & Income
  employment_status TEXT NOT NULL,
  monthly_income_range TEXT NOT NULL,
  income_stability TEXT,
  
  -- Financial Obligations
  has_existing_loans BOOLEAN DEFAULT false,
  monthly_loan_obligations_range TEXT,
  has_dependents BOOLEAN DEFAULT false,
  number_of_dependents INTEGER DEFAULT 0,
  
  -- Banking Behavior
  has_bank_account BOOLEAN DEFAULT false,
  uses_mobile_money BOOLEAN DEFAULT false,
  average_monthly_savings_range TEXT,
  
  -- Credit History (self-reported)
  has_previous_loans BOOLEAN DEFAULT false,
  loan_payment_history TEXT,
  has_defaulted_loans BOOLEAN DEFAULT false,
  
  -- Financial Goals
  primary_financial_goal TEXT,
  target_loan_amount_range TEXT,
  
  -- Digital Engagement
  has_smartphone BOOLEAN DEFAULT true,
  uses_digital_payments BOOLEAN DEFAULT false,
  digital_banking_frequency TEXT,
  
  -- Metadata
  questionnaire_version TEXT DEFAULT 'v1.0',
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  baseline_score_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questionnaire Responses (for analytics)
CREATE TABLE IF NOT EXISTS public.crediq_questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.crediq_user_profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_value TEXT NOT NULL,
  answer_label TEXT,
  question_step INTEGER,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Preferences for CrediQ
CREATE TABLE IF NOT EXISTS public.crediq_email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  score_change_alerts BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT true,
  monthly_report BOOLEAN DEFAULT true,
  goal_achievement_alerts BOOLEAN DEFAULT true,
  tips_recommendations BOOLEAN DEFAULT true,
  product_recommendations BOOLEAN DEFAULT false,
  marketing_emails BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Health Metrics (ClearScore-style)
CREATE TABLE IF NOT EXISTS public.crediq_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_score_id UUID REFERENCES public.credit_scores(id) ON DELETE CASCADE,
  
  -- Health Scores (0-100 each)
  overall_health_score INTEGER NOT NULL,
  payment_reliability_score INTEGER NOT NULL,
  debt_management_score INTEGER NOT NULL,
  credit_utilization_score INTEGER NOT NULL,
  account_diversity_score INTEGER NOT NULL,
  financial_stability_score INTEGER NOT NULL,
  
  -- Ratings
  payment_reliability TEXT NOT NULL,
  debt_management TEXT NOT NULL,
  credit_utilization_percentage NUMERIC(5,2),
  account_diversity TEXT NOT NULL,
  financial_stability TEXT NOT NULL,
  
  -- Action Plan Items
  suggested_actions JSONB,
  priority_actions JSONB,
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Action Plans (Personalized improvement steps)
CREATE TABLE IF NOT EXISTS public.crediq_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_title TEXT NOT NULL,
  action_description TEXT NOT NULL,
  estimated_impact INTEGER,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Recommendations
CREATE TABLE IF NOT EXISTS public.crediq_product_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  product_name TEXT NOT NULL,
  provider_institution_id UUID REFERENCES public.institutions(id),
  recommendation_reason TEXT,
  eligibility_score INTEGER,
  estimated_apr NUMERIC(5,2),
  key_benefits JSONB,
  requirements JSONB,
  recommended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.crediq_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediq_questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediq_email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediq_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediq_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crediq_product_recommendations ENABLE ROW LEVEL SECURITY;

-- Users access own data
CREATE POLICY "Users access own CrediQ profile" ON public.crediq_user_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own questionnaire responses" ON public.crediq_questionnaire_responses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own email preferences" ON public.crediq_email_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own health metrics" ON public.crediq_health_metrics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own action plans" ON public.crediq_action_plans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own product recommendations" ON public.crediq_product_recommendations
  FOR ALL USING (auth.uid() = user_id);

-- Admins view all for analytics
CREATE POLICY "Admins view all CrediQ profiles" ON public.crediq_user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins view all questionnaire responses" ON public.crediq_questionnaire_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins view all health metrics" ON public.crediq_health_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- PHASE 3: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crediq_profiles_user ON public.crediq_user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_crediq_questionnaire_user ON public.crediq_questionnaire_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_crediq_health_user ON public.crediq_health_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_crediq_health_score ON public.crediq_health_metrics(credit_score_id);
CREATE INDEX IF NOT EXISTS idx_crediq_actions_user_status ON public.crediq_action_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_crediq_recommendations_user ON public.crediq_product_recommendations(user_id, status);

-- ============================================================================
-- PHASE 4: TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER update_crediq_profiles_updated_at
  BEFORE UPDATE ON public.crediq_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crediq_email_prefs_updated_at
  BEFORE UPDATE ON public.crediq_email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crediq_action_plans_updated_at
  BEFORE UPDATE ON public.crediq_action_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger score recalculation on key events
CREATE OR REPLACE FUNCTION public.trigger_crediq_score_update()
RETURNS TRIGGER AS $$
BEGIN
  -- For loan payments, savings transactions, KYC verifications
  -- Trigger a score recalculation event
  PERFORM pg_notify(
    'crediq_score_update',
    json_build_object(
      'user_id', NEW.user_id,
      'event_type', TG_TABLE_NAME,
      'timestamp', NOW()
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to relevant tables
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_payments') THEN
    DROP TRIGGER IF EXISTS crediq_update_on_loan_payment ON public.loan_payments;
    CREATE TRIGGER crediq_update_on_loan_payment
      AFTER INSERT ON public.loan_payments
      FOR EACH ROW EXECUTE FUNCTION public.trigger_crediq_score_update();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'savings_transactions') THEN
    DROP TRIGGER IF EXISTS crediq_update_on_savings_deposit ON public.savings_transactions;
    CREATE TRIGGER crediq_update_on_savings_deposit
      AFTER INSERT ON public.savings_transactions
      FOR EACH ROW EXECUTE FUNCTION public.trigger_crediq_score_update();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kyc_verifications') THEN
    DROP TRIGGER IF EXISTS crediq_update_on_kyc_approval ON public.kyc_verifications;
    CREATE TRIGGER crediq_update_on_kyc_approval
      AFTER UPDATE ON public.kyc_verifications
      FOR EACH ROW 
      WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
      EXECUTE FUNCTION public.trigger_crediq_score_update();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mobile_money_transactions') THEN
    DROP TRIGGER IF EXISTS crediq_update_on_mobile_money ON public.mobile_money_transactions;
    CREATE TRIGGER crediq_update_on_mobile_money
      AFTER INSERT ON public.mobile_money_transactions
      FOR EACH ROW 
      WHEN (NEW.status = 'completed')
      EXECUTE FUNCTION public.trigger_crediq_score_update();
  END IF;
END $$;

-- Email notification trigger on score changes
CREATE OR REPLACE FUNCTION public.notify_crediq_score_change()
RETURNS TRIGGER AS $$
DECLARE
  v_preferences RECORD;
BEGIN
  -- Check if score change is significant (>= 10 points)
  IF ABS(COALESCE(NEW.score_change, 0)) >= 10 THEN
    -- Check user email preferences
    SELECT * INTO v_preferences
    FROM public.crediq_email_preferences
    WHERE user_id = NEW.user_id;
    
    -- Send email if enabled (or if preferences don't exist, default to true)
    IF v_preferences.score_change_alerts OR v_preferences.score_change_alerts IS NULL THEN
      -- Notify for email processing
      PERFORM pg_notify(
        'crediq_email_notification',
        json_build_object(
          'type', 'score_change',
          'user_id', NEW.user_id,
          'old_score', NEW.score - NEW.score_change,
          'new_score', NEW.score,
          'score_change', NEW.score_change,
          'change_reason', NEW.change_reason
        )::text
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_crediq_score_change ON public.credit_score_history;
CREATE TRIGGER on_crediq_score_change
  AFTER INSERT ON public.credit_score_history
  FOR EACH ROW EXECUTE FUNCTION public.notify_crediq_score_change();