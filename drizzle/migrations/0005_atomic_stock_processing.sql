CREATE OR REPLACE FUNCTION public.traiter_sortie(_demande_id uuid,_magasin_id uuid,_quantites jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.demandes_sortie_pieces%ROWTYPE; l record; q numeric; disponible numeric; total numeric:=0; BEGIN
 SELECT * INTO d FROM public.demandes_sortie_pieces WHERE id=_demande_id FOR UPDATE;
 IF NOT FOUND OR NOT public.has_any_role_in(auth.uid(),d.etablissement_id,ARRAY['super_admin','gestionnaire_stock']::public.app_role[]) THEN RAISE EXCEPTION 'Accès réservé au gestionnaire de stock'; END IF;
 IF d.statut<>'validee' THEN RAISE EXCEPTION 'La demande doit être validée avant traitement'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.magasins WHERE id=_magasin_id AND etablissement_id=d.etablissement_id) THEN RAISE EXCEPTION 'Le magasin doit appartenir au même établissement'; END IF;
 IF jsonb_typeof(_quantites)<>'array' THEN RAISE EXCEPTION 'Quantités invalides'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_quantites) a WHERE NOT EXISTS(SELECT 1 FROM public.demandes_sortie_lignes dl WHERE dl.id=(a->>'ligne_id')::uuid AND dl.demande_id=d.id)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(_quantites) a GROUP BY a->>'ligne_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Les lignes de sortie sont invalides'; END IF;
 -- Lock the store to serialize availability checks across concurrent requests.
 PERFORM 1 FROM public.magasins WHERE id=_magasin_id FOR UPDATE;
 FOR l IN SELECT * FROM public.demandes_sortie_lignes WHERE demande_id=d.id ORDER BY id FOR UPDATE LOOP
  SELECT (a->>'quantite')::numeric INTO q FROM jsonb_array_elements(_quantites) a WHERE (a->>'ligne_id')::uuid=l.id;
  q:=coalesce(q,l.quantite_demandee);
  IF q<0 OR q>l.quantite_demandee OR q::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Quantité de sortie invalide'; END IF;
  SELECT coalesce(sum(CASE type WHEN 'sortie' THEN -quantite ELSE quantite END),0) INTO disponible FROM public.stock_mouvements WHERE piece_id=l.piece_id AND magasin_id=_magasin_id;
  IF q>disponible THEN RAISE EXCEPTION 'Stock insuffisant pour cette sortie'; END IF;
  IF q>0 THEN INSERT INTO public.stock_mouvements(piece_id,magasin_id,type,quantite,origine,etat_piece,user_id,reference,justification) VALUES(l.piece_id,_magasin_id,'sortie',q,'autre','neuf',auth.uid(),'Demande '||left(d.id::text,8),d.justification); END IF;
  UPDATE public.demandes_sortie_lignes SET quantite_sortie=q WHERE id=l.id;
  total:=total+q;
 END LOOP;
 IF total<=0 THEN RAISE EXCEPTION 'Aucune quantité à sortir'; END IF;
 INSERT INTO public.bons_sortie(demande_id,magasin_id,etablissement_id,intervention_id,cree_par) VALUES(d.id,_magasin_id,d.etablissement_id,d.intervention_id,auth.uid());
 UPDATE public.demandes_sortie_pieces SET statut='traitee' WHERE id=d.id;
END $$;
REVOKE ALL ON FUNCTION public.traiter_sortie(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.traiter_sortie(uuid,uuid,jsonb) TO authenticated;
DO $$ DECLARE def text; BEGIN SELECT pg_get_functiondef('public.reception_commande(uuid,uuid,jsonb)'::regprocedure) INTO def;
 def:=replace(def,'SELECT numero INTO _numero FROM public.commandes_achat WHERE id = _commande_id;','SELECT numero INTO _numero FROM public.commandes_achat WHERE id = _commande_id AND statut IN (''commandee'',''recue_partiellement'') FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION ''La commande ne peut pas être réceptionnée dans cet état''; END IF; IF NOT EXISTS(SELECT 1 FROM public.magasins m JOIN public.commandes_achat c ON c.etablissement_id=m.etablissement_id WHERE c.id=_commande_id AND m.id=_magasin_id) THEN RAISE EXCEPTION ''Le magasin doit appartenir au même établissement''; END IF;');
 def:=replace(def,'WHERE id = _ligne_id AND commande_id = _commande_id;','WHERE id = _ligne_id AND commande_id = _commande_id FOR UPDATE;'); EXECUTE def; END $$;