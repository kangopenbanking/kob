-- Phase 4: PISP Resource Server - Payment Initiation
-- Create payments table to store payment requests

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT UNIQUE NOT NULL,
  consent_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  
  -- Payment details
  instructed_amount JSONB NOT NULL, -- { "amount": "100.00", "currency": "XAF" }
  creditor_account JSONB NOT NULL, -- { "scheme": "LOCAL_BANK", "identification": "12345", "name": "John Doe" }
  debtor_account JSONB, -- Optional, can be specified or derived from consent
  
  -- Additional payment information
  remittance_information TEXT,
  reference TEXT,
  
  -- Payment status
  status TEXT NOT NULL DEFAULT 'Pending', -- Pending, AcceptedSettlementInProgress, AcceptedSettlementCompleted, Rejected
  
  -- Risk assessment
  payment_context_code TEXT, -- BillPayment, EcommerceGoods, etc.
  merchant_category_code TEXT,
  merchant_customer_identification TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expected_execution_date DATE,
  expected_settlement_date DATE
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all payments"
  ON public.payments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_payments_payment_id ON public.payments(payment_id);
CREATE INDEX idx_payments_consent_id ON public.payments(consent_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- Create trigger for updated_at
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();