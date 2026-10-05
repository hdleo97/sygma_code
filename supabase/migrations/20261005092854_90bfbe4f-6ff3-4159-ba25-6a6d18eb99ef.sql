
-- 1. Rôles par établissement
CREATE TABLE public.utilisateur_etablissement_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, etablissement_id, role)
);
GRANT SELECT ON public.utilisateur_etablissement_roles TO authenticated;
GRANT ALL ON public.utilisateur_etablissement_roles TO service_role;
ALTER TABLE public.utilisateur_etablissement_roles ENABLE ROW LEVEL SECURITY;

-- Rattacher super_admin / responsable_maintenance aux sites existants
INSERT INTO public.utilisateur_etablissements (user_id, etablissement_id)
SELECT DISTINCT ur.user_id, e.id FROM public.user_roles ur CROSS JOIN public.etablissements e
WHERE ur.role IN ('super_admin','responsable_maintenance')
ON CONFLICT DO NOTHING;

INSERT INTO public.utilisateur_etablissement_roles (user_id, etablissement_id, role)
SELECT ue.user_id, ue.etablissement_id, ur.role
FROM public.utilisateur_etablissements ue JOIN public.user_roles ur ON ur.user_id = ue.user_id
ON CONFLICT DO NOTHING;

-- 2. Fonctions d'isolation
CREATE OR REPLACE FUNCTION public.user_etablissements()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT etablissement_id FROM public.utilisateur_etablissements WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_any_role_in(_user_id uuid, _etab uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.utilisateur_etablissement_roles r
    JOIN public.utilisateur_etablissements ue ON ue.user_id = r.user_id AND ue.etablissement_id = r.etablissement_id
    WHERE r.user_id = _user_id AND r.etablissement_id = _etab AND r.role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_etablissement(_etab uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role_in(auth.uid(), _etab, ARRAY[_role]);
$$;

CREATE OR REPLACE FUNCTION public.shares_etablissement(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.utilisateur_etablissements x
    JOIN public.utilisateur_etablissements y ON y.etablissement_id = x.etablissement_id
    WHERE x.user_id = _a AND y.user_id = _b);
$$;

-- Plus aucun accès global aux données : uniquement les droits de configuration
CREATE OR REPLACE FUNCTION public.has_global_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'super_admin') OR public.has_role(_user_id,'responsable_maintenance');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_intervention(_user_id uuid, _etab uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role_in(_user_id, _etab,
    ARRAY['super_admin','responsable_maintenance','responsable_etablissement']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_stock(_user_id uuid, _etab uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role_in(_user_id, _etab,
    ARRAY['super_admin','responsable_maintenance','gestionnaire_stock','responsable_etablissement']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.can_view_demande(_user_id uuid, _demande_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demandes_intervention d
    LEFT JOIN public.prestataires p ON p.id = d.prestataire_id
    WHERE d.id = _demande_id
      AND ( (public.user_in_etablissement(_user_id, d.etablissement_id)
             AND (d.demandeur_id = _user_id OR d.technicien_id = _user_id
                  OR public.can_manage_intervention(_user_id, d.etablissement_id)))
            OR (p.user_id = _user_id AND p.etablissement_id = d.etablissement_id) ));
$$;

CREATE OR REPLACE FUNCTION public.can_view_visite(_user_id uuid, _visite_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.visites_quotidiennes v
    WHERE v.id = _visite_id AND public.user_in_etablissement(_user_id, v.etablissement_id));
$$;

-- 3. Pièces et prestataires rattachés à un site
ALTER TABLE public.pieces ADD COLUMN etablissement_id uuid REFERENCES public.etablissements(id);
UPDATE public.pieces SET etablissement_id = '59d92a74-bfcd-4904-8629-0224eb25a387' WHERE etablissement_id IS NULL;
ALTER TABLE public.pieces ALTER COLUMN etablissement_id SET NOT NULL;
ALTER TABLE public.pieces DROP CONSTRAINT pieces_code_article_key;
ALTER TABLE public.pieces ADD CONSTRAINT pieces_etab_code_key UNIQUE (etablissement_id, code_article);

UPDATE public.prestataires SET etablissement_id = '59d92a74-bfcd-4904-8629-0224eb25a387' WHERE etablissement_id IS NULL;
ALTER TABLE public.prestataires ALTER COLUMN etablissement_id SET NOT NULL;

ALTER VIEW public.v_stock_actuel SET (security_invoker = on);

-- 4. Policies réécrites
DROP POLICY IF EXISTS etab_insert ON public.etablissements;
DROP POLICY IF EXISTS etab_update ON public.etablissements;
DROP POLICY IF EXISTS etab_select ON public.etablissements;
CREATE POLICY etab_select ON public.etablissements FOR SELECT TO authenticated
  USING (public.user_in_etablissement(auth.uid(), id));
DROP POLICY IF EXISTS etablissements_update ON public.etablissements;
CREATE POLICY etablissements_update ON public.etablissements FOR UPDATE TO authenticated
  USING (public.has_role_in_etablissement(id,'super_admin')) WITH CHECK (public.has_role_in_etablissement(id,'super_admin'));
DROP POLICY IF EXISTS etab_delete ON public.etablissements;
CREATE POLICY etab_delete ON public.etablissements FOR DELETE TO authenticated
  USING (public.has_role_in_etablissement(id,'super_admin'));

CREATE OR REPLACE FUNCTION public.etab_attach_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.utilisateur_etablissements (user_id, etablissement_id) VALUES (auth.uid(), NEW.id) ON CONFLICT DO NOTHING;
    INSERT INTO public.utilisateur_etablissement_roles (user_id, etablissement_id, role) VALUES (auth.uid(), NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_etab_attach_creator AFTER INSERT ON public.etablissements FOR EACH ROW EXECUTE FUNCTION public.etab_attach_creator();

-- rattachements
DROP POLICY IF EXISTS ue_manage_admin ON public.utilisateur_etablissements;
DROP POLICY IF EXISTS ue_select ON public.utilisateur_etablissements;
CREATE POLICY ue_select ON public.utilisateur_etablissements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_intervention(auth.uid(), etablissement_id));
CREATE POLICY ue_manage_admin ON public.utilisateur_etablissements FOR ALL TO authenticated
  USING (public.has_role_in_etablissement(etablissement_id,'super_admin'))
  WITH CHECK (public.has_role_in_etablissement(etablissement_id,'super_admin'));
CREATE POLICY uer_select ON public.utilisateur_etablissement_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_intervention(auth.uid(), etablissement_id));

DROP POLICY IF EXISTS roles_select_self_or_admin ON public.user_roles;
CREATE POLICY roles_select_self_or_admin ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_etablissement(auth.uid(), user_id));

DROP POLICY IF EXISTS profil_select_self_or_global ON public.profils_utilisateurs;
CREATE POLICY profil_select_self_or_global ON public.profils_utilisateurs FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_etablissement(auth.uid(), id));

-- équipements
DROP POLICY IF EXISTS equip_select ON public.equipements;
DROP POLICY IF EXISTS equip_insert ON public.equipements;
DROP POLICY IF EXISTS equip_update ON public.equipements;
DROP POLICY IF EXISTS equip_delete ON public.equipements;
CREATE POLICY equip_select ON public.equipements FOR SELECT TO authenticated
  USING (public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY equip_insert ON public.equipements FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role_in(auth.uid(), etablissement_id, ARRAY['super_admin','responsable_maintenance','responsable_etablissement','technicien']::public.app_role[]));
CREATE POLICY equip_update ON public.equipements FOR UPDATE TO authenticated
  USING (public.has_any_role_in(auth.uid(), etablissement_id, ARRAY['super_admin','responsable_maintenance','responsable_etablissement','technicien']::public.app_role[]))
  WITH CHECK (public.has_any_role_in(auth.uid(), etablissement_id, ARRAY['super_admin','responsable_maintenance','responsable_etablissement','technicien']::public.app_role[]));
CREATE POLICY equip_delete ON public.equipements FOR DELETE TO authenticated
  USING (public.has_any_role_in(auth.uid(), etablissement_id, ARRAY['super_admin','responsable_maintenance']::public.app_role[]));

-- demandes d'intervention
DROP POLICY IF EXISTS di_insert ON public.demandes_intervention;
DROP POLICY IF EXISTS di_update ON public.demandes_intervention;
DROP POLICY IF EXISTS di_delete ON public.demandes_intervention;
CREATE POLICY di_insert ON public.demandes_intervention FOR INSERT TO authenticated
  WITH CHECK (demandeur_id = auth.uid() AND public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY di_update ON public.demandes_intervention FOR UPDATE TO authenticated
  USING (public.can_manage_intervention(auth.uid(), etablissement_id) OR (technicien_id = auth.uid() AND public.user_in_etablissement(auth.uid(), etablissement_id)))
  WITH CHECK (public.can_manage_intervention(auth.uid(), etablissement_id) OR (technicien_id = auth.uid() AND public.user_in_etablissement(auth.uid(), etablissement_id)));
CREATE POLICY di_delete ON public.demandes_intervention FOR DELETE TO authenticated
  USING (public.has_role_in_etablissement(etablissement_id,'super_admin'));

DROP POLICY IF EXISTS int_delete ON public.interventions;
CREATE POLICY int_delete ON public.interventions FOR DELETE TO authenticated
  USING (public.has_role_in_etablissement(etablissement_id,'super_admin'));

-- sorties
DROP POLICY IF EXISTS ds_insert ON public.demandes_sortie_pieces;
DROP POLICY IF EXISTS ds_delete ON public.demandes_sortie_pieces;
DROP POLICY IF EXISTS ds_select ON public.demandes_sortie_pieces;
CREATE POLICY ds_select ON public.demandes_sortie_pieces FOR SELECT TO authenticated
  USING ((technicien_id = auth.uid() AND public.user_in_etablissement(auth.uid(), etablissement_id)) OR public.can_manage_stock(auth.uid(), etablissement_id));
CREATE POLICY ds_insert ON public.demandes_sortie_pieces FOR INSERT TO authenticated
  WITH CHECK (technicien_id = auth.uid() AND public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY ds_delete ON public.demandes_sortie_pieces FOR DELETE TO authenticated
  USING (public.has_role_in_etablissement(etablissement_id,'super_admin') OR (technicien_id = auth.uid() AND statut = 'demande_creee'));

CREATE OR REPLACE FUNCTION public.can_view_demande_sortie(_user_id uuid, _demande_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.demandes_sortie_pieces d WHERE d.id = _demande_id
    AND ((d.technicien_id = _user_id AND public.user_in_etablissement(_user_id, d.etablissement_id))
         OR public.can_manage_stock(_user_id, d.etablissement_id)));
$$;

DROP POLICY IF EXISTS bs_delete ON public.bons_sortie;
CREATE POLICY bs_delete ON public.bons_sortie FOR DELETE TO authenticated
  USING (public.has_role_in_etablissement(etablissement_id,'super_admin'));

-- pièces
DROP POLICY IF EXISTS "Pieces: suppression par admin" ON public.pieces;
DROP POLICY IF EXISTS "Pieces: lecture pour les utilisateurs connectes" ON public.pieces;
DROP POLICY IF EXISTS "Pieces: creation par gestionnaires" ON public.pieces;
DROP POLICY IF EXISTS "Pieces: modification par gestionnaires" ON public.pieces;
CREATE POLICY pieces_select ON public.pieces FOR SELECT TO authenticated
  USING (public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY pieces_insert ON public.pieces FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_stock(auth.uid(), etablissement_id));
CREATE POLICY pieces_update ON public.pieces FOR UPDATE TO authenticated
  USING (public.can_manage_stock(auth.uid(), etablissement_id)) WITH CHECK (public.can_manage_stock(auth.uid(), etablissement_id));
CREATE POLICY pieces_delete ON public.pieces FOR DELETE TO authenticated
  USING (public.has_any_role_in(auth.uid(), etablissement_id, ARRAY['super_admin','responsable_maintenance']::public.app_role[]));

DROP POLICY IF EXISTS "Mouvements: suppression" ON public.stock_mouvements;
CREATE POLICY "Mouvements: suppression" ON public.stock_mouvements FOR DELETE TO authenticated
  USING (public.has_any_role_in(auth.uid(), public.magasin_etab(magasin_id), ARRAY['super_admin','responsable_maintenance']::public.app_role[]));

-- fiche de vie, plans, échéances, visites
DROP POLICY IF EXISTS "Lecture fiche de vie par etablissement" ON public.fiche_de_vie_evenements;
CREATE POLICY "Lecture fiche de vie par etablissement" ON public.fiche_de_vie_evenements FOR SELECT TO authenticated
  USING (public.user_in_etablissement(auth.uid(), etablissement_id));
DROP POLICY IF EXISTS plans_select ON public.plans_preventifs;
CREATE POLICY plans_select ON public.plans_preventifs FOR SELECT TO authenticated
  USING (public.user_in_etablissement(auth.uid(), etablissement_id));
DROP POLICY IF EXISTS echeances_select ON public.plan_echeances;
CREATE POLICY echeances_select ON public.plan_echeances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.plans_preventifs p WHERE p.id = plan_echeances.plan_id AND public.user_in_etablissement(auth.uid(), p.etablissement_id)));
DROP POLICY IF EXISTS visites_insert ON public.visites_quotidiennes;
DROP POLICY IF EXISTS visites_select ON public.visites_quotidiennes;
DROP POLICY IF EXISTS visites_update ON public.visites_quotidiennes;
CREATE POLICY visites_select ON public.visites_quotidiennes FOR SELECT TO authenticated
  USING (public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY visites_insert ON public.visites_quotidiennes FOR INSERT TO authenticated
  WITH CHECK (technicien_id = auth.uid() AND public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY visites_update ON public.visites_quotidiennes FOR UPDATE TO authenticated
  USING ((technicien_id = auth.uid() AND signature_at IS NULL AND public.user_in_etablissement(auth.uid(), etablissement_id)) OR public.can_manage_intervention(auth.uid(), etablissement_id))
  WITH CHECK ((technicien_id = auth.uid() AND public.user_in_etablissement(auth.uid(), etablissement_id)) OR public.can_manage_intervention(auth.uid(), etablissement_id));

-- prestataires
DROP POLICY IF EXISTS prest_select ON public.prestataires;
DROP POLICY IF EXISTS prest_insert ON public.prestataires;
DROP POLICY IF EXISTS prest_update ON public.prestataires;
DROP POLICY IF EXISTS prest_delete ON public.prestataires;
CREATE POLICY prest_select ON public.prestataires FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.user_in_etablissement(auth.uid(), etablissement_id));
CREATE POLICY prest_insert ON public.prestataires FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_intervention(auth.uid(), etablissement_id));
CREATE POLICY prest_update ON public.prestataires FOR UPDATE TO authenticated
  USING (public.can_manage_intervention(auth.uid(), etablissement_id)) WITH CHECK (public.can_manage_intervention(auth.uid(), etablissement_id));
CREATE POLICY prest_delete ON public.prestataires FOR DELETE TO authenticated
  USING (public.has_role_in_etablissement(etablissement_id,'super_admin'));

-- rapports générés
DROP POLICY IF EXISTS "rapports lecture" ON public.rapports_generes;
DROP POLICY IF EXISTS "rapports creation" ON public.rapports_generes;
DROP POLICY IF EXISTS "rapports suppression" ON public.rapports_generes;
CREATE POLICY "rapports lecture" ON public.rapports_generes FOR SELECT TO authenticated
  USING ((etablissement_id IS NOT NULL AND public.user_in_etablissement(auth.uid(), etablissement_id))
         OR (etablissement_id IS NULL AND genere_par = auth.uid()));
CREATE POLICY "rapports creation" ON public.rapports_generes FOR INSERT TO authenticated
  WITH CHECK (genere_par = auth.uid() AND (etablissement_id IS NULL OR public.user_in_etablissement(auth.uid(), etablissement_id)));
CREATE POLICY "rapports suppression" ON public.rapports_generes FOR DELETE TO authenticated
  USING (genere_par = auth.uid() OR (etablissement_id IS NOT NULL AND public.has_role_in_etablissement(etablissement_id,'super_admin')));

-- 5. Verrou : une ligne ne change jamais de site (hors transfert encadré)
CREATE OR REPLACE FUNCTION public.lock_etablissement_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.etablissement_id IS DISTINCT FROM OLD.etablissement_id
     AND coalesce(current_setting('sygma.transfert', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Changement d''établissement interdit (utilisez la procédure de transfert)';
  END IF;
  RETURN NEW;
END; $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['equipements','demandes_intervention','interventions','visites_quotidiennes','plans_preventifs',
    'magasins','pieces','commandes_achat','demandes_sortie_pieces','bons_sortie','fiche_de_vie_evenements','prestataires','rapports_generes']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_lock_etab BEFORE UPDATE OF etablissement_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.lock_etablissement_id()', t);
  END LOOP;
END $$;

-- 6. Affectations limitées au même site
CREATE OR REPLACE FUNCTION public.check_affectation_meme_site()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _etab uuid;
BEGIN
  IF TG_TABLE_NAME = 'intervention_techniciens' THEN
    _etab := public.intervention_etab(NEW.intervention_id);
    IF NOT public.user_in_etablissement(NEW.technicien_id, _etab) THEN
      RAISE EXCEPTION 'Ce technicien n''est pas rattaché à l''établissement de l''intervention';
    END IF;
  ELSE
    IF NEW.technicien_id IS NOT NULL AND NOT public.user_in_etablissement(NEW.technicien_id, NEW.etablissement_id) THEN
      RAISE EXCEPTION 'Ce technicien n''est pas rattaché à cet établissement';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('demandes_intervention','interventions') AND NEW.prestataire_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.prestataires p WHERE p.id = NEW.prestataire_id AND p.etablissement_id = NEW.etablissement_id) THEN
    RAISE EXCEPTION 'Ce prestataire n''est pas rattaché à cet établissement';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_affect_site BEFORE INSERT OR UPDATE ON public.intervention_techniciens FOR EACH ROW EXECUTE FUNCTION public.check_affectation_meme_site();
CREATE TRIGGER trg_affect_site BEFORE INSERT OR UPDATE OF technicien_id, prestataire_id ON public.demandes_intervention FOR EACH ROW EXECUTE FUNCTION public.check_affectation_meme_site();
CREATE TRIGGER trg_affect_site BEFORE INSERT OR UPDATE OF technicien_id ON public.demandes_sortie_pieces FOR EACH ROW EXECUTE FUNCTION public.check_affectation_meme_site();
CREATE TRIGGER trg_affect_site BEFORE INSERT OR UPDATE OF technicien_id ON public.visites_quotidiennes FOR EACH ROW EXECUTE FUNCTION public.check_affectation_meme_site();

CREATE TRIGGER audit_uer AFTER INSERT OR UPDATE OR DELETE ON public.utilisateur_etablissement_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit();
