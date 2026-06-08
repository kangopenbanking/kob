
INSERT INTO public.managed_email_types
  (email_key, category, name, description, default_subject, default_body_html, available_variables, trigger_event, is_system, is_active, sort_order)
VALUES
(
  'nium_name_correction_submitted',
  'compliance',
  'Name Correction — Submitted',
  'Sent to the customer when a beneficiary name correction request is received and queued for compliance review.',
  'Name correction request received — ref {{request_id_short}}',
  '<p>Dear {{customer_name}},</p>'
  '<p>We received your beneficiary name correction request and your documents are now under compliance review.</p>'
  '<p><strong>Request reference:</strong> {{request_id}}<br>'
  '<strong>Submitted at:</strong> {{submitted_at}}<br>'
  '<strong>Current name on file:</strong> {{current_full_name}}<br>'
  '<strong>Requested name:</strong> {{requested_full_name}}<br>'
  '<strong>Document type:</strong> {{document_type}}<br>'
  '<strong>Institution:</strong> {{institution_name}}</p>'
  '<p>You will receive another email as soon as a decision is made. No further action is required from you right now.</p>'
  '<p>If you did not initiate this request, please contact support immediately and reference <strong>{{request_id_short}}</strong>.</p>',
  '["customer_name","request_id","request_id_short","submitted_at","current_full_name","requested_full_name","document_type","institution_name"]'::jsonb,
  'nium.name_correction.submitted',
  true, true, 500
),
(
  'nium_name_correction_approved',
  'compliance',
  'Name Correction — Approved',
  'Sent to the customer after both compliance maker and admin checker approve the name correction; profile name updated and affected global accounts marked for re-issue.',
  'Name correction approved — ref {{request_id_short}}',
  '<p>Dear {{customer_name}},</p>'
  '<p>Your beneficiary name correction request has been <strong>approved</strong>.</p>'
  '<p><strong>Request reference:</strong> {{request_id}}<br>'
  '<strong>Submitted at:</strong> {{submitted_at}}<br>'
  '<strong>Maker (proposed):</strong> {{maker_name}} at {{maker_at}}<br>'
  '<strong>Checker (approved):</strong> {{checker_name}} at {{reviewed_at}}<br>'
  '<strong>Institution:</strong> {{institution_name}}<br>'
  '<strong>Previous name:</strong> {{previous_full_name}}<br>'
  '<strong>New verified name:</strong> {{new_full_name}}</p>'
  '<p>{{closed_accounts_note}}</p>'
  '<p>Any future global receiving accounts will be issued in your new verified name.</p>',
  '["customer_name","request_id","request_id_short","submitted_at","maker_name","maker_at","checker_name","reviewed_at","institution_name","previous_full_name","new_full_name","closed_accounts_note","closed_account_count"]'::jsonb,
  'nium.name_correction.approved',
  true, true, 501
),
(
  'nium_name_correction_rejected',
  'compliance',
  'Name Correction — Rejected',
  'Sent to the customer when the admin checker rejects the name correction request.',
  'Name correction rejected — ref {{request_id_short}}',
  '<p>Dear {{customer_name}},</p>'
  '<p>After compliance review, your beneficiary name correction request was <strong>not approved</strong>.</p>'
  '<p><strong>Request reference:</strong> {{request_id}}<br>'
  '<strong>Submitted at:</strong> {{submitted_at}}<br>'
  '<strong>Maker (proposed):</strong> {{maker_name}} at {{maker_at}}<br>'
  '<strong>Checker (rejected):</strong> {{checker_name}} at {{reviewed_at}}<br>'
  '<strong>Institution:</strong> {{institution_name}}<br>'
  '<strong>Requested name:</strong> {{requested_full_name}}</p>'
  '<p><strong>Reviewer note:</strong> {{decision_note}}</p>'
  '<p>You can submit a new request with clearer government-issued documents at any time from your Global Accounts page.</p>',
  '["customer_name","request_id","request_id_short","submitted_at","maker_name","maker_at","checker_name","reviewed_at","institution_name","requested_full_name","decision_note"]'::jsonb,
  'nium.name_correction.rejected',
  true, true, 502
)
ON CONFLICT (email_key) DO UPDATE SET
  default_subject = EXCLUDED.default_subject,
  default_body_html = EXCLUDED.default_body_html,
  available_variables = EXCLUDED.available_variables,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();
