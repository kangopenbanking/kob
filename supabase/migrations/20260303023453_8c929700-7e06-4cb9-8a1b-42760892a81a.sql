
-- Institution Email Settings: per-institution email branding & toggle control
CREATE TABLE public.institution_email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  is_global BOOLEAN NOT NULL DEFAULT false,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#007A3D',
  secondary_color TEXT DEFAULT '#1e3a8a',
  footer_text TEXT DEFAULT 'Powered by Kang Open Banking',
  from_name TEXT,
  reply_to_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id)
);

ALTER TABLE public.institution_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all email settings" ON public.institution_email_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution owners can view their settings" ON public.institution_email_settings
  FOR SELECT TO authenticated USING (
    institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid())
  );

-- Managed Email Types: master list of all email types the system supports
CREATE TABLE public.managed_email_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_subject TEXT NOT NULL,
  default_body_html TEXT NOT NULL,
  available_variables JSONB DEFAULT '[]'::jsonb,
  trigger_event TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.managed_email_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email types" ON public.managed_email_types
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view active types" ON public.managed_email_types
  FOR SELECT TO authenticated USING (is_active = true);

-- Institution Email Overrides: per-institution customization of specific email types
CREATE TABLE public.institution_email_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  email_type_id UUID NOT NULL REFERENCES public.managed_email_types(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  custom_subject TEXT,
  custom_body_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(institution_id, email_type_id)
);

ALTER TABLE public.institution_email_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage overrides" ON public.institution_email_overrides
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Institution owners can view their overrides" ON public.institution_email_overrides
  FOR SELECT TO authenticated USING (
    institution_id IN (SELECT id FROM public.institutions WHERE user_id = auth.uid())
  );

-- Email Send Log: unified log for all managed emails
CREATE TABLE public.managed_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type_id UUID REFERENCES public.managed_email_types(id),
  institution_id UUID REFERENCES public.institutions(id),
  recipient_user_id UUID,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.managed_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all email logs" ON public.managed_email_logs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_managed_email_types_category ON public.managed_email_types(category);
CREATE INDEX idx_managed_email_types_key ON public.managed_email_types(email_key);
CREATE INDEX idx_managed_email_logs_type ON public.managed_email_logs(email_type_id);
CREATE INDEX idx_managed_email_logs_institution ON public.managed_email_logs(institution_id);
CREATE INDEX idx_managed_email_logs_created ON public.managed_email_logs(created_at DESC);
CREATE INDEX idx_institution_email_overrides_inst ON public.institution_email_overrides(institution_id);

-- Triggers
CREATE TRIGGER update_institution_email_settings_updated_at
  BEFORE UPDATE ON public.institution_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_managed_email_types_updated_at
  BEFORE UPDATE ON public.managed_email_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_institution_email_overrides_updated_at
  BEFORE UPDATE ON public.institution_email_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed all managed email types across 4 categories
INSERT INTO public.managed_email_types (email_key, category, name, description, default_subject, default_body_html, available_variables, trigger_event, is_system, sort_order) VALUES

-- TRANSACTIONAL
('payment_received', 'transactional', 'Payment Received', 'Sent when a payment is received into an account', 'Payment Received – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>A payment of <strong>{{currency}} {{amount}}</strong> has been credited to your account ending in <strong>{{account_last4}}</strong>.</p><p><strong>Reference:</strong> {{reference}}<br><strong>Date:</strong> {{date}}<br><strong>New Balance:</strong> {{currency}} {{new_balance}}</p><p>If you did not initiate this transaction, please contact your bank immediately.</p>', '["customer_name","currency","amount","account_last4","reference","date","new_balance"]', 'transaction_credit', true, 1),

('payment_sent', 'transactional', 'Payment Sent', 'Sent when a payment is debited from an account', 'Payment Sent – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>A payment of <strong>{{currency}} {{amount}}</strong> has been debited from your account ending in <strong>{{account_last4}}</strong>.</p><p><strong>To:</strong> {{recipient_name}}<br><strong>Reference:</strong> {{reference}}<br><strong>Date:</strong> {{date}}<br><strong>Remaining Balance:</strong> {{currency}} {{remaining_balance}}</p>', '["customer_name","currency","amount","account_last4","recipient_name","reference","date","remaining_balance"]', 'transaction_debit', true, 2),

('transfer_complete', 'transactional', 'Transfer Complete', 'Sent when a bank transfer completes successfully', 'Transfer Complete – {{currency}} {{amount}} to {{recipient_name}}', '<p>Dear {{customer_name}},</p><p>Your transfer of <strong>{{currency}} {{amount}}</strong> to <strong>{{recipient_name}}</strong> at <strong>{{bank_name}}</strong> has been completed successfully.</p><p><strong>Reference:</strong> {{reference}}<br><strong>Date:</strong> {{date}}</p>', '["customer_name","currency","amount","recipient_name","bank_name","reference","date"]', 'transfer_completed', true, 3),

('transfer_failed', 'transactional', 'Transfer Failed', 'Sent when a bank transfer fails', 'Transfer Failed – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>Unfortunately, your transfer of <strong>{{currency}} {{amount}}</strong> to <strong>{{recipient_name}}</strong> could not be processed.</p><p><strong>Reason:</strong> {{failure_reason}}<br><strong>Reference:</strong> {{reference}}</p><p>The amount has been refunded to your account. Please try again or contact support.</p>', '["customer_name","currency","amount","recipient_name","failure_reason","reference"]', 'transfer_failed', true, 4),

('mobile_money_success', 'transactional', 'Mobile Money Transfer Complete', 'Sent when a MoMo transaction completes', 'Mobile Money Transfer Complete – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>Your Mobile Money transfer of <strong>{{currency}} {{amount}}</strong> to <strong>{{phone_number}}</strong> via <strong>{{provider}}</strong> was successful.</p><p><strong>Reference:</strong> {{reference}}<br><strong>Date:</strong> {{date}}</p>', '["customer_name","currency","amount","phone_number","provider","reference","date"]', 'momo_completed', true, 5),

('mobile_money_failed', 'transactional', 'Mobile Money Transfer Failed', 'Sent when a MoMo transaction fails', 'Mobile Money Transfer Failed', '<p>Dear {{customer_name}},</p><p>Your Mobile Money transfer of <strong>{{currency}} {{amount}}</strong> to <strong>{{phone_number}}</strong> could not be completed.</p><p><strong>Reason:</strong> {{failure_reason}}</p><p>Please try again or contact support for assistance.</p>', '["customer_name","currency","amount","phone_number","failure_reason"]', 'momo_failed', true, 6),

('deposit_confirmation', 'transactional', 'Deposit Confirmation', 'Sent when a deposit is confirmed', 'Deposit Confirmed – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>Your deposit of <strong>{{currency}} {{amount}}</strong> has been confirmed and credited to your account.</p><p><strong>Account:</strong> ****{{account_last4}}<br><strong>Reference:</strong> {{reference}}<br><strong>Date:</strong> {{date}}</p>', '["customer_name","currency","amount","account_last4","reference","date"]', 'deposit_confirmed', true, 7),

('withdrawal_confirmation', 'transactional', 'Withdrawal Confirmation', 'Sent when a withdrawal is processed', 'Withdrawal Processed – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>Your withdrawal of <strong>{{currency}} {{amount}}</strong> has been processed.</p><p><strong>Method:</strong> {{method}}<br><strong>Expected Arrival:</strong> {{expected_arrival}}<br><strong>Reference:</strong> {{reference}}</p>', '["customer_name","currency","amount","method","expected_arrival","reference"]', 'withdrawal_processed', true, 8),

('loan_disbursed', 'transactional', 'Loan Disbursed', 'Sent when loan funds are disbursed', 'Loan Disbursed – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>Your loan of <strong>{{currency}} {{amount}}</strong> has been disbursed to your account.</p><p><strong>Loan ID:</strong> {{loan_id}}<br><strong>Monthly Payment:</strong> {{currency}} {{monthly_payment}}<br><strong>First Payment Due:</strong> {{first_due_date}}<br><strong>Interest Rate:</strong> {{interest_rate}}%</p>', '["customer_name","currency","amount","loan_id","monthly_payment","first_due_date","interest_rate"]', 'loan_disbursed', true, 9),

('loan_repayment_received', 'transactional', 'Loan Repayment Received', 'Sent when a loan repayment is received', 'Loan Repayment Received – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>We have received your loan repayment of <strong>{{currency}} {{amount}}</strong>.</p><p><strong>Loan ID:</strong> {{loan_id}}<br><strong>Remaining Balance:</strong> {{currency}} {{remaining_balance}}<br><strong>Next Payment Due:</strong> {{next_due_date}}</p>', '["customer_name","currency","amount","loan_id","remaining_balance","next_due_date"]', 'loan_repayment', true, 10),

-- ACCOUNT LIFECYCLE
('welcome_email', 'account_lifecycle', 'Welcome Email', 'Sent when a new customer registers', 'Welcome to {{institution_name}} – Your Account is Ready', '<p>Dear {{customer_name}},</p><p>Welcome to <strong>{{institution_name}}</strong>! Your account has been created successfully.</p><p>Here''s what you can do next:</p><ul><li>Complete your identity verification (KYC)</li><li>Add funds to your account</li><li>Set up your security PIN</li><li>Explore our services</li></ul><p>If you have any questions, our support team is here to help.</p>', '["customer_name","institution_name"]', 'user_registered', true, 20),

('kyc_approved', 'account_lifecycle', 'KYC Approved', 'Sent when identity verification is approved', 'Identity Verification Approved', '<p>Dear {{customer_name}},</p><p>Your identity verification has been <strong>approved</strong>. You now have full access to all banking services.</p><p>You can now:</p><ul><li>Make unlimited transfers</li><li>Apply for loans</li><li>Access premium features</li></ul>', '["customer_name"]', 'kyc_approved', true, 21),

('kyc_rejected', 'account_lifecycle', 'KYC Rejected', 'Sent when identity verification is rejected', 'Identity Verification – Action Required', '<p>Dear {{customer_name}},</p><p>Unfortunately, your identity verification could not be completed.</p><p><strong>Reason:</strong> {{rejection_reason}}</p><p>Please re-submit your documents ensuring they are clear, valid, and match your registered information.</p>', '["customer_name","rejection_reason"]', 'kyc_rejected', true, 22),

('account_suspended', 'account_lifecycle', 'Account Suspended', 'Sent when an account is suspended', 'Account Suspended – Immediate Action Required', '<p>Dear {{customer_name}},</p><p>Your account has been <strong>temporarily suspended</strong>.</p><p><strong>Reason:</strong> {{suspension_reason}}</p><p>To restore access, please contact our support team with the required documentation.</p>', '["customer_name","suspension_reason"]', 'account_suspended', true, 23),

('account_reactivated', 'account_lifecycle', 'Account Reactivated', 'Sent when an account is reactivated', 'Account Reactivated – Welcome Back', '<p>Dear {{customer_name}},</p><p>Your account has been <strong>reactivated</strong>. You now have full access to all services.</p><p>If you did not request this change, please contact our support team immediately.</p>', '["customer_name"]', 'account_reactivated', true, 24),

('profile_updated', 'account_lifecycle', 'Profile Updated', 'Sent when profile information changes', 'Profile Information Updated', '<p>Dear {{customer_name}},</p><p>Your profile information has been updated:</p><p><strong>Changed fields:</strong> {{changed_fields}}</p><p><strong>Date:</strong> {{date}}</p><p>If you did not make these changes, please contact support immediately and change your password.</p>', '["customer_name","changed_fields","date"]', 'profile_updated', true, 25),

('institution_approved', 'account_lifecycle', 'Institution Approved', 'Sent when an institution is approved on the platform', 'Welcome to Kang Open Banking – Institution Approved', '<p>Dear {{contact_name}},</p><p>Congratulations! <strong>{{institution_name}}</strong> has been approved on the Kang Open Banking platform.</p><p>Your institution is now ready to:</p><ul><li>Onboard customers</li><li>Process transactions</li><li>Access API integrations</li></ul><p>Visit your dashboard to get started.</p>', '["contact_name","institution_name"]', 'institution_approved', true, 26),

-- SECURITY & ALERTS
('login_new_device', 'security', 'New Device Login', 'Sent when login detected from a new device', 'New Device Login Detected', '<p>Dear {{customer_name}},</p><p>A login to your account was detected from a new device.</p><p><strong>Device:</strong> {{device_info}}<br><strong>Location:</strong> {{location}}<br><strong>Time:</strong> {{login_time}}</p><p>If this was you, no action is needed. If you don''t recognise this activity, please change your password immediately and contact support.</p>', '["customer_name","device_info","location","login_time"]', 'new_device_login', true, 30),

('password_changed', 'security', 'Password Changed', 'Sent when password is successfully changed', 'Password Changed Successfully', '<p>Dear {{customer_name}},</p><p>Your password was changed successfully on <strong>{{date}}</strong>.</p><p>If you did not make this change, please contact our support team immediately.</p>', '["customer_name","date"]', 'password_changed', true, 31),

('suspicious_activity', 'security', 'Suspicious Activity Alert', 'Sent when suspicious activity is detected', 'Suspicious Activity Detected on Your Account', '<p>Dear {{customer_name}},</p><p>We have detected <strong>unusual activity</strong> on your account.</p><p><strong>Activity:</strong> {{activity_description}}<br><strong>Time:</strong> {{timestamp}}</p><p>For your safety, some features may have been temporarily restricted. Please verify your identity to restore full access.</p>', '["customer_name","activity_description","timestamp"]', 'suspicious_activity', true, 32),

('two_factor_enabled', 'security', '2FA Enabled', 'Sent when two-factor authentication is enabled', 'Two-Factor Authentication Enabled', '<p>Dear {{customer_name}},</p><p>Two-factor authentication has been <strong>enabled</strong> on your account. Your account is now more secure.</p><p><strong>Date:</strong> {{date}}</p><p>You will need to enter a verification code each time you log in.</p>', '["customer_name","date"]', '2fa_enabled', true, 33),

('pin_changed', 'security', 'PIN Changed', 'Sent when security PIN is changed', 'Security PIN Changed', '<p>Dear {{customer_name}},</p><p>Your security PIN was changed on <strong>{{date}}</strong>.</p><p>If you did not make this change, please contact support immediately.</p>', '["customer_name","date"]', 'pin_changed', true, 34),

('failed_login_alert', 'security', 'Failed Login Attempts', 'Sent after multiple failed login attempts', 'Multiple Failed Login Attempts Detected', '<p>Dear {{customer_name}},</p><p>We detected <strong>{{attempt_count}} failed login attempts</strong> on your account.</p><p><strong>Time:</strong> {{timestamp}}<br><strong>IP Address:</strong> {{ip_address}}</p><p>If this wasn''t you, we recommend changing your password immediately.</p>', '["customer_name","attempt_count","timestamp","ip_address"]', 'failed_logins', true, 35),

-- CREDIT (CrediQ)
('credit_score_changed', 'credit', 'Credit Score Changed', 'Sent when credit score changes significantly', 'Your Credit Score Has Changed', '<p>Dear {{customer_name}},</p><p>Your credit score has changed.</p><p><strong>Previous Score:</strong> {{old_score}}<br><strong>New Score:</strong> {{new_score}}<br><strong>Change:</strong> {{change_direction}} {{change_amount}} points<br><strong>Reason:</strong> {{change_reason}}</p><p>Continue making on-time payments to maintain and improve your score.</p>', '["customer_name","old_score","new_score","change_direction","change_amount","change_reason"]', 'credit_score_change', true, 40),

('credit_goal_achieved', 'credit', 'Credit Goal Achieved', 'Sent when a credit score goal is reached', '🎉 Congratulations! You Reached Your Credit Goal', '<p>Dear {{customer_name}},</p><p>Amazing work! You''ve reached your credit goal of <strong>{{target_score}}</strong>!</p><p><strong>Starting Score:</strong> {{starting_score}}<br><strong>Goal Score:</strong> {{target_score}}<br><strong>Days Taken:</strong> {{days_taken}}</p><p>Set your next goal and keep building your financial strength.</p>', '["customer_name","target_score","starting_score","days_taken"]', 'goal_achieved', true, 41),

('monthly_credit_report', 'credit', 'Monthly Credit Report', 'Monthly summary of credit activity', 'Your Monthly Credit Report – {{month_year}}', '<p>Dear {{customer_name}},</p><p>Here is your credit summary for <strong>{{month_year}}</strong>.</p><p><strong>Current Score:</strong> {{current_score}}<br><strong>Monthly Change:</strong> {{score_change}}<br><strong>Payments On Time:</strong> {{on_time_count}}/{{total_payments}}<br><strong>Goals Achieved:</strong> {{goals_achieved}}</p><p>Keep up the great work and continue building your credit strength.</p>', '["customer_name","month_year","current_score","score_change","on_time_count","total_payments","goals_achieved"]', 'monthly_credit_report', true, 42),

('loan_payment_reminder', 'credit', 'Loan Payment Reminder', 'Sent before a loan payment is due', 'Loan Payment Due – {{currency}} {{amount}} on {{due_date}}', '<p>Dear {{customer_name}},</p><p>This is a reminder that your loan payment of <strong>{{currency}} {{amount}}</strong> is due on <strong>{{due_date}}</strong>.</p><p><strong>Loan ID:</strong> {{loan_id}}<br><strong>Remaining Balance:</strong> {{currency}} {{remaining_balance}}</p><p>On-time payments positively impact your credit score.</p>', '["customer_name","currency","amount","due_date","loan_id","remaining_balance"]', 'loan_payment_due', true, 43),

('loan_overdue_notice', 'credit', 'Loan Overdue Notice', 'Sent when a loan payment is overdue', 'Loan Payment Overdue – Immediate Action Required', '<p>Dear {{customer_name}},</p><p>Your loan payment of <strong>{{currency}} {{amount}}</strong> was due on <strong>{{due_date}}</strong> and is now <strong>{{days_overdue}} days overdue</strong>.</p><p><strong>Loan ID:</strong> {{loan_id}}</p><p>Late payments negatively affect your credit score. Please make your payment as soon as possible to avoid further penalties.</p>', '["customer_name","currency","amount","due_date","days_overdue","loan_id"]', 'loan_overdue', true, 44),

('savings_milestone', 'credit', 'Savings Milestone', 'Sent when a savings milestone is reached', 'Savings Milestone Reached – {{currency}} {{amount}}', '<p>Dear {{customer_name}},</p><p>Congratulations! You''ve reached a savings milestone of <strong>{{currency}} {{amount}}</strong> in your <strong>{{plan_name}}</strong> savings plan.</p><p>Regular savings deposits positively impact your credit score. Keep it up!</p>', '["customer_name","currency","amount","plan_name"]', 'savings_milestone', true, 45);
