-- Create audit_logs table for compliance tracking
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- System can insert audit logs (no RLS restriction for inserts from service role)
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_performed_by ON public.audit_logs(performed_by);

-- Add sandbox_credentials column to institutions table
ALTER TABLE public.institutions 
ADD COLUMN IF NOT EXISTS sandbox_credentials JSONB DEFAULT NULL;

COMMENT ON COLUMN public.institutions.sandbox_credentials IS 'API credentials for sandbox environment (client_id, client_secret, etc.)';

-- Create communication templates for institution approval/rejection
INSERT INTO public.communication_templates (template_key, template_type, category, subject, body, is_active, name)
VALUES 
  (
    'institution_approved',
    'email',
    'institution_management',
    '🎉 Your Institution Registration Has Been Approved',
    '<html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #22c55e;">Congratulations! Your Application is Approved</h1>
        <p>Dear <strong>{{institution_name}}</strong>,</p>
        <p>We are pleased to inform you that your institution registration has been <strong>approved</strong>.</p>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">🚀 Your Access Details</h3>
          <p>You can now access your portal and start using our platform.</p>
          <p><strong>Portal URL:</strong> <a href="{{portal_url}}">{{portal_url}}</a></p>
        </div>
        
        <h3>Next Steps:</h3>
        <ul>
          <li>Log in to your portal</li>
          <li>Complete your institution profile</li>
          <li>Configure your API settings</li>
          <li>Review our documentation</li>
        </ul>
        
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br><strong>KOB Team</strong></p>
      </body>
    </html>',
    true,
    'Institution Approved'
  ),
  (
    'institution_rejected',
    'email',
    'institution_management',
    '❌ Update on Your Institution Registration',
    '<html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #ef4444;">Registration Status Update</h1>
        <p>Dear <strong>{{institution_name}}</strong>,</p>
        <p>Thank you for your interest in registering with our Open Banking Platform.</p>
        <p>After careful review, we regret to inform you that your registration cannot be approved at this time.</p>
        
        <div style="background: #fee; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
          <h3 style="margin-top: 0;">Reason for Rejection:</h3>
          <p>{{rejection_reason}}</p>
        </div>
        
        <h3>What You Can Do:</h3>
        <ul>
          <li>Address the issues mentioned above</li>
          <li>Submit a new application with corrected information</li>
          <li>Contact our support team for clarification</li>
        </ul>
        
        <p>We appreciate your understanding and hope to work with you in the future.</p>
        <p>Best regards,<br><strong>KOB Team</strong></p>
      </body>
    </html>',
    true,
    'Institution Rejected'
  )
ON CONFLICT (template_key) DO UPDATE
SET 
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  is_active = EXCLUDED.is_active;