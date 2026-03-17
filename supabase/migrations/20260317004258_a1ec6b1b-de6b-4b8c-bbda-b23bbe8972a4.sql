-- Backfill Agogoo's KYB document URLs from storage into metadata
UPDATE gateway_merchants
SET metadata = jsonb_set(
  metadata::jsonb,
  '{kyb_submission}',
  (metadata::jsonb->'kyb_submission') ||
  '{"registration_certificate_url": "59eacf4d-e518-4c92-a150-f2486c78b842/kyb/registration_certificate_1773599338904.jpeg", "proof_of_address_url": "59eacf4d-e518-4c92-a150-f2486c78b842/kyb/proof_of_address_1773599363207.jpeg"}'::jsonb
)
WHERE id = '88895bcd-d5a7-4b1e-a741-9f0be6902fe6';