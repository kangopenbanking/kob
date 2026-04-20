-- Enable Supabase Realtime for Merchant + Business PWA core tables.
-- Each ALTER is wrapped to ignore "already member" errors so the migration is idempotent.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'pos_orders',
    'gateway_charges',
    'gateway_refunds',
    'gateway_disputes',
    'gateway_merchant_wallets',
    'gateway_payouts',
    'pos_products',
    'pos_inventory_items',
    'pos_store_profiles',
    'pos_coupons',
    'pos_reviews',
    'merchant_staff_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN
        RAISE NOTICE 'Table public.% does not exist — skipping realtime add', t;
    END;
    -- Ensure full row payloads are emitted so update events carry old+new
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;