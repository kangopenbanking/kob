CREATE TABLE IF NOT EXISTS public.webhook_replay_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL,
  provider text NOT NULL,
  event_id text,
  replayed_by uuid NOT NULL,
  signature_valid boolean,
  idempotent_skip boolean NOT NULL DEFAULT false,
  result_status integer,
  result_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_replay_audit_inbox ON public.webhook_replay_audit(inbox_id);
CREATE INDEX IF NOT EXISTS idx_webhook_replay_audit_created ON public.webhook_replay_audit(created_at DESC);

ALTER TABLE public.webhook_replay_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_replay_audit"
  ON public.webhook_replay_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins_insert_replay_audit"
  ON public.webhook_replay_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));