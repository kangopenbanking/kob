
INSERT INTO public.communication_templates (template_key, template_type, category, name, description, subject, body, variables, is_active, is_system)
VALUES
(
  'kyc_submitted',
  'email',
  'security_alerts',
  'KYC Submission Received',
  'Sent to the user when their KYC submission is received and queued for review.',
  'We received your verification documents',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>KYC Received</title></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;"><tr><td><h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0f172a;">Verification received</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Hello {{recipient_name}},</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">We have received your identity verification submission and our compliance team will review it shortly. Verification typically takes 1–2 business days.</p><table cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 24px;width:100%;"><tr><td style="font-size:13px;color:#475569;"><strong style="color:#0f172a;">Reference:</strong> {{verification_id}}<br><strong style="color:#0f172a;">Submitted:</strong> {{submitted_at}}</td></tr></table><p style="margin:0 0 8px;font-size:14px;color:#475569;">We will email you as soon as the review is complete. No action is needed from you in the meantime.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="margin:0;font-size:12px;color:#94a3b8;">Kang Open Banking — Compliance Team</p></td></tr></table></td></tr></table></body></html>',
  '["recipient_name","verification_id","submitted_at"]'::jsonb,
  true,
  true
),
(
  'kyc_approved',
  'email',
  'security_alerts',
  'KYC Approved',
  'Sent to the user when their KYC verification has been approved.',
  'Your identity has been verified',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>KYC Approved</title></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;"><tr><td><h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0f172a;">Identity verified</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Hello {{recipient_name}},</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Great news — your identity verification has been approved. Your account now has full access to all features including payments, transfers, and higher transaction limits.</p><table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 24px;width:100%;"><tr><td style="font-size:14px;color:#166534;"><strong>Status:</strong> Approved<br><strong>Verified on:</strong> {{verified_at}}</td></tr></table><p style="margin:0 0 8px;font-size:14px;color:#475569;">Thank you for helping us keep your account secure.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="margin:0;font-size:12px;color:#94a3b8;">Kang Open Banking — Compliance Team</p></td></tr></table></td></tr></table></body></html>',
  '["recipient_name","verified_at"]'::jsonb,
  true,
  true
),
(
  'kyc_rejected',
  'email',
  'security_alerts',
  'KYC Action Required',
  'Sent to the user when their KYC verification has been rejected with a reason.',
  'Action required: please resubmit your verification',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>KYC Action Required</title></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;"><tr><td><h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0f172a;">Verification not approved</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Hello {{recipient_name}},</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Unfortunately we were unable to approve your identity verification at this time. Please review the reason below and resubmit at your earliest convenience.</p><table cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;width:100%;"><tr><td style="font-size:14px;color:#991b1b;"><strong>Reason:</strong><br>{{rejection_reason}}</td></tr></table><p style="margin:0 0 16px;font-size:14px;color:#475569;">You can resubmit your verification at any time from your account. Make sure your documents are clear, valid, and the information matches your profile.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="margin:0;font-size:12px;color:#94a3b8;">Kang Open Banking — Compliance Team</p></td></tr></table></td></tr></table></body></html>',
  '["recipient_name","rejection_reason"]'::jsonb,
  true,
  true
),
(
  'kyc_info_requested',
  'email',
  'security_alerts',
  'KYC Additional Information Requested',
  'Sent to the user when a reviewer needs additional information or documents to complete KYC.',
  'Additional information needed for your verification',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>More Info Needed</title></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#1a1a1a;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;"><tr><td><h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#0f172a;">Additional information needed</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Hello {{recipient_name}},</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Our compliance team needs a little more information to complete your verification. Please review the notes below and update your submission.</p><table cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;width:100%;"><tr><td style="font-size:14px;color:#92400e;"><strong>What we need:</strong><br>{{info_request_notes}}</td></tr></table><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="margin:0;font-size:12px;color:#94a3b8;">Kang Open Banking — Compliance Team</p></td></tr></table></td></tr></table></body></html>',
  '["recipient_name","info_request_notes"]'::jsonb,
  true,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = now();
