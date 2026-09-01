
ALTER TABLE public.profils_utilisateurs
  ADD COLUMN IF NOT EXISTS competences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS disponibilite text NOT NULL DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS superieur_id uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.prestataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale text NOT NULL,
  contact_nom text,
  contact_email text,
  contact_telephone text,
  specialite text,
  zone_intervention text,
  contrat_reference text,
  contrat_debut date,
  contrat_fin date,
  contrat_notes text,
  etablissement_id uuid REFERENCES public.etablissements(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestataires TO authenticated;
GRANT ALL ON public.prestataires TO service_role;

ALTER TABLE public.prestataires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prest_select" ON public.prestataires FOR SELECT TO authenticated
  USING (
    public.has_global_access(auth.uid())
    OR user_id = auth.uid()
    OR (etablissement_id IS NOT NULL AND public.user_in_etablissement(auth.uid(), etablissement_id))
  );

CREATE POLICY "prest_insert" ON public.prestataires FOR INSERT TO authenticated
  WITH CHECK (public.has_global_access(auth.uid()));

CREATE POLICY "prest_update" ON public.prestataires FOR UPDATE TO authenticated
  USING (public.has_global_access(auth.uid()))
  WITH CHECK (public.has_global_access(auth.uid()));

CREATE POLICY "prest_delete" ON public.prestataires FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_prestataires_updated_at
  BEFORE UPDATE ON public.prestataires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS prestataire_id uuid REFERENCES public.prestataires(id) ON DELETE SET NULL;

ALTER TABLE public.demandes_intervention
  ADD COLUMN IF NOT EXISTS prestataire_id uuid REFERENCES public.prestataires(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interventions_prestataire ON public.interventions(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_demandes_prestataire ON public.demandes_intervention(prestataire_id);

-- Un compte prestataire est traité comme un intervenant de l'intervention
CREATE OR REPLACE FUNCTION public.is_intervention_technicien(_user_id uuid, _intervention_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.intervention_techniciens
    WHERE intervention_id = _intervention_id AND technicien_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.interventions i
    JOIN public.prestataires p ON p.id = i.prestataire_id
    WHERE i.id = _intervention_id AND p.user_id = _user_id
  );
$function$;

-- Un compte prestataire peut consulter la DI qui lui est affectée
CREATE OR REPLACE FUNCTION public.can_view_demande(_user_id uuid, _demande_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.demandes_intervention d
    LEFT JOIN public.prestataires p ON p.id = d.prestataire_id
    WHERE d.id = _demande_id
      AND (
        d.demandeur_id = _user_id
        OR d.technicien_id = _user_id
        OR p.user_id = _user_id
        OR public.has_role(_user_id, 'super_admin')
        OR (public.has_role(_user_id, 'responsable_maintenance')
            AND public.user_in_etablissement(_user_id, d.etablissement_id))
      )
  );
$function$;

DROP POLICY IF EXISTS di_select ON public.demandes_intervention;
CREATE POLICY di_select ON public.demandes_intervention FOR SELECT TO authenticated
  USING (public.can_view_demande(auth.uid(), id));

DROP POLICY IF EXISTS etab_update ON public.etablissements;
CREATE POLICY etab_update ON public.etablissements FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'responsable_etablissement') AND public.user_in_etablissement(auth.uid(), id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'responsable_etablissement') AND public.user_in_etablissement(auth.uid(), id))
  );
