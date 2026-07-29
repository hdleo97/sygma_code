GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_global_access(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_in_etablissement(uuid, uuid) TO authenticated, anon, service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profils_utilisateurs TO authenticated;
GRANT ALL ON public.profils_utilisateurs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utilisateur_etablissements TO authenticated;
GRANT ALL ON public.utilisateur_etablissements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etablissements TO authenticated;
GRANT ALL ON public.etablissements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipements TO authenticated;
GRANT ALL ON public.equipements TO service_role;