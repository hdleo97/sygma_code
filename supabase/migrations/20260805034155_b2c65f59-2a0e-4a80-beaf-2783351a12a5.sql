CREATE TYPE public.ds_statut AS ENUM ('demande_creee','validee','traitee','refusee');

CREATE TABLE public.demandes_sortie_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  technicien_id uuid NOT NULL REFERENCES public.profils_utilisateurs(id) ON DELETE CASCADE,
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL,
  equipement_id uuid REFERENCES public.equipements(id) ON DELETE SET NULL,
  justification text,
  urgence public.di_priorite NOT NULL DEFAULT 'moyenne',
  statut public.ds_statut NOT NULL DEFAULT 'demande_creee',
  valide_par uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  valide_at timestamptz,
  traite_par uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  traite_at timestamptz,
  motif_refus text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_sortie_pieces TO authenticated;
GRANT ALL ON public.demandes_sortie_pieces TO service_role;
ALTER TABLE public.demandes_sortie_pieces ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demandes_sortie_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demandes_sortie_pieces(id) ON DELETE CASCADE,
  piece_id uuid NOT NULL REFERENCES public.pieces(id) ON DELETE RESTRICT,
  quantite_demandee numeric NOT NULL CHECK (quantite_demandee > 0),
  quantite_sortie numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandes_sortie_lignes TO authenticated;
GRANT ALL ON public.demandes_sortie_lignes TO service_role;
ALTER TABLE public.demandes_sortie_lignes ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE public.bons_sortie_numero_seq;
GRANT USAGE, SELECT ON SEQUENCE public.bons_sortie_numero_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bons_sortie_numero_seq TO service_role;

CREATE TABLE public.bons_sortie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL UNIQUE DEFAULT nextval('public.bons_sortie_numero_seq'),
  demande_id uuid NOT NULL UNIQUE REFERENCES public.demandes_sortie_pieces(id) ON DELETE CASCADE,
  magasin_id uuid NOT NULL REFERENCES public.magasins(id) ON DELETE RESTRICT,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  intervention_id uuid REFERENCES public.interventions(id) ON DELETE SET NULL,
  date_sortie timestamptz NOT NULL DEFAULT now(),
  cree_par uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bons_sortie TO authenticated;
GRANT ALL ON public.bons_sortie TO service_role;
ALTER TABLE public.bons_sortie ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_demande_sortie(_user_id uuid, _demande_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demandes_sortie_pieces d
    WHERE d.id = _demande_id
      AND (d.technicien_id = _user_id
           OR public.can_manage_stock(_user_id, d.etablissement_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_demande_sortie(_user_id uuid, _demande_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demandes_sortie_pieces d
    WHERE d.id = _demande_id
      AND public.can_manage_stock(_user_id, d.etablissement_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demande_sortie_is_owner_editable(_user_id uuid, _demande_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demandes_sortie_pieces d
    WHERE d.id = _demande_id
      AND d.technicien_id = _user_id
      AND d.statut = 'demande_creee'
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_demande_sortie(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_demande_sortie(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demande_sortie_is_owner_editable(uuid, uuid) TO authenticated;

CREATE POLICY "ds_select" ON public.demandes_sortie_pieces FOR SELECT TO authenticated
USING (technicien_id = auth.uid() OR public.can_manage_stock(auth.uid(), etablissement_id));

CREATE POLICY "ds_insert" ON public.demandes_sortie_pieces FOR INSERT TO authenticated
WITH CHECK (technicien_id = auth.uid()
  AND (public.has_global_access(auth.uid()) OR public.user_in_etablissement(auth.uid(), etablissement_id)));

CREATE POLICY "ds_update" ON public.demandes_sortie_pieces FOR UPDATE TO authenticated
USING (public.can_manage_stock(auth.uid(), etablissement_id)
       OR (technicien_id = auth.uid() AND statut = 'demande_creee'))
WITH CHECK (public.can_manage_stock(auth.uid(), etablissement_id) OR technicien_id = auth.uid());

CREATE POLICY "ds_delete" ON public.demandes_sortie_pieces FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin')
       OR (technicien_id = auth.uid() AND statut = 'demande_creee'));

CREATE POLICY "dsl_select" ON public.demandes_sortie_lignes FOR SELECT TO authenticated
USING (public.can_view_demande_sortie(auth.uid(), demande_id));

CREATE POLICY "dsl_insert" ON public.demandes_sortie_lignes FOR INSERT TO authenticated
WITH CHECK (public.demande_sortie_is_owner_editable(auth.uid(), demande_id)
            OR public.can_manage_demande_sortie(auth.uid(), demande_id));

CREATE POLICY "dsl_update" ON public.demandes_sortie_lignes FOR UPDATE TO authenticated
USING (public.demande_sortie_is_owner_editable(auth.uid(), demande_id)
       OR public.can_manage_demande_sortie(auth.uid(), demande_id))
WITH CHECK (public.demande_sortie_is_owner_editable(auth.uid(), demande_id)
            OR public.can_manage_demande_sortie(auth.uid(), demande_id));

CREATE POLICY "dsl_delete" ON public.demandes_sortie_lignes FOR DELETE TO authenticated
USING (public.demande_sortie_is_owner_editable(auth.uid(), demande_id)
       OR public.can_manage_demande_sortie(auth.uid(), demande_id));

CREATE POLICY "bs_select" ON public.bons_sortie FOR SELECT TO authenticated
USING (public.can_view_demande_sortie(auth.uid(), demande_id));

CREATE POLICY "bs_insert" ON public.bons_sortie FOR INSERT TO authenticated
WITH CHECK (public.can_manage_stock(auth.uid(), etablissement_id));

CREATE POLICY "bs_update" ON public.bons_sortie FOR UPDATE TO authenticated
USING (public.can_manage_stock(auth.uid(), etablissement_id))
WITH CHECK (public.can_manage_stock(auth.uid(), etablissement_id));

CREATE POLICY "bs_delete" ON public.bons_sortie FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.ds_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF NEW.statut = 'validee' THEN
      NEW.valide_par := auth.uid();
      NEW.valide_at := now();
    ELSIF NEW.statut = 'traitee' THEN
      NEW.traite_par := auth.uid();
      NEW.traite_at := now();
    ELSIF NEW.statut = 'refusee' THEN
      NEW.valide_par := auth.uid();
      NEW.valide_at := now();
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ds_before_update BEFORE UPDATE ON public.demandes_sortie_pieces
FOR EACH ROW EXECUTE FUNCTION public.ds_before_update();

CREATE TRIGGER trg_dsl_updated_at BEFORE UPDATE ON public.demandes_sortie_lignes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bs_updated_at BEFORE UPDATE ON public.bons_sortie
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();