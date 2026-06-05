
REVOKE EXECUTE ON FUNCTION public.resolve_nium_routing(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_nium_routing(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.tg_nium_set_updated_at() FROM PUBLIC, anon;
