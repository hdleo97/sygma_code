GRANT SELECT, INSERT, UPDATE, DELETE ON public.etablissements TO authenticated;
GRANT ALL ON public.etablissements TO service_role;

DROP POLICY IF EXISTS etab_insert ON public.etablissements;
CREATE POLICY etab_insert ON public.etablissements FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'responsable_maintenance'));

DROP POLICY IF EXISTS etab_update ON public.etablissements;
CREATE POLICY etab_update ON public.etablissements FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'responsable_maintenance')
  OR (public.has_role(auth.uid(), 'responsable_etablissement') AND public.user_in_etablissement(auth.uid(), id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'responsable_maintenance')
  OR (public.has_role(auth.uid(), 'responsable_etablissement') AND public.user_in_etablissement(auth.uid(), id))
);