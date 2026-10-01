CREATE TYPE public.rapport_type AS ENUM ('intervention','visite_quotidienne','mensuel_preventif','personnalise');
CREATE TABLE public.rapports_generes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.rapport_type NOT NULL,
  titre text NOT NULL,
  filtres jsonb NOT NULL DEFAULT '{}'::jsonb,
  format text NOT NULL DEFAULT 'pdf',
  fichier_path text NOT NULL,
  etablissement_id uuid REFERENCES public.etablissements(id) ON DELETE SET NULL,
  equipement_id uuid REFERENCES public.equipements(id) ON DELETE SET NULL,
  periode_debut date,
  periode_fin date,
  genere_par uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.rapports_generes TO authenticated;
GRANT ALL ON public.rapports_generes TO service_role;
ALTER TABLE public.rapports_generes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rapports lecture" ON public.rapports_generes FOR SELECT TO authenticated
USING (genere_par = auth.uid() OR public.has_global_access(auth.uid())
  OR (etablissement_id IS NOT NULL AND public.user_in_etablissement(auth.uid(), etablissement_id)));
CREATE POLICY "rapports creation" ON public.rapports_generes FOR INSERT TO authenticated
WITH CHECK (genere_par = auth.uid());
CREATE POLICY "rapports suppression" ON public.rapports_generes FOR DELETE TO authenticated
USING (genere_par = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE INDEX ON public.rapports_generes (created_at DESC);

CREATE POLICY "rapports storage lecture" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rapports' AND (
  (storage.foldername(name))[1] = auth.uid()::text
  OR EXISTS (SELECT 1 FROM public.rapports_generes r WHERE r.fichier_path = storage.objects.name)));
CREATE POLICY "rapports storage ajout" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rapports' AND (storage.foldername(name))[1] = auth.uid()::text);