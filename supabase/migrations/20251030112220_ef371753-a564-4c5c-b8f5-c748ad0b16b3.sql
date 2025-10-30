-- Create credit_score_tips table for AI-generated personalized tips
CREATE TABLE IF NOT EXISTS public.credit_score_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_score_id UUID REFERENCES public.credit_scores(id) ON DELETE CASCADE,
  tip_category TEXT NOT NULL CHECK (tip_category IN ('quick_win', 'medium_term', 'long_term')),
  tip_content TEXT NOT NULL,
  estimated_impact INTEGER,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_credit_score_tips_user_id ON public.credit_score_tips(user_id);
CREATE INDEX idx_credit_score_tips_expires_at ON public.credit_score_tips(expires_at);

-- Enable RLS
ALTER TABLE public.credit_score_tips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_score_tips
CREATE POLICY "Users can view their own tips"
  ON public.credit_score_tips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tips"
  ON public.credit_score_tips FOR UPDATE
  USING (auth.uid() = user_id);

-- Create credit_score_simulations table for what-if scenarios
CREATE TABLE IF NOT EXISTS public.credit_score_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulation_type TEXT NOT NULL CHECK (simulation_type IN ('loan_payoff', 'savings_deposit', 'new_account', 'payment_skip')),
  input_parameters JSONB NOT NULL,
  current_score INTEGER NOT NULL,
  predicted_score INTEGER NOT NULL,
  score_change INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX idx_credit_score_simulations_user_id ON public.credit_score_simulations(user_id);

-- Enable RLS
ALTER TABLE public.credit_score_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_score_simulations
CREATE POLICY "Users can view their own simulations"
  ON public.credit_score_simulations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own simulations"
  ON public.credit_score_simulations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create credit_goals table for target score tracking
CREATE TABLE IF NOT EXISTS public.credit_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_score INTEGER NOT NULL CHECK (target_score >= 300 AND target_score <= 850),
  current_score INTEGER NOT NULL,
  deadline DATE,
  milestone_alerts JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  achieved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX idx_credit_goals_user_id ON public.credit_goals(user_id);
CREATE INDEX idx_credit_goals_is_active ON public.credit_goals(is_active);

-- Enable RLS
ALTER TABLE public.credit_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_goals
CREATE POLICY "Users can view their own goals"
  ON public.credit_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON public.credit_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.credit_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.credit_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at on credit_goals
CREATE OR REPLACE FUNCTION public.update_credit_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_credit_goals_updated_at
  BEFORE UPDATE ON public.credit_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_credit_goals_updated_at();