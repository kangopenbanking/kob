-- Phase 6 Batch D — F4 data fix: standardize on 'approved' as the post-review terminal state
-- (matches gateway-merchant-keys, public-business-identity, developer-register-app, toggle-live-mode,
--  seed-e2e-users, OpenAPI spec, and BusinessAppManagement UI).
UPDATE public.gateway_merchants
SET kyb_status = 'approved',
    updated_at = now()
WHERE kyb_status = 'verified';