REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_global_access(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_in_etablissement(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_global_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_etablissement(uuid, uuid) TO authenticated, service_role;