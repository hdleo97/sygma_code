-- Retired global configuration must not regain broad reads if grants change.
DROP POLICY IF EXISTS po_select ON public.parametres_organisation;

-- Connection diagnostics are available only to signed-in site members.
DROP POLICY IF EXISTS "Health check readable by everyone" ON public.health_check;
REVOKE ALL ON public.health_check FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.health_check FROM authenticated;
GRANT SELECT ON public.health_check TO authenticated;
GRANT ALL ON public.health_check TO service_role;
CREATE POLICY health_check_site_member_read ON public.health_check
FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.utilisateur_etablissements ue
    WHERE ue.user_id = (SELECT auth.uid())
      AND public.user_in_etablissement((SELECT auth.uid()), ue.etablissement_id)
  )
);

-- Updates are already denied; remove the retired rule entirely.
-- Photo replacement uploads a fresh object and changes the equipment's path.
DROP POLICY IF EXISTS equipements_photos_update ON storage.objects;
