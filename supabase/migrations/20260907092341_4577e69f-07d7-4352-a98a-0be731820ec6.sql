DROP POLICY IF EXISTS "etablissements_insert" ON public.etablissements;
DROP POLICY IF EXISTS "etablissements_update" ON public.etablissements;

CREATE POLICY "etablissements_insert" ON public.etablissements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "etablissements_update" ON public.etablissements
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));