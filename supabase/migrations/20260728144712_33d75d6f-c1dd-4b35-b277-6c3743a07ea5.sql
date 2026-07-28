CREATE TYPE public.equipement_statut AS ENUM ('en_service','en_panne','en_maintenance','hors_service','reforme');

CREATE TABLE public.equipements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  designation text NOT NULL,
  categorie text,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  zone text,
  marque text,
  modele text,
  numero_serie text,
  date_mise_en_service date,
  fournisseur text,
  statut public.equipement_statut NOT NULL DEFAULT 'en_service',
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (etablissement_id, reference)
);

CREATE INDEX equipements_etab_idx ON public.equipements(etablissement_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipements TO authenticated;
GRANT ALL ON public.equipements TO service_role;

ALTER TABLE public.equipements ENABLE ROW LEVEL SECURITY;

CREATE POLICY equip_select ON public.equipements FOR SELECT TO authenticated
USING (public.has_global_access(auth.uid()) OR public.user_in_etablissement(auth.uid(), etablissement_id));

CREATE POLICY equip_insert ON public.equipements FOR INSERT TO authenticated
WITH CHECK (
  public.has_global_access(auth.uid())
  OR ((public.has_role(auth.uid(),'responsable_etablissement') OR public.has_role(auth.uid(),'technicien'))
      AND public.user_in_etablissement(auth.uid(), etablissement_id))
);

CREATE POLICY equip_update ON public.equipements FOR UPDATE TO authenticated
USING (
  public.has_global_access(auth.uid())
  OR ((public.has_role(auth.uid(),'responsable_etablissement') OR public.has_role(auth.uid(),'technicien'))
      AND public.user_in_etablissement(auth.uid(), etablissement_id))
)
WITH CHECK (
  public.has_global_access(auth.uid())
  OR ((public.has_role(auth.uid(),'responsable_etablissement') OR public.has_role(auth.uid(),'technicien'))
      AND public.user_in_etablissement(auth.uid(), etablissement_id))
);

CREATE POLICY equip_delete ON public.equipements FOR DELETE TO authenticated
USING (public.has_global_access(auth.uid()));

CREATE TRIGGER equipements_set_updated_at BEFORE UPDATE ON public.equipements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();