REVOKE EXECUTE ON FUNCTION public.reception_commande(uuid, uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_commande(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reception_commande(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_commande(uuid, uuid) TO authenticated;