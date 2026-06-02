
REVOKE EXECUTE ON FUNCTION public.dn_get_or_create_escrow_wallet(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dn_escrow_fund(uuid)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dn_escrow_release(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dn_escrow_refund(uuid)  FROM PUBLIC;
