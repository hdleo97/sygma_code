CREATE OR REPLACE FUNCTION public.set_user_site_access(_target uuid, _assignments jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid(); item jsonb; site uuid; role_value public.app_role; managed uuid[]; target_sites uuid[];
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT array_agg(DISTINCT r.etablissement_id) INTO managed FROM public.utilisateur_etablissement_roles r
    WHERE r.user_id = caller AND public.user_in_etablissement(caller, r.etablissement_id)
      AND r.role IN ('super_admin','responsable_maintenance');
  IF managed IS NULL OR jsonb_typeof(_assignments) <> 'array' OR jsonb_array_length(_assignments) = 0 THEN RAISE EXCEPTION 'Établissement et rôle obligatoires'; END IF;
  SELECT array_agg(etablissement_id) INTO target_sites FROM public.utilisateur_etablissements WHERE user_id = _target;
  IF target_sites IS NOT NULL AND NOT (target_sites && managed) THEN RAISE EXCEPTION 'Compte inaccessible'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(_assignments) LOOP
    site := (item->>'etablissement_id')::uuid; role_value := (item->>'role')::public.app_role;
    IF NOT site = ANY(managed) THEN RAISE EXCEPTION 'Établissement non autorisé'; END IF;
    IF role_value = 'super_admin' AND NOT public.has_any_role_in(caller, site, ARRAY['super_admin']::public.app_role[]) THEN RAISE EXCEPTION 'Attribution super admin interdite'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.utilisateur_etablissement_roles r WHERE r.user_id = _target AND r.etablissement_id = ANY(managed)
    AND r.role = 'super_admin' AND NOT public.has_any_role_in(caller, r.etablissement_id, ARRAY['super_admin']::public.app_role[])) THEN
    RAISE EXCEPTION 'Modification super admin interdite';
  END IF;
  IF _target = caller AND EXISTS (SELECT 1 FROM public.utilisateur_etablissement_roles r WHERE r.user_id = caller AND r.etablissement_id = ANY(managed)
    AND r.role IN ('super_admin','responsable_maintenance') AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_assignments) a
      WHERE (a->>'etablissement_id')::uuid = r.etablissement_id AND a->>'role' = r.role::text)) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas retirer vos propres droits administrateur';
  END IF;
  DELETE FROM public.utilisateur_etablissement_roles WHERE user_id = _target AND etablissement_id = ANY(managed);
  DELETE FROM public.utilisateur_etablissements WHERE user_id = _target AND etablissement_id = ANY(managed)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_assignments) a WHERE (a->>'etablissement_id')::uuid = etablissement_id);
  INSERT INTO public.utilisateur_etablissements(user_id, etablissement_id)
    SELECT DISTINCT _target, (a->>'etablissement_id')::uuid FROM jsonb_array_elements(_assignments) a ON CONFLICT DO NOTHING;
  INSERT INTO public.utilisateur_etablissement_roles(user_id, etablissement_id, role)
    SELECT DISTINCT _target, (a->>'etablissement_id')::uuid, (a->>'role')::public.app_role FROM jsonb_array_elements(_assignments) a;
  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, details)
    VALUES(caller, 'modification_droits_par_site', 'utilisateur_etablissement_roles', _target::text, jsonb_build_object('affectations', _assignments));
END; $$;
REVOKE ALL ON FUNCTION public.set_user_site_access(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_site_access(uuid,jsonb) TO authenticated;