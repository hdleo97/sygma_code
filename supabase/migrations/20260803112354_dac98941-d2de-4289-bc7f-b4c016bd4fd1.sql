CREATE TABLE public.fiche_de_vie_evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id uuid REFERENCES public.equipements(id) ON DELETE CASCADE,
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  date_evenement timestamptz NOT NULL DEFAULT now(),
  nature intervention_nature NOT NULL,
  techniciens text,
  resume text,
  statut_final intervention_statut NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intervention_id)
);

GRANT SELECT ON public.fiche_de_vie_evenements TO authenticated;
GRANT ALL ON public.fiche_de_vie_evenements TO service_role;

ALTER TABLE public.fiche_de_vie_evenements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture fiche de vie par etablissement"
ON public.fiche_de_vie_evenements FOR SELECT TO authenticated
USING (
  public.has_global_access(auth.uid())
  OR public.user_in_etablissement(auth.uid(), etablissement_id)
);

CREATE TRIGGER fiche_de_vie_updated_at
BEFORE UPDATE ON public.fiche_de_vie_evenements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_fdv_equipement ON public.fiche_de_vie_evenements (equipement_id, date_evenement DESC);

CREATE OR REPLACE FUNCTION public.intervention_log_fiche_de_vie()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _techs text;
  _resume text;
BEGIN
  IF NEW.statut = 'signee' AND (OLD.statut IS DISTINCT FROM 'signee') THEN
    SELECT string_agg(trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,'')), ', ')
      INTO _techs
      FROM public.intervention_techniciens it
      JOIN public.profils_utilisateurs p ON p.id = it.technicien_id
     WHERE it.intervention_id = NEW.id;

    SELECT string_agg(x.libelle, ' ; ')
      INTO _resume
      FROM (
        SELECT coalesce(co.libelle, r.libelle_libre) AS libelle
          FROM public.rapport_operations_realisees r
          LEFT JOIN public.checklist_operations co ON co.id = r.operation_id
         WHERE r.intervention_id = NEW.id
         ORDER BY r.phase, r.created_at
      ) x;

    INSERT INTO public.fiche_de_vie_evenements
      (equipement_id, intervention_id, etablissement_id, date_evenement, nature, techniciens, resume, statut_final)
    VALUES (
      NEW.equipement_id, NEW.id, NEW.etablissement_id,
      coalesce(NEW.date_fin, NEW.date_debut, now()),
      NEW.nature, _techs, coalesce(_resume, NEW.description), NEW.statut
    )
    ON CONFLICT (intervention_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_intervention_log_fiche_de_vie
AFTER UPDATE ON public.interventions
FOR EACH ROW EXECUTE FUNCTION public.intervention_log_fiche_de_vie();