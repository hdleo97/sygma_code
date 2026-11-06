CREATE OR REPLACE FUNCTION public.demande_sortie_is_owner_editable(_user_id uuid,_demande_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.demandes_sortie_pieces d WHERE d.id=_demande_id AND d.technicien_id=_user_id AND d.statut='demande_creee' AND public.user_in_etablissement(_user_id,d.etablissement_id)); $$;
CREATE POLICY sortie_site_boundary ON public.demandes_sortie_pieces AS RESTRICTIVE FOR ALL TO authenticated USING(public.user_in_etablissement(auth.uid(),etablissement_id)) WITH CHECK(public.user_in_etablissement(auth.uid(),etablissement_id));
CREATE POLICY assignment_site_boundary ON public.intervention_techniciens AS RESTRICTIVE FOR ALL TO authenticated USING(public.user_in_etablissement(auth.uid(),public.intervention_etab(intervention_id))) WITH CHECK(public.user_in_etablissement(auth.uid(),public.intervention_etab(intervention_id)));
CREATE OR REPLACE FUNCTION public.ds_before_update() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF OLD.statut IN ('traitee','refusee') THEN RAISE EXCEPTION 'Cette demande est déjà finalisée'; END IF;
 IF NEW.technicien_id IS DISTINCT FROM OLD.technicien_id THEN RAISE EXCEPTION 'Le demandeur ne peut pas être modifié'; END IF;
 IF NEW.statut IS DISTINCT FROM OLD.statut THEN
  IF OLD.statut='demande_creee' AND NEW.statut IN ('validee','refusee') THEN
   IF NOT public.has_any_role_in(auth.uid(),NEW.etablissement_id,ARRAY['super_admin','responsable_maintenance','responsable_etablissement']::public.app_role[]) THEN RAISE EXCEPTION 'Accès réservé au responsable pour valider ou refuser'; END IF;
   IF NEW.statut='refusee' AND nullif(trim(NEW.motif_refus),'') IS NULL THEN RAISE EXCEPTION 'Vous devez préciser le motif du refus'; END IF;
   NEW.valide_par:=auth.uid(); NEW.valide_at:=now();
  ELSIF OLD.statut='validee' AND NEW.statut='traitee' THEN
   IF NOT public.has_any_role_in(auth.uid(),NEW.etablissement_id,ARRAY['super_admin','gestionnaire_stock']::public.app_role[]) THEN RAISE EXCEPTION 'Accès réservé au gestionnaire de stock pour traiter'; END IF;
   NEW.traite_par:=auth.uid(); NEW.traite_at:=now();
  ELSE RAISE EXCEPTION 'Transition de demande de sortie non autorisée'; END IF;
 END IF;
 NEW.updated_at:=now(); RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['rapport_operations_realisees','visites_quotidiennes_operations'] LOOP EXECUTE format('CREATE POLICY operation_site_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.user_in_etablissement(auth.uid(),%s)) WITH CHECK(public.user_in_etablissement(auth.uid(),%s))',t,CASE WHEN t='rapport_operations_realisees' THEN 'public.intervention_etab(intervention_id)' ELSE '(SELECT v.etablissement_id FROM public.visites_quotidiennes v WHERE v.id=visite_id)' END,CASE WHEN t='rapport_operations_realisees' THEN 'public.intervention_etab(intervention_id)' ELSE '(SELECT v.etablissement_id FROM public.visites_quotidiennes v WHERE v.id=visite_id)' END); END LOOP; END $$;