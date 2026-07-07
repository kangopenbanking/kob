-- Giveting withdrawal fee configuration.
-- Stored in system_config so admins can tune it without a deploy.
-- Schema: { pct_bps: integer (basis points, e.g. 290 = 2.90%), fixed_minor_xaf: integer (minor XAF, e.g. 10000 = 100 XAF) }
INSERT INTO public.system_config (key, value, category, description, is_sensitive)
VALUES (
  'giveting.withdrawal_fee',
  '{"pct_bps": 290, "fixed_minor_xaf": 10000}'::jsonb,
  'giveting',
  'Withdrawal fee for Giveting fundraisers. pct_bps is basis points of the withdrawal amount; fixed_minor_xaf is a fixed fee in XAF minor units, converted to campaign currency at payout time.',
  false
)
ON CONFLICT (key) DO NOTHING;