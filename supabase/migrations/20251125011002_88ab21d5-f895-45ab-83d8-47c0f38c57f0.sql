-- Create WooCommerce Merchants table
CREATE TABLE woocommerce_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  store_name TEXT NOT NULL,
  store_url TEXT NOT NULL UNIQUE,
  admin_email TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  plugin_version TEXT,
  payment_methods JSONB DEFAULT '["mobile_money", "card", "bank_transfer"]'::jsonb,
  webhook_url TEXT,
  webhook_secret TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create WooCommerce Transactions table
CREATE TABLE woocommerce_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES woocommerce_merchants(id) ON DELETE CASCADE,
  woocommerce_order_id TEXT NOT NULL,
  transaction_ref TEXT NOT NULL UNIQUE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mobile_money', 'card', 'bank_transfer')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'XAF' NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  kob_transaction_id UUID,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_woocommerce_merchants_user_id ON woocommerce_merchants(user_id);
CREATE INDEX idx_woocommerce_merchants_status ON woocommerce_merchants(status);
CREATE INDEX idx_woocommerce_transactions_merchant_id ON woocommerce_transactions(merchant_id);
CREATE INDEX idx_woocommerce_transactions_status ON woocommerce_transactions(status);
CREATE INDEX idx_woocommerce_transactions_created_at ON woocommerce_transactions(created_at);

-- Enable Row Level Security
ALTER TABLE woocommerce_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE woocommerce_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for woocommerce_merchants
CREATE POLICY "Admins can manage all merchants"
  ON woocommerce_merchants
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can view their own data"
  ON woocommerce_merchants
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can register as merchants"
  ON woocommerce_merchants
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Merchants can update own data"
  ON woocommerce_merchants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for woocommerce_transactions
CREATE POLICY "Admins can view all transactions"
  ON woocommerce_transactions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can view own transactions"
  ON woocommerce_transactions
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM woocommerce_merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert transactions"
  ON woocommerce_transactions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update transactions"
  ON woocommerce_transactions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_woocommerce_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_woocommerce_merchants_updated_at
  BEFORE UPDATE ON woocommerce_merchants
  FOR EACH ROW
  EXECUTE FUNCTION update_woocommerce_updated_at();

CREATE TRIGGER update_woocommerce_transactions_updated_at
  BEFORE UPDATE ON woocommerce_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_woocommerce_updated_at();