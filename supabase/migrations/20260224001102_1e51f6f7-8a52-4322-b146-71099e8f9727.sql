
-- Add dispute email templates using 'payment_notifications' category
INSERT INTO public.communication_templates (template_key, template_type, category, name, description, subject, body, variables, is_active, is_system)
VALUES
  ('dispute_created', 'email', 'payment_notifications', 'Dispute Created', 'Sent when a new dispute is opened against a merchant', 
   'New Dispute Opened - {{dispute_ref}}',
   '<h2>A new dispute has been opened</h2><p>Dear {{merchant_name}},</p><p>A dispute has been filed against your account for a charge of <strong>{{amount}} {{currency}}</strong>.</p><p><strong>Dispute Reference:</strong> {{dispute_ref}}<br/><strong>Reason:</strong> {{reason}}<br/><strong>Evidence Due By:</strong> {{evidence_due_by}}</p><p>Please log in to your merchant dashboard to review the dispute and submit evidence before the deadline.</p><p>Regards,<br/>Kang Open Banking Team</p>',
   '["merchant_name","dispute_ref","amount","currency","reason","evidence_due_by"]'::jsonb, true, true),

  ('dispute_evidence_submitted', 'email', 'payment_notifications', 'Dispute Evidence Submitted', 'Sent when merchant submits evidence for a dispute',
   'Evidence Submitted for Dispute {{dispute_ref}}',
   '<h2>Evidence Received</h2><p>Dear {{merchant_name}},</p><p>We have received your evidence submission for dispute <strong>{{dispute_ref}}</strong>.</p><p>Your dispute is now under review. We will notify you once a decision has been made.</p><p>Regards,<br/>Kang Open Banking Team</p>',
   '["merchant_name","dispute_ref"]'::jsonb, true, true),

  ('dispute_resolved', 'email', 'payment_notifications', 'Dispute Resolved', 'Sent when a dispute is resolved (won/lost)',
   'Dispute {{dispute_ref}} - {{outcome}}',
   '<h2>Dispute Resolution</h2><p>Dear {{merchant_name}},</p><p>Your dispute <strong>{{dispute_ref}}</strong> for <strong>{{amount}} {{currency}}</strong> has been resolved.</p><p><strong>Outcome:</strong> {{outcome}}<br/><strong>Resolution Notes:</strong> {{resolution_notes}}</p><p>Regards,<br/>Kang Open Banking Team</p>',
   '["merchant_name","dispute_ref","amount","currency","outcome","resolution_notes"]'::jsonb, true, true),

  ('dispute_admin_alert', 'email', 'system_notifications', 'Admin Dispute Alert', 'Notifies admins of new disputes requiring attention',
   '[Action Required] New Dispute - {{dispute_ref}}',
   '<h2>New Dispute Requires Review</h2><p>A new gateway dispute has been filed:</p><p><strong>Merchant:</strong> {{merchant_name}}<br/><strong>Dispute Ref:</strong> {{dispute_ref}}<br/><strong>Amount:</strong> {{amount}} {{currency}}<br/><strong>Reason:</strong> {{reason}}<br/><strong>Provider:</strong> {{provider}}</p><p>Please review this dispute in the admin dashboard.</p>',
   '["merchant_name","dispute_ref","amount","currency","reason","provider"]'::jsonb, true, true)
ON CONFLICT (template_key) DO NOTHING;
