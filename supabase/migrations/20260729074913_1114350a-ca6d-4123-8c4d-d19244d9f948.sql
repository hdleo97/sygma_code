CREATE TYPE public.di_priorite AS ENUM ('faible','moyenne','haute','critique');
CREATE TYPE public.di_statut AS ENUM ('nouvelle','validee','affectee','en_cours','terminee','cloturee','refusee');

CREATE TABLE public.demandes_intervention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id uuid REFERENCES public.equipements(id) ON DELETE SET NULL,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  description text NOT NULL,
  priorite public.di_priorite NOT NULL DEFAULT 'moyenne',
  statut public.di_statut NOT NULL DEFAULT 'nouvelle',
  localisation text,
  demandeur_id uuid NOT NULL REFERENCES public.profils_utilisateurs(id) ON DELETE CASCADE,
  technicien_id uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  pieces_jointes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_di_etab ON public.demandes_intervention(etablissement_id);
CREATE INDEX idx_di_demandeur ON public.demandes_intervention(demandeur_id);
CREATE INDEX idx_di_technicien ON public.demandes_intervention(technicien_id);
CREATE INDEX idx_di_statut ON public.demandes_intervention(statut);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_intervention TO authenticated;
GRANT ALL ON public.demandes_intervention TO service_role;
ALTER TABLE public.demandes_intervention ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demandes_intervention_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demandes_intervention(id) ON DELETE CASCADE,
  user_id uuid,
  ancien_statut public.di_statut,
  nouveau_statut public.di_statut NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_di_hist_demande ON public.demandes_intervention_historique(demande_id);

GRANT SELECT ON public.demandes_intervention_historique TO authenticated;
GRANT ALL ON public.demandes_intervention_historique TO service_role;
ALTER TABLE public.demandes_intervention_historique ENABLE ROW LEVEL SECURITY;

-- Visibilité d'une demande
CREATE OR REPLACE FUNCTION public.can_view_demande(_user_id uuid, _demande_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demandes_intervention d
    WHERE d.id = _demande_id
      AND (
        d.demandeur_id = _user_id
        OR d.technicien_id = _user_id
        OR public.has_role(_user_id, 'super_admin')
        OR (public.has_role(_user_id, 'responsable_maintenance')
            AND public.user_in_etablissement(_user_id, d.etablissement_id))
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_demande(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_demande(uuid, uuid) TO authenticated, service_role;

-- Transitions autorisées
CREATE OR REPLACE FUNCTION public.di_transition_autorisee(_ancien public.di_statut, _nouveau public.di_statut)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _ancien = _nouveau THEN true
    WHEN _ancien = 'nouvelle'  AND _nouveau IN ('validee','refusee') THEN true
    WHEN _ancien = 'validee'   AND _nouveau IN ('affectee','refusee') THEN true
    WHEN _ancien = 'affectee'  AND _nouveau = 'en_cours' THEN true
    WHEN _ancien = 'en_cours'  AND _nouveau = 'terminee' THEN true
    WHEN _ancien = 'terminee'  AND _nouveau = 'cloturee' THEN true
    ELSE false
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.di_transition_autorisee(public.di_statut, public.di_statut) FROM anon;

CREATE OR REPLACE FUNCTION public.di_check_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF NOT public.di_transition_autorisee(OLD.statut, NEW.statut) THEN
      RAISE EXCEPTION 'Transition de statut non autorisée: % -> %', OLD.statut, NEW.statut;
    END IF;
    INSERT INTO public.demandes_intervention_historique (demande_id, user_id, ancien_statut, nouveau_statut)
    VALUES (NEW.id, auth.uid(), OLD.statut, NEW.statut);
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_di_transition
BEFORE UPDATE ON public.demandes_intervention
FOR EACH ROW EXECUTE FUNCTION public.di_check_transition();

CREATE OR REPLACE FUNCTION public.di_log_creation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.demandes_intervention_historique (demande_id, user_id, ancien_statut, nouveau_statut)
  VALUES (NEW.id, auth.uid(), NULL, NEW.statut);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_di_log_creation
AFTER INSERT ON public.demandes_intervention
FOR EACH ROW EXECUTE FUNCTION public.di_log_creation();

-- Policies demandes_intervention
CREATE POLICY di_select ON public.demandes_intervention
FOR SELECT TO authenticated
USING (
  demandeur_id = auth.uid()
  OR technicien_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'responsable_maintenance') AND user_in_etablissement(auth.uid(), etablissement_id))
);

CREATE POLICY di_insert ON public.demandes_intervention
FOR INSERT TO authenticated
WITH CHECK (
  demandeur_id = auth.uid()
  AND (has_role(auth.uid(), 'super_admin') OR user_in_etablissement(auth.uid(), etablissement_id))
);

CREATE POLICY di_update ON public.demandes_intervention
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'responsable_maintenance') AND user_in_etablissement(auth.uid(), etablissement_id))
  OR technicien_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'responsable_maintenance') AND user_in_etablissement(auth.uid(), etablissement_id))
  OR technicien_id = auth.uid()
);

CREATE POLICY di_delete ON public.demandes_intervention
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Policies historique
CREATE POLICY di_hist_select ON public.demandes_intervention_historique
FOR SELECT TO authenticated
USING (public.can_view_demande(auth.uid(), demande_id));

CREATE TRIGGER set_di_updated_at
BEFORE UPDATE ON public.demandes_intervention
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();