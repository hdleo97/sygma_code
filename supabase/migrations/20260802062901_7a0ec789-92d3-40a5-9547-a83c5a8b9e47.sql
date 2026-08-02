CREATE TABLE public.checklist_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase smallint NOT NULL CHECK (phase BETWEEN 1 AND 5),
  categorie_equipement text,
  libelle text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_operations TO authenticated;
GRANT ALL ON public.checklist_operations TO service_role;
ALTER TABLE public.checklist_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_select ON public.checklist_operations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_insert ON public.checklist_operations
  FOR INSERT TO authenticated WITH CHECK (public.has_global_access(auth.uid()));
CREATE POLICY checklist_update ON public.checklist_operations
  FOR UPDATE TO authenticated USING (public.has_global_access(auth.uid())) WITH CHECK (public.has_global_access(auth.uid()));
CREATE POLICY checklist_delete ON public.checklist_operations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER checklist_operations_updated_at BEFORE UPDATE ON public.checklist_operations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.rapport_operations_realisees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  phase smallint NOT NULL CHECK (phase BETWEEN 1 AND 5),
  operation_id uuid REFERENCES public.checklist_operations(id) ON DELETE SET NULL,
  libelle_libre text,
  commentaire text,
  realisee boolean NOT NULL DEFAULT true,
  cree_par uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rapport_op_source_chk CHECK (operation_id IS NOT NULL OR (libelle_libre IS NOT NULL AND length(btrim(libelle_libre)) > 0))
);

CREATE UNIQUE INDEX rapport_op_unique_std ON public.rapport_operations_realisees (intervention_id, operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX rapport_op_intervention_idx ON public.rapport_operations_realisees (intervention_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rapport_operations_realisees TO authenticated;
GRANT ALL ON public.rapport_operations_realisees TO service_role;
ALTER TABLE public.rapport_operations_realisees ENABLE ROW LEVEL SECURITY;

CREATE POLICY rapport_op_select ON public.rapport_operations_realisees
  FOR SELECT TO authenticated USING (
    public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id))
    OR public.is_intervention_technicien(auth.uid(), intervention_id)
  );
CREATE POLICY rapport_op_insert ON public.rapport_operations_realisees
  FOR INSERT TO authenticated WITH CHECK (
    public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id))
    OR public.is_intervention_technicien(auth.uid(), intervention_id)
  );
CREATE POLICY rapport_op_update ON public.rapport_operations_realisees
  FOR UPDATE TO authenticated USING (
    public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id))
    OR public.is_intervention_technicien(auth.uid(), intervention_id)
  ) WITH CHECK (
    public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id))
    OR public.is_intervention_technicien(auth.uid(), intervention_id)
  );
CREATE POLICY rapport_op_delete ON public.rapport_operations_realisees
  FOR DELETE TO authenticated USING (
    public.can_manage_intervention(auth.uid(), public.intervention_etab(intervention_id))
    OR public.is_intervention_technicien(auth.uid(), intervention_id)
  );

CREATE TRIGGER rapport_operations_updated_at BEFORE UPDATE ON public.rapport_operations_realisees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.checklist_operations (phase, categorie_equipement, libelle, ordre) VALUES
(1, NULL, 'Consignation électrique et mécanique', 10),
(1, NULL, 'Balisage et sécurisation de la zone', 20),
(1, NULL, 'Mise à disposition de l''outillage et des EPI', 30),
(2, NULL, 'Repérage et étiquetage des connexions', 10),
(2, NULL, 'Dépose des carters et protections', 20),
(2, NULL, 'Démontage du sous-ensemble défaillant', 30),
(3, NULL, 'Contrôle visuel des pièces d''usure', 10),
(3, NULL, 'Mesures et contrôles fonctionnels', 20),
(3, NULL, 'Remplacement des pièces défectueuses', 30),
(3, NULL, 'Nettoyage et lubrification', 40),
(4, NULL, 'Remontage du sous-ensemble', 10),
(4, NULL, 'Repose des carters et protections', 20),
(4, NULL, 'Reconnexion et contrôle du serrage', 30),
(5, NULL, 'Déconsignation et remise sous tension', 10),
(5, NULL, 'Réglages et paramétrage', 20),
(5, NULL, 'Essais de fonctionnement et validation', 30),
(5, NULL, 'Nettoyage du poste et remise en service', 40),
(1, 'rx', 'Vérification de l''absence de rayonnement (contrôle dosimètre)', 5),
(1, 'rx', 'Affichage de la signalisation zone contrôlée', 15),
(3, 'rx', 'Contrôle du tube et du collimateur', 25),
(3, 'rx', 'Vérification des sécurités et interlocks', 35),
(5, 'rx', 'Contrôle qualité image après intervention', 25),
(5, 'rx', 'Test de conformité radioprotection', 35);