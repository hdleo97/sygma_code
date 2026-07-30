ALTER TABLE public.intervention_techniciens
  ADD CONSTRAINT intervention_techniciens_technicien_id_fkey
  FOREIGN KEY (technicien_id) REFERENCES public.profils_utilisateurs(id) ON DELETE CASCADE;

REVOKE EXECUTE ON FUNCTION public.is_intervention_technicien(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_intervention(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.intervention_etab(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_intervention_technicien(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_intervention(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.intervention_etab(uuid) TO authenticated, service_role;