-- Batch F: Revoke broad EXECUTE on all SECURITY DEFINER functions in public,
-- then explicitly re-grant only to functions called directly from the frontend.

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname, fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      fn.proname, fn.args
    );
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated for functions invoked from the frontend.
-- Use DO loops so we cover every overload of each name.
DO $$
DECLARE
  fname text;
  fn record;
  allowed text[] := ARRAY[
    'calculate_transaction_fee',
    'cleanup_security_capture_events',
    'encrypt_sandbox_credentials',
    'generate_compliance_report',
    'get_admin_qr_payments_audit',
    'get_dashboard_mismatches',
    'get_profile_phone',
    'get_staff_institution_id',
    'get_staff_portal_sections',
    'has_permission',
    'has_role',
    'increment_removal_count',
    'is_institution_owner',
    'is_institution_staff_admin',
    'log_audit_event',
    'lookup_recipient',
    'notification_delivery_kpis',
    'repair_user_routing',
    'report_missing_i18n_key',
    'resolve_statement_fee',
    'search_profiles_by_name'
  ];
BEGIN
  FOREACH fname IN ARRAY allowed LOOP
    FOR fn IN
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef = true
        AND p.proname = fname
    LOOP
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
        fn.proname, fn.args
      );
    END LOOP;
  END LOOP;
END $$;