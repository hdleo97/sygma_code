CREATE TYPE public.intervention_nature AS ENUM ('curative','preventive');
CREATE TYPE public.intervention_statut AS ENUM ('planifiee','en_cours','terminee','signee');

CREATE TABLE public.interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid REFERENCES public.demandes_intervention(id) ON DELETE SET NULL,
  equipement_id uuid REFERENCES public.equipements(id) ON DELETE SET NULL,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  description text NOT NULL,
  nature public.intervention_nature NOT NULL DEFAULT 'curative',
  statut public.intervention_statut NOT NULL DEFAULT 'planifiee',
  localisation text,
  date_appel timestamptz,
  date_planifiee timestamptz,
  duree_estimee_minutes integer,
  date_debut timestamptz,
  date_fin timestamptz,
  duree_minutes integer,
  cree_par uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interventions TO authenticated;
GRANT ALL ON public.interventions TO service_role;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.intervention_techniciens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  technicien_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intervention_id, technicien_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intervention_techniciens TO authenticated;
GRANT ALL ON public.intervention_techniciens TO service_role;
ALTER TABLE public.intervention_techniciens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_interventions_etab ON public.interventions(etablissement_id);
CREATE INDEX idx_interventions_equip ON public.interventions(equipement_id);
CREATE INDEX idx_interventions_demande ON public.interventions(demande_id);
CREATE INDEX idx_int_tech_intervention ON public.intervention_techniciens(intervention_id);
CREATE INDEX idx_int_tech_technicien ON public.intervention_techniciens(technicien_id);

CREATE OR REPLACE FUNCTION public.is_intervention_technicien(_user_id uuid, _intervention_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intervention_techniciens
    WHERE intervention_id = _intervention_id AND technicien_id = _user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_intervention_technicien(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_manage_intervention(_user_id uuid, _etab uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
     OR ((public.has_role(_user_id, 'responsable_maintenance')
          OR public.has_role(_user_id, 'responsable_etablissement'))
         AND public.user_in_etablissement(_user_id, _etab));
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_intervention(uuid, uuid) TO authenticated, service_role;

CREATE POLICY int_select ON public.interventions FOR SELECT TO authenticated
USING (
  public.can_manage_intervention(auth.uid(), etablissement_id)
  OR public.is_intervention_technicien(auth.uid(), id)
  OR cree_par = auth.uid()
  OR (demande_id IS NOT NULL AND public.can_view_demande(auth.uid(), demande_id))
);

CREATE POLICY int_insert ON public.interventions FOR INSERT TO authenticated
WITH CHECK (public.can_manage_intervention(auth.uid(), etablissement_id));

CREATE POLICY int_update ON public.interventions FOR UPDATE TO authenticated
USING (
  public.can_manage_intervention(auth.uid(), etablissement_id)
  OR public.is_intervention_technicien(auth.uid(), id)
)
WITH CHECK (
  public.can_manage_intervention(auth.uid(), etablissement_id)
  OR public.is_intervention_technicien(auth.uid(), id)
);

CREATE POLICY int_delete ON public.interventions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.intervention_etab(_intervention_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT etablissement_id FROM public.interventions WHERE id = _intervention_id;
$$;
GRANT EXECUTE ON FUNCTION public.intervention_etab(uuid) TO authenticated, service_role;

CREATE POLICY int_tech_select ON public.intervention_techniciens FOR SELECT TO authenticated
USING (
  technicien_id = auth.uid()
  OR public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id))
);

CREATE POLICY int_tech_manage ON public.intervention_techniciens FOR ALL TO authenticated
USING (public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id)))
WITH CHECK (public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id)));

CREATE OR REPLACE FUNCTION public.intervention_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.date_debut IS NOT NULL AND NEW.date_fin IS NOT NULL THEN
    IF NEW.date_fin < NEW.date_debut THEN
      RAISE EXCEPTION 'La date de fin doit être postérieure à la date de début';
    END IF;
    NEW.duree_minutes := GREATEST(0, (EXTRACT(EPOCH FROM (NEW.date_fin - NEW.date_debut)) / 60)::int);
  ELSE
    NEW.duree_minutes := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_intervention_before_write
BEFORE INSERT OR UPDATE ON public.interventions
FOR EACH ROW EXECUTE FUNCTION public.intervention_before_write();