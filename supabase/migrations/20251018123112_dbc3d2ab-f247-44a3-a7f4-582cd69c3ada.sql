-- Create mobile money accounts table
CREATE TABLE IF NOT EXISTS public.mobile_money_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'orange')),
  account_name TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create mobile money transactions table
CREATE TABLE IF NOT EXISTS public.mobile_money_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile_account_id UUID REFERENCES public.mobile_money_accounts(id) ON DELETE SET NULL,
  transaction_ref TEXT NOT NULL UNIQUE,
  flutterwave_ref TEXT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('charge', 'transfer', 'payout')),
  provider TEXT NOT NULL CHECK (provider IN ('mtn', 'orange')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'cancelled')),
  description TEXT,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.mobile_money_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_money_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mobile_money_accounts
CREATE POLICY "Users can view own mobile money accounts"
  ON public.mobile_money_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own mobile money accounts"
  ON public.mobile_money_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mobile money accounts"
  ON public.mobile_money_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mobile money accounts"
  ON public.mobile_money_accounts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all mobile money accounts"
  ON public.mobile_money_accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for mobile_money_transactions
CREATE POLICY "Users can view own mobile money transactions"
  ON public.mobile_money_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own mobile money transactions"
  ON public.mobile_money_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all mobile money transactions"
  ON public.mobile_money_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all mobile money transactions"
  ON public.mobile_money_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_mobile_accounts_user_id ON public.mobile_money_accounts(user_id);
CREATE INDEX idx_mobile_accounts_phone ON public.mobile_money_accounts(phone_number);
CREATE INDEX idx_mobile_transactions_user_id ON public.mobile_money_transactions(user_id);
CREATE INDEX idx_mobile_transactions_ref ON public.mobile_money_transactions(transaction_ref);
CREATE INDEX idx_mobile_transactions_status ON public.mobile_money_transactions(status);
CREATE INDEX idx_mobile_transactions_created ON public.mobile_money_transactions(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_mobile_accounts_updated_at
  BEFORE UPDATE ON public.mobile_money_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mobile_transactions_updated_at
  BEFORE UPDATE ON public.mobile_money_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();