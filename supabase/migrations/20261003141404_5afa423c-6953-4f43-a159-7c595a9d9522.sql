CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select_super ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rec jsonb; _id text;
BEGIN
  _rec := to_jsonb(COALESCE(NEW, OLD));
  _id := COALESCE(_rec->>'id', '');
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, _id,
    jsonb_build_object('avant', CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
                       'apres', CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END));
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.referentiels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('categorie_equipement','zone')),
  libelle text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, libelle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referentiels TO authenticated;
GRANT ALL ON public.referentiels TO service_role;
ALTER TABLE public.referentiels ENABLE ROW LEVEL SECURITY;
CREATE POLICY ref_select ON public.referentiels FOR SELECT TO authenticated USING (true);
CREATE POLICY ref_write ON public.referentiels FOR ALL TO authenticated
  USING (public.has_global_access(auth.uid())) WITH CHECK (public.has_global_access(auth.uid()));
CREATE TRIGGER trg_ref_updated BEFORE UPDATE ON public.referentiels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.referentiels (type, libelle)
  SELECT DISTINCT 'categorie_equipement', categorie FROM public.equipements WHERE categorie IS NOT NULL AND categorie <> ''
  ON CONFLICT DO NOTHING;
INSERT INTO public.referentiels (type, libelle)
  SELECT DISTINCT 'zone', zone FROM public.equipements WHERE zone IS NOT NULL AND zone <> ''
  ON CONFLICT DO NOTHING;

CREATE TABLE public.libelles_statuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domaine text NOT NULL,
  code text NOT NULL,
  libelle text NOT NULL,
  couleur text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domaine, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libelles_statuts TO authenticated;
GRANT ALL ON public.libelles_statuts TO service_role;
ALTER TABLE public.libelles_statuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ls_select ON public.libelles_statuts FOR SELECT TO authenticated USING (true);
CREATE POLICY ls_write ON public.libelles_statuts FOR ALL TO authenticated
  USING (public.has_global_access(auth.uid())) WITH CHECK (public.has_global_access(auth.uid()));
CREATE TRIGGER trg_ls_updated BEFORE UPDATE ON public.libelles_statuts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.libelles_statuts (domaine, code, libelle, couleur) VALUES
 ('di_priorite','faible','Faible','#64748b'),('di_priorite','moyenne','Moyenne','#2563eb'),
 ('di_priorite','haute','Haute','#ea580c'),('di_priorite','critique','Critique','#dc2626'),
 ('di_statut','nouvelle','Nouvelle','#2563eb'),('di_statut','validee','Validée','#0891b2'),
 ('di_statut','affectee','Affectée','#7c3aed'),('di_statut','en_cours','En cours','#ea580c'),
 ('di_statut','terminee','Terminée','#16a34a'),('di_statut','cloturee','Clôturée','#475569'),
 ('di_statut','refusee','Refusée','#dc2626'),
 ('intervention_statut','planifiee','Planifiée','#2563eb'),('intervention_statut','en_cours','En cours','#ea580c'),
 ('intervention_statut','terminee','Terminée','#16a34a'),('intervention_statut','signee','Signée','#475569'),
 ('equipement_statut','en_service','En service','#16a34a'),('equipement_statut','en_panne','En panne','#dc2626'),
 ('equipement_statut','en_maintenance','En maintenance','#ea580c'),('equipement_statut','hors_service','Hors service','#475569'),
 ('equipement_statut','reforme','Réformé','#94a3b8');

CREATE TABLE public.parametres_notifications (
  evenement text PRIMARY KEY,
  libelle text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  destinataires text NOT NULL DEFAULT '',
  sujet text NOT NULL DEFAULT '',
  contenu text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.parametres_notifications TO authenticated;
GRANT ALL ON public.parametres_notifications TO service_role;
ALTER TABLE public.parametres_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY pn_select ON public.parametres_notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY pn_update ON public.parametres_notifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_pn_updated BEFORE UPDATE ON public.parametres_notifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.parametres_notifications (evenement, libelle, destinataires, sujet, contenu) VALUES
 ('di_creation','Création d''une demande d''intervention','responsable_maintenance','Nouvelle demande d''intervention','Une nouvelle demande a été créée : {{description}}'),
 ('di_statut','Changement de statut d''une DI','demandeur','Votre demande a changé de statut','Nouveau statut : {{statut}}'),
 ('intervention_affectation','Affectation d''une intervention','technicien','Nouvelle intervention affectée','Une intervention vous a été affectée : {{description}}'),
 ('rapport_signe','Signature d''un rapport','superieur, demandeur','Rapport d''intervention signé','Le rapport de l''intervention {{description}} a été signé.'),
 ('preventif_echeance','Échéance préventive proche ou dépassée','responsable_maintenance','Échéance préventive','L''échéance du plan {{plan}} approche.'),
 ('stock_seuil','Franchissement d''un seuil de stock','gestionnaire_stock','Stock sous le seuil','La pièce {{piece}} est sous le seuil d''alerte.'),
 ('commande_statut','Changement de statut d''une commande','gestionnaire_stock','Commande mise à jour','Commande n°{{numero}} : {{statut}}'),
 ('utilisateur','Création d''utilisateur / réinitialisation','utilisateur','Votre compte SYGMA','Votre compte a été créé ou votre mot de passe réinitialisé.');

CREATE TABLE public.parametres_organisation (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nom_organisation text NOT NULL DEFAULT 'SYGMA',
  logo_path text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.parametres_organisation TO authenticated;
GRANT ALL ON public.parametres_organisation TO service_role;
ALTER TABLE public.parametres_organisation ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_select ON public.parametres_organisation FOR SELECT TO authenticated USING (true);
CREATE POLICY po_update ON public.parametres_organisation FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.parametres_organisation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.parametres_organisation (id) VALUES (1);

DROP POLICY IF EXISTS checklist_insert ON public.checklist_operations;
DROP POLICY IF EXISTS checklist_update ON public.checklist_operations;
DROP POLICY IF EXISTS checklist_delete ON public.checklist_operations;
CREATE POLICY checklist_insert ON public.checklist_operations FOR INSERT TO authenticated WITH CHECK (public.has_global_access(auth.uid()));
CREATE POLICY checklist_update ON public.checklist_operations FOR UPDATE TO authenticated USING (public.has_global_access(auth.uid())) WITH CHECK (public.has_global_access(auth.uid()));
CREATE POLICY checklist_delete ON public.checklist_operations FOR DELETE TO authenticated USING (public.has_global_access(auth.uid()));

CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_ue AFTER INSERT OR UPDATE OR DELETE ON public.utilisateur_etablissements FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_etablissements AFTER INSERT OR UPDATE OR DELETE ON public.etablissements FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_checklist AFTER INSERT OR UPDATE OR DELETE ON public.checklist_operations FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_referentiels AFTER INSERT OR UPDATE OR DELETE ON public.referentiels FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_libelles AFTER INSERT OR UPDATE OR DELETE ON public.libelles_statuts FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_notifs AFTER UPDATE ON public.parametres_notifications FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_org AFTER UPDATE ON public.parametres_organisation FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_prestataires AFTER INSERT OR UPDATE OR DELETE ON public.prestataires FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_equipements AFTER DELETE ON public.equipements FOR EACH ROW EXECUTE FUNCTION public.log_audit();