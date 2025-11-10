-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification channels
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  
  -- Alert types
  security_alerts BOOLEAN DEFAULT true,
  transaction_alerts BOOLEAN DEFAULT true,
  payment_alerts BOOLEAN DEFAULT true,
  credit_score_alerts BOOLEAN DEFAULT true,
  loan_alerts BOOLEAN DEFAULT true,
  savings_alerts BOOLEAN DEFAULT true,
  
  -- Frequency
  instant_notifications BOOLEAN DEFAULT true,
  daily_digest BOOLEAN DEFAULT false,
  weekly_summary BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- Update trigger
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();