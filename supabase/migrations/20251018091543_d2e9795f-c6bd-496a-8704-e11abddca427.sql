-- Create enum for template types
CREATE TYPE template_type AS ENUM (
  'email',
  'sms'
);

-- Create enum for template categories
CREATE TYPE template_category AS ENUM (
  'user_auth',
  'institution_management',
  'consent_management',
  'payment_notifications',
  'security_alerts',
  'system_notifications',
  'api_notifications'
);

-- Create communication templates table
CREATE TABLE public.communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  template_type template_type NOT NULL,
  category template_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT, -- For emails
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- List of variables that can be used in template
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false, -- System templates cannot be deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create communication logs table
CREATE TABLE public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.communication_templates(id),
  recipient_type TEXT NOT NULL, -- 'user', 'institution', 'admin'
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  communication_type template_type NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, delivered
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create bulk communications table for tracking mass emails
CREATE TABLE public.bulk_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.communication_templates(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_filter JSONB, -- Filter criteria for recipients
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for communication_templates
CREATE POLICY "Admins can manage all templates"
  ON public.communication_templates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active templates"
  ON public.communication_templates
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for communication_logs
CREATE POLICY "Admins can view all communication logs"
  ON public.communication_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own communication logs"
  ON public.communication_logs
  FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "System can insert communication logs"
  ON public.communication_logs
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for bulk_communications
CREATE POLICY "Admins can manage bulk communications"
  ON public.bulk_communications
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_communication_templates_updated_at
  BEFORE UPDATE ON public.communication_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_communication_logs_recipient ON public.communication_logs(recipient_id);
CREATE INDEX idx_communication_logs_status ON public.communication_logs(status);
CREATE INDEX idx_communication_logs_created_at ON public.communication_logs(created_at DESC);
CREATE INDEX idx_communication_templates_category ON public.communication_templates(category);
CREATE INDEX idx_communication_templates_type ON public.communication_templates(template_type);

-- Insert default email templates
INSERT INTO public.communication_templates (template_key, template_type, category, name, description, subject, body, variables, is_system) VALUES
-- User Authentication Templates
('user_welcome', 'email', 'user_auth', 'Welcome Email', 'Sent when a new user registers', 'Welcome to {{platform_name}}!', 
'<h1>Welcome {{user_name}}!</h1>
<p>Thank you for joining {{platform_name}}. Your account has been successfully created.</p>
<p>You can now access our Open Banking API and start integrating with financial institutions.</p>
<p>Next steps:</p>
<ul>
  <li>Complete your profile</li>
  <li>Review our API documentation</li>
  <li>Generate your API credentials</li>
</ul>
<p>If you have any questions, feel free to contact our support team.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["user_name", "platform_name"]'::jsonb, true),

('password_reset', 'email', 'user_auth', 'Password Reset', 'Sent when user requests password reset', 'Reset Your Password', 
'<h1>Password Reset Request</h1>
<p>Hi {{user_name}},</p>
<p>We received a request to reset your password. Click the link below to create a new password:</p>
<p><a href="{{reset_link}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
<p>This link will expire in {{expiry_hours}} hours.</p>
<p>If you didn''t request this, please ignore this email.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["user_name", "reset_link", "expiry_hours", "platform_name"]'::jsonb, true),

-- Institution Management Templates
('institution_registered', 'email', 'institution_management', 'Institution Registration Received', 'Sent when institution submits registration', 'Registration Received - {{institution_name}}', 
'<h1>Registration Received</h1>
<p>Dear {{contact_name}},</p>
<p>Thank you for registering {{institution_name}} on our Open Banking platform.</p>
<p>Your registration is currently under review. Our team will verify the information and get back to you within 2-3 business days.</p>
<p><strong>Registration Details:</strong></p>
<ul>
  <li>Institution Type: {{institution_type}}</li>
  <li>Registration Number: {{registration_number}}</li>
  <li>Submission Date: {{submission_date}}</li>
</ul>
<p>You will receive another email once your application is reviewed.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["contact_name", "institution_name", "institution_type", "registration_number", "submission_date", "platform_name"]'::jsonb, true),

('institution_approved', 'email', 'institution_management', 'Institution Approved', 'Sent when institution is approved', 'Congratulations! {{institution_name}} Has Been Approved', 
'<h1>Your Institution Has Been Approved!</h1>
<p>Dear {{contact_name}},</p>
<p>Great news! {{institution_name}} has been approved on our Open Banking platform.</p>
<p>You can now:</p>
<ul>
  <li>Access the TPP registration portal</li>
  <li>Register your applications</li>
  <li>Generate API credentials</li>
  <li>Start testing in sandbox environment</li>
</ul>
<p><a href="{{portal_link}}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Access Portal</a></p>
<p>For technical documentation and integration guides, visit our <a href="{{docs_link}}">developer portal</a>.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["contact_name", "institution_name", "portal_link", "docs_link", "platform_name"]'::jsonb, true),

('institution_rejected', 'email', 'institution_management', 'Institution Registration Declined', 'Sent when institution is rejected', 'Registration Update - {{institution_name}}', 
'<h1>Registration Status Update</h1>
<p>Dear {{contact_name}},</p>
<p>Thank you for your interest in joining our Open Banking platform.</p>
<p>After careful review, we are unable to approve the registration for {{institution_name}} at this time.</p>
<p><strong>Reason:</strong> {{rejection_reason}}</p>
<p>If you believe this is an error or would like to discuss this decision, please contact our support team.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["contact_name", "institution_name", "rejection_reason", "platform_name"]'::jsonb, true),

-- Consent Management Templates
('consent_created', 'email', 'consent_management', 'Consent Request Created', 'Sent when new consent is created', 'New Consent Request - Action Required', 
'<h1>New Consent Request</h1>
<p>Dear {{user_name}},</p>
<p>{{institution_name}} has requested your consent to access your account information.</p>
<p><strong>Requested Permissions:</strong></p>
<ul>
{{#each permissions}}
  <li>{{this}}</li>
{{/each}}
</ul>
<p><strong>Valid Until:</strong> {{expiry_date}}</p>
<p><a href="{{authorization_link}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Review & Authorize</a></p>
<p>This request will expire in {{expiry_hours}} hours.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["user_name", "institution_name", "permissions", "expiry_date", "expiry_hours", "authorization_link", "platform_name"]'::jsonb, true),

('consent_authorized', 'email', 'consent_management', 'Consent Authorized', 'Sent when consent is authorized', 'Consent Authorized Successfully', 
'<h1>Consent Authorized</h1>
<p>Dear {{user_name}},</p>
<p>You have successfully authorized {{institution_name}} to access your account information.</p>
<p><strong>Consent ID:</strong> {{consent_id}}</p>
<p><strong>Authorized Permissions:</strong></p>
<ul>
{{#each permissions}}
  <li>{{this}}</li>
{{/each}}
</ul>
<p><strong>Valid Until:</strong> {{expiry_date}}</p>
<p>You can revoke this consent at any time from your dashboard.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["user_name", "institution_name", "consent_id", "permissions", "expiry_date", "platform_name"]'::jsonb, true),

('consent_revoked', 'email', 'consent_management', 'Consent Revoked', 'Sent when consent is revoked', 'Consent Revoked', 
'<h1>Consent Revoked</h1>
<p>Dear {{user_name}},</p>
<p>Your consent for {{institution_name}} has been revoked.</p>
<p><strong>Consent ID:</strong> {{consent_id}}</p>
<p>{{institution_name}} will no longer have access to your account information.</p>
<p>If you did not initiate this action, please contact our support team immediately.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["user_name", "institution_name", "consent_id", "platform_name"]'::jsonb, true),

-- Payment Notifications
('payment_initiated', 'email', 'payment_notifications', 'Payment Initiated', 'Sent when payment is initiated', 'Payment Initiated - {{amount}} {{currency}}', 
'<h1>Payment Initiated</h1>
<p>Dear {{user_name}},</p>
<p>A payment has been initiated from your account.</p>
<p><strong>Payment Details:</strong></p>
<ul>
  <li>Amount: {{amount}} {{currency}}</li>
  <li>Recipient: {{recipient_name}}</li>
  <li>Reference: {{reference}}</li>
  <li>Payment ID: {{payment_id}}</li>
  <li>Expected Execution: {{execution_date}}</li>
</ul>
<p>You will receive another notification once the payment is completed.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["user_name", "amount", "currency", "recipient_name", "reference", "payment_id", "execution_date", "platform_name"]'::jsonb, true),

('payment_completed', 'email', 'payment_notifications', 'Payment Completed', 'Sent when payment is completed', 'Payment Completed - {{amount}} {{currency}}', 
'<h1>Payment Completed Successfully</h1>
<p>Dear {{user_name}},</p>
<p>Your payment has been completed successfully.</p>
<p><strong>Payment Details:</strong></p>
<ul>
  <li>Amount: {{amount}} {{currency}}</li>
  <li>Recipient: {{recipient_name}}</li>
  <li>Reference: {{reference}}</li>
  <li>Payment ID: {{payment_id}}</li>
  <li>Completed At: {{completion_date}}</li>
</ul>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["user_name", "amount", "currency", "recipient_name", "reference", "payment_id", "completion_date", "platform_name"]'::jsonb, true),

-- Security Alerts
('security_login_suspicious', 'email', 'security_alerts', 'Suspicious Login Detected', 'Sent when suspicious login is detected', 'Security Alert: Suspicious Login Attempt', 
'<h1>⚠️ Suspicious Login Detected</h1>
<p>Dear {{user_name}},</p>
<p>We detected a suspicious login attempt on your account.</p>
<p><strong>Details:</strong></p>
<ul>
  <li>Time: {{login_time}}</li>
  <li>Location: {{location}}</li>
  <li>IP Address: {{ip_address}}</li>
  <li>Device: {{device}}</li>
</ul>
<p>If this was you, no action is needed. If you don''t recognize this activity, please secure your account immediately:</p>
<p><a href="{{secure_account_link}}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Secure My Account</a></p>
<p>Best regards,<br>The {{platform_name}} Security Team</p>',
'["user_name", "login_time", "location", "ip_address", "device", "secure_account_link", "platform_name"]'::jsonb, true),

('api_credentials_issued', 'email', 'api_notifications', 'API Credentials Issued', 'Sent when API credentials are generated', 'API Credentials Generated', 
'<h1>API Credentials Generated</h1>
<p>Dear {{contact_name}},</p>
<p>Your API credentials for {{institution_name}} have been generated successfully.</p>
<p><strong>Environment:</strong> {{environment}}</p>
<p><strong>Client ID:</strong> <code>{{client_id}}</code></p>
<p><strong>⚠️ Security Notice:</strong></p>
<ul>
  <li>Your client secret has been sent separately</li>
  <li>Store your credentials securely</li>
  <li>Never share your credentials</li>
  <li>Rotate credentials regularly</li>
</ul>
<p><a href="{{docs_link}}">View Integration Guide</a></p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["contact_name", "institution_name", "environment", "client_id", "docs_link", "platform_name"]'::jsonb, true),

('rate_limit_warning', 'email', 'api_notifications', 'Rate Limit Warning', 'Sent when approaching rate limits', 'Rate Limit Warning - {{institution_name}}', 
'<h1>⚠️ Rate Limit Warning</h1>
<p>Dear {{contact_name}},</p>
<p>Your application for {{institution_name}} is approaching its rate limits.</p>
<p><strong>Current Usage:</strong></p>
<ul>
  <li>Requests: {{current_requests}} / {{limit_requests}}</li>
  <li>Usage: {{usage_percentage}}%</li>
  <li>Endpoint: {{endpoint}}</li>
</ul>
<p>Consider optimizing your API calls or contact us to discuss increasing your limits.</p>
<p>Best regards,<br>The {{platform_name}} Team</p>',
'["contact_name", "institution_name", "current_requests", "limit_requests", "usage_percentage", "endpoint", "platform_name"]'::jsonb, true);

-- Insert default SMS templates
INSERT INTO public.communication_templates (template_key, template_type, category, name, description, body, variables, is_system) VALUES
('mfa_code', 'sms', 'user_auth', 'MFA Verification Code', 'Sent for two-factor authentication', 'Your {{platform_name}} verification code is: {{code}}. Valid for {{expiry_minutes}} minutes. Do not share this code.', 
'["platform_name", "code", "expiry_minutes"]'::jsonb, true),

('payment_alert', 'sms', 'payment_notifications', 'Payment Alert SMS', 'Quick payment notification via SMS', 'Payment of {{amount}} {{currency}} to {{recipient}} initiated. Ref: {{reference}}. {{platform_name}}', 
'["amount", "currency", "recipient", "reference", "platform_name"]'::jsonb, true),

('security_alert', 'sms', 'security_alerts', 'Security Alert SMS', 'Urgent security notification', '⚠️ Security Alert: {{alert_message}}. If this wasn''t you, secure your account immediately at {{link}}. {{platform_name}}', 
'["alert_message", "link", "platform_name"]'::jsonb, true),

('consent_expiring', 'sms', 'consent_management', 'Consent Expiring', 'Reminder when consent is about to expire', 'Your consent for {{institution_name}} expires in {{days}} days. Renew at {{link}}. {{platform_name}}', 
'["institution_name", "days", "link", "platform_name"]'::jsonb, true);