-- 1. Add compliance_officer role for granular KYC review access
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compliance_officer';

-- 2. Refresh KYC notification templates so variables match the edge function payload
--    and the body contains clear, actionable instructions for the customer.
INSERT INTO public.communication_templates (template_key, template_type, category, name, description, subject, body, variables, is_active, is_system)
VALUES
(
  'kyc_info_requested',
  'email',
  'security_alerts',
  'KYC Additional Information Requested',
  'Sent to the user when a reviewer needs additional information or documents to complete KYC.',
  'Action needed: additional information for your verification',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>More Info Needed</title></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;"><tr><td><h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0f172a;">Additional information needed</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Hello {{recipient_name}},</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Our compliance team is reviewing your verification and needs a little more information before they can approve it. Your submission has not been rejected &mdash; it is on hold until you respond.</p><table cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;width:100%;"><tr><td style="font-size:14px;color:#92400e;"><strong>What we need from you:</strong><br>{{info_request_message}}</td></tr></table><h2 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#0f172a;">Next steps</h2><ol style="margin:0 0 24px 18px;padding:0;font-size:14px;line-height:1.7;color:#334155;"><li>Sign in to your account.</li><li>Open <strong>Identity Verification</strong> from your dashboard banner.</li><li>Update or upload the requested information.</li><li>Resubmit &mdash; our team will review again within 1&ndash;2 business days.</li></ol><p style="margin:0 0 16px;font-size:13px;color:#64748b;">If you have any questions, reply to this email and our compliance team will assist you.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="margin:0;font-size:12px;color:#94a3b8;">Kang Open Banking &mdash; Compliance Team</p></td></tr></table></td></tr></table></body></html>',
  '["recipient_name","info_request_message","info_request_notes"]'::jsonb,
  true,
  true
),
(
  'kyc_rejected',
  'email',
  'security_alerts',
  'KYC Action Required',
  'Sent to the user when their KYC verification has been rejected with a reason.',
  'Action required: please resubmit your identity verification',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>KYC Action Required</title></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;"><tr><td><h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0f172a;">Verification not approved</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Hello {{recipient_name}},</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Unfortunately we were unable to approve your identity verification at this time. You can resubmit at any time using the steps below.</p><table cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;width:100%;"><tr><td style="font-size:14px;color:#991b1b;"><strong>Reason for decline:</strong><br>{{rejection_reason}}</td></tr></table><h2 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#0f172a;">How to resubmit</h2><ol style="margin:0 0 24px 18px;padding:0;font-size:14px;line-height:1.7;color:#334155;"><li>Sign in to your account.</li><li>Open <strong>Identity Verification</strong> from your dashboard banner.</li><li>Make sure your ID is valid, fully visible, and the photo is sharp.</li><li>Confirm the name, date of birth and document number match your profile exactly.</li><li>Submit the corrected information &mdash; reviews are typically completed within 1&ndash;2 business days.</li></ol><p style="margin:0 0 16px;font-size:13px;color:#64748b;">Need help? Reply to this email and our compliance team will guide you through resubmission.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="margin:0;font-size:12px;color:#94a3b8;">Kang Open Banking &mdash; Compliance Team</p></td></tr></table></td></tr></table></body></html>',
  '["recipient_name","rejection_reason"]'::jsonb,
  true,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = now();