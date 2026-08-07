-- Types
CREATE TYPE public.periodicite_type AS ENUM ('temps', 'compteur');

-- Documents équipement
ALTER TABLE public.equipements
  ADD COLUMN IF NOT EXISTS manuel_path text,
  ADD COLUMN IF NOT EXISTS gamme_path text;

-- Plans préventifs
CREATE TABLE public.plans_preventifs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  equipement_id uuid REFERENCES public.equipements(id) ON DELETE CASCADE,
  categorie_equipement text,
  libelle text NOT NULL,
  description text,
  periodicite periodicite_type NOT NULL DEFAULT 'temps',
  periodicite_valeur numeric NOT NULL CHECK (periodicite_valeur > 0),
  unite_compteur text,
  checklist_categorie text,
  duree_estimee_minutes integer,
  actif boolean NOT NULL DEFAULT true,
  date_debut date NOT NULL DEFAULT current_date,
  cree_par uuid REFERENCES public.profils_utilisateurs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_cible_chk CHECK (equipement_id IS NOT NULL OR categorie_equipement IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans_preventifs TO authenticated;
GRANT ALL ON public.plans_preventifs TO service_role;
ALTER TABLE public.plans_preventifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select" ON public.plans_preventifs FOR SELECT TO authenticated
USING (public.has_global_access(auth.uid()) OR public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY "plans_insert" ON public.plans_preventifs FOR INSERT TO authenticated
WITH CHECK (public.can_manage_intervention(auth.uid(), etablissement_id));
CREATE POLICY "plans_update" ON public.plans_preventifs FOR UPDATE TO authenticated
USING (public.can_manage_intervention(auth.uid(), etablissement_id))
WITH CHECK (public.can_manage_intervention(auth.uid(), etablissement_id));
CREATE POLICY "plans_delete" ON public.plans_preventifs FOR DELETE TO authenticated
USING (public.can_manage_intervention(auth.uid(), etablissement_id));

CREATE TRIGGER trg_plans_preventifs_updated_at BEFORE UPDATE ON public.plans_preventifs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Échéances par équipement
CREATE TABLE public.plan_echeances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans_preventifs(id) ON DELETE CASCADE,
  equipement_id uuid NOT NULL REFERENCES public.equipements(id) ON DELETE CASCADE,
  prochaine_echeance timestamptz,
  derniere_execution timestamptz,
  compteur_releve numeric NOT NULL DEFAULT 0,
  compteur_dernier_declenchement numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, equipement_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_echeances TO authenticated;
GRANT ALL ON public.plan_echeances TO service_role;
ALTER TABLE public.plan_echeances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "echeances_select" ON public.plan_echeances FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.plans_preventifs p WHERE p.id = plan_id
  AND (public.has_global_access(auth.uid()) OR public.user_in_etablissement(auth.uid(), p.etablissement_id))));
CREATE POLICY "echeances_insert" ON public.plan_echeances FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.plans_preventifs p WHERE p.id = plan_id
  AND public.can_manage_intervention(auth.uid(), p.etablissement_id)));
CREATE POLICY "echeances_update" ON public.plan_echeances FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.plans_preventifs p WHERE p.id = plan_id
  AND public.can_manage_intervention(auth.uid(), p.etablissement_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.plans_preventifs p WHERE p.id = plan_id
  AND public.can_manage_intervention(auth.uid(), p.etablissement_id)));
CREATE POLICY "echeances_delete" ON public.plan_echeances FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.plans_preventifs p WHERE p.id = plan_id
  AND public.can_manage_intervention(auth.uid(), p.etablissement_id)));

CREATE TRIGGER trg_plan_echeances_updated_at BEFORE UPDATE ON public.plan_echeances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Visites quotidiennes
CREATE TABLE public.visites_quotidiennes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipement_id uuid NOT NULL REFERENCES public.equipements(id) ON DELETE CASCADE,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  date_visite timestamptz NOT NULL DEFAULT now(),
  technicien_id uuid NOT NULL REFERENCES public.profils_utilisateurs(id),
  observations text,
  signature text,
  signature_nom text,
  signature_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visites_quotidiennes TO authenticated;
GRANT ALL ON public.visites_quotidiennes TO service_role;
ALTER TABLE public.visites_quotidiennes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visites_select" ON public.visites_quotidiennes FOR SELECT TO authenticated
USING (technicien_id = auth.uid() OR public.has_global_access(auth.uid())
  OR public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY "visites_insert" ON public.visites_quotidiennes FOR INSERT TO authenticated
WITH CHECK (technicien_id = auth.uid()
  AND (public.has_global_access(auth.uid()) OR public.user_in_etablissement(auth.uid(), etablissement_id)));
CREATE POLICY "visites_update" ON public.visites_quotidiennes FOR UPDATE TO authenticated
USING ((technicien_id = auth.uid() AND signature_at IS NULL)
  OR public.can_manage_intervention(auth.uid(), etablissement_id))
WITH CHECK ((technicien_id = auth.uid()) OR public.can_manage_intervention(auth.uid(), etablissement_id));
CREATE POLICY "visites_delete" ON public.visites_quotidiennes FOR DELETE TO authenticated
USING (public.can_manage_intervention(auth.uid(), etablissement_id));

CREATE TRIGGER trg_visites_updated_at BEFORE UPDATE ON public.visites_quotidiennes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.visites_quotidiennes_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visite_id uuid NOT NULL REFERENCES public.visites_quotidiennes(id) ON DELETE CASCADE,
  operation_id uuid REFERENCES public.checklist_operations(id) ON DELETE SET NULL,
  libelle_libre text,
  conforme boolean NOT NULL DEFAULT true,
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visites_quotidiennes_operations TO authenticated;
GRANT ALL ON public.visites_quotidiennes_operations TO service_role;
ALTER TABLE public.visites_quotidiennes_operations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_visite(_user_id uuid, _visite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.visites_quotidiennes v
    WHERE v.id = _visite_id
      AND ((v.technicien_id = _user_id AND v.signature_at IS NULL)
           OR public.can_manage_intervention(_user_id, v.etablissement_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_visite(_user_id uuid, _visite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.visites_quotidiennes v
    WHERE v.id = _visite_id
      AND (v.technicien_id = _user_id
           OR public.has_global_access(_user_id)
           OR public.user_in_etablissement(_user_id, v.etablissement_id))
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_visite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_visite(uuid, uuid) TO authenticated;

CREATE POLICY "visites_ops_select" ON public.visites_quotidiennes_operations FOR SELECT TO authenticated
USING (public.can_view_visite(auth.uid(), visite_id));
CREATE POLICY "visites_ops_insert" ON public.visites_quotidiennes_operations FOR INSERT TO authenticated
WITH CHECK (public.can_edit_visite(auth.uid(), visite_id));
CREATE POLICY "visites_ops_update" ON public.visites_quotidiennes_operations FOR UPDATE TO authenticated
USING (public.can_edit_visite(auth.uid(), visite_id))
WITH CHECK (public.can_edit_visite(auth.uid(), visite_id));
CREATE POLICY "visites_ops_delete" ON public.visites_quotidiennes_operations FOR DELETE TO authenticated
USING (public.can_edit_visite(auth.uid(), visite_id));

CREATE TRIGGER trg_visites_ops_updated_at BEFORE UPDATE ON public.visites_quotidiennes_operations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fiche de vie : accepter les visites quotidiennes
ALTER TABLE public.fiche_de_vie_evenements ALTER COLUMN intervention_id DROP NOT NULL;
ALTER TABLE public.fiche_de_vie_evenements ADD COLUMN IF NOT EXISTS visite_id uuid REFERENCES public.visites_quotidiennes(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS fiche_de_vie_visite_uidx ON public.fiche_de_vie_evenements(visite_id) WHERE visite_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.visite_log_fiche_de_vie()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tech text;
  _resume text;
BEGIN
  IF NEW.signature_at IS NOT NULL AND OLD.signature_at IS NULL THEN
    SELECT trim(coalesce(p.prenom,'') || ' ' || coalesce(p.nom,''))
      INTO _tech FROM public.profils_utilisateurs p WHERE p.id = NEW.technicien_id;

    SELECT string_agg(coalesce(co.libelle, o.libelle_libre)
             || CASE WHEN o.conforme THEN '' ELSE ' (non conforme)' END, ' ; ')
      INTO _resume
      FROM public.visites_quotidiennes_operations o
      LEFT JOIN public.checklist_operations co ON co.id = o.operation_id
     WHERE o.visite_id = NEW.id;

    INSERT INTO public.fiche_de_vie_evenements
      (equipement_id, visite_id, etablissement_id, date_evenement, nature, techniciens, resume, statut_final)
    VALUES (NEW.equipement_id, NEW.id, NEW.etablissement_id, NEW.date_visite, 'preventive',
      coalesce(_tech, NEW.signature_nom),
      'Visite quotidienne — ' || coalesce(_resume, 'aucun point de contrôle')
        || coalesce(' | Observations : ' || nullif(NEW.observations,''), ''),
      'signee')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_visite_log_fiche_de_vie AFTER UPDATE ON public.visites_quotidiennes
FOR EACH ROW EXECUTE FUNCTION public.visite_log_fiche_de_vie();

-- Génération automatique des interventions préventives
CREATE OR REPLACE FUNCTION public.generer_interventions_preventives()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p record;
  _e record;
  _ech record;
  _created integer := 0;
  _auteur uuid;
  _due boolean;
BEGIN
  FOR _p IN SELECT * FROM public.plans_preventifs WHERE actif LOOP
    _auteur := coalesce(_p.cree_par, (SELECT id FROM public.profils_utilisateurs LIMIT 1));
    IF _auteur IS NULL THEN CONTINUE; END IF;

    FOR _e IN
      SELECT eq.* FROM public.equipements eq
      WHERE eq.etablissement_id = _p.etablissement_id
        AND eq.statut <> 'reforme'
        AND ((_p.equipement_id IS NOT NULL AND eq.id = _p.equipement_id)
             OR (_p.equipement_id IS NULL AND eq.categorie = _p.categorie_equipement))
    LOOP
      INSERT INTO public.plan_echeances (plan_id, equipement_id, prochaine_echeance)
      VALUES (_p.id, _e.id,
        CASE WHEN _p.periodicite = 'temps' THEN _p.date_debut::timestamptz ELSE NULL END)
      ON CONFLICT (plan_id, equipement_id) DO NOTHING;

      SELECT * INTO _ech FROM public.plan_echeances
       WHERE plan_id = _p.id AND equipement_id = _e.id;

      IF _p.periodicite = 'temps' THEN
        _due := _ech.prochaine_echeance IS NOT NULL AND _ech.prochaine_echeance <= now();
      ELSE
        _due := (_ech.compteur_releve - _ech.compteur_dernier_declenchement) >= _p.periodicite_valeur;
      END IF;

      IF NOT _due THEN CONTINUE; END IF;

      -- Ne pas dupliquer si une préventive est déjà ouverte pour cet équipement
      IF EXISTS (
        SELECT 1 FROM public.interventions i
        WHERE i.equipement_id = _e.id AND i.nature = 'preventive'
          AND i.statut IN ('planifiee', 'en_cours')
      ) THEN CONTINUE; END IF;

      INSERT INTO public.interventions
        (equipement_id, etablissement_id, description, nature, statut,
         localisation, date_planifiee, duree_estimee_minutes, cree_par)
      VALUES (_e.id, _p.etablissement_id,
        _p.libelle || coalesce(' — ' || _p.description, ''),
        'preventive', 'planifiee', _e.zone,
        coalesce(_ech.prochaine_echeance, now()), _p.duree_estimee_minutes, _auteur);

      UPDATE public.plan_echeances
         SET derniere_execution = now(),
             prochaine_echeance = CASE WHEN _p.periodicite = 'temps'
               THEN greatest(coalesce(prochaine_echeance, now()), now()) + make_interval(days => _p.periodicite_valeur::int)
               ELSE NULL END,
             compteur_dernier_declenchement = CASE WHEN _p.periodicite = 'compteur'
               THEN compteur_releve ELSE compteur_dernier_declenchement END
       WHERE id = _ech.id;

      _created := _created + 1;
    END LOOP;
  END LOOP;

  RETURN _created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generer_interventions_preventives() TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
