
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transaction_alerts BOOLEAN DEFAULT true;
