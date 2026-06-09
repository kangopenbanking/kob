-- Speed up the new Audit Log Explorer's quick-filter queries.
CREATE INDEX IF NOT EXISTS idx_audit_logs_kyc_hardening
  ON public.audit_logs (action_type, created_at DESC)
  WHERE action_type LIKE '%step_up_denied'
     OR action_type LIKE '%manual_review%'
     OR action_type LIKE 'youverify_webhook.%'
     OR action_type LIKE '%persist_yv_session%'
     OR action_type LIKE '%webhook_correlation%';
