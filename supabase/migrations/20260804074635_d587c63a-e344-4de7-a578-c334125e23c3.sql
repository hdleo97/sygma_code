
-- Enums
CREATE TYPE public.stock_mouvement_type AS ENUM ('entree', 'sortie', 'ajustement');
CREATE TYPE public.stock_mouvement_origine AS ENUM ('commande_achat', 'cannibalisation', 'autre');
CREATE TYPE public.piece_etat AS ENUM ('neuf', 'fonctionnel', 'hors_service');

-- Magasins
CREATE TABLE public.magasins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  localisation text,
  responsable text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.magasins TO authenticated;
GRANT ALL ON public.magasins TO service_role;
ALTER TABLE public.magasins ENABLE ROW LEVEL SECURITY;

-- Pieces
CREATE TABLE public.pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_article text NOT NULL UNIQUE,
  designation text NOT NULL,
  categorie text,
  unite text NOT NULL DEFAULT 'U',
  fournisseur text,
  prix_unitaire numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pieces TO authenticated;
GRANT ALL ON public.pieces TO service_role;
ALTER TABLE public.pieces ENABLE ROW LEVEL SECURITY;

-- Seuils d'alerte par piece et magasin
CREATE TABLE public.stock_seuils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES public.pieces(id) ON DELETE CASCADE,
  magasin_id uuid NOT NULL REFERENCES public.magasins(id) ON DELETE CASCADE,
  seuil_alerte numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (piece_id, magasin_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_seuils TO authenticated;
GRANT ALL ON public.stock_seuils TO service_role;
ALTER TABLE public.stock_seuils ENABLE ROW LEVEL SECURITY;

-- Mouvements
CREATE TABLE public.stock_mouvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES public.pieces(id) ON DELETE RESTRICT,
  magasin_id uuid NOT NULL REFERENCES public.magasins(id) ON DELETE RESTRICT,
  type public.stock_mouvement_type NOT NULL,
  quantite numeric(12,2) NOT NULL,
  origine public.stock_mouvement_origine NOT NULL DEFAULT 'autre',
  etat_piece public.piece_etat NOT NULL DEFAULT 'neuf',
  date_mouvement timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.profils_utilisateurs(id) ON DELETE SET NULL,
  reference text,
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_mouvements_piece ON public.stock_mouvements(piece_id);
CREATE INDEX idx_stock_mouvements_magasin ON public.stock_mouvements(magasin_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_mouvements TO authenticated;
GRANT ALL ON public.stock_mouvements TO service_role;
ALTER TABLE public.stock_mouvements ENABLE ROW LEVEL SECURITY;

-- Helper: peut gerer le stock d'un etablissement
CREATE OR REPLACE FUNCTION public.can_manage_stock(_user_id uuid, _etab uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
     OR public.has_role(_user_id, 'responsable_maintenance')
     OR ((public.has_role(_user_id, 'gestionnaire_stock')
          OR public.has_role(_user_id, 'responsable_etablissement'))
         AND public.user_in_etablissement(_user_id, _etab));
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_stock(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.magasin_etab(_magasin_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT etablissement_id FROM public.magasins WHERE id = _magasin_id; $$;
GRANT EXECUTE ON FUNCTION public.magasin_etab(uuid) TO authenticated;

-- Policies magasins
CREATE POLICY "Stock: voir les magasins de ses etablissements" ON public.magasins
FOR SELECT TO authenticated USING (public.can_manage_stock(auth.uid(), etablissement_id));
CREATE POLICY "Stock: creer un magasin" ON public.magasins
FOR INSERT TO authenticated WITH CHECK (public.can_manage_stock(auth.uid(), etablissement_id));
CREATE POLICY "Stock: modifier un magasin" ON public.magasins
FOR UPDATE TO authenticated USING (public.can_manage_stock(auth.uid(), etablissement_id))
WITH CHECK (public.can_manage_stock(auth.uid(), etablissement_id));
CREATE POLICY "Stock: supprimer un magasin" ON public.magasins
FOR DELETE TO authenticated USING (public.can_manage_stock(auth.uid(), etablissement_id));

-- Policies pieces (catalogue global lisible par tous les connectes)
CREATE POLICY "Pieces: lecture pour les utilisateurs connectes" ON public.pieces
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pieces: creation par gestionnaires" ON public.pieces
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'responsable_maintenance')
  OR public.has_role(auth.uid(), 'gestionnaire_stock')
);
CREATE POLICY "Pieces: modification par gestionnaires" ON public.pieces
FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'responsable_maintenance')
  OR public.has_role(auth.uid(), 'gestionnaire_stock')
) WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'responsable_maintenance')
  OR public.has_role(auth.uid(), 'gestionnaire_stock')
);
CREATE POLICY "Pieces: suppression par admin" ON public.pieces
FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'responsable_maintenance')
);

-- Policies seuils
CREATE POLICY "Seuils: lecture" ON public.stock_seuils
FOR SELECT TO authenticated USING (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)));
CREATE POLICY "Seuils: creation" ON public.stock_seuils
FOR INSERT TO authenticated WITH CHECK (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)));
CREATE POLICY "Seuils: modification" ON public.stock_seuils
FOR UPDATE TO authenticated USING (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)))
WITH CHECK (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)));
CREATE POLICY "Seuils: suppression" ON public.stock_seuils
FOR DELETE TO authenticated USING (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)));

-- Policies mouvements
CREATE POLICY "Mouvements: lecture" ON public.stock_mouvements
FOR SELECT TO authenticated USING (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)));
CREATE POLICY "Mouvements: creation" ON public.stock_mouvements
FOR INSERT TO authenticated WITH CHECK (
  public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)) AND user_id = auth.uid()
);
CREATE POLICY "Mouvements: modification" ON public.stock_mouvements
FOR UPDATE TO authenticated USING (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)))
WITH CHECK (public.can_manage_stock(auth.uid(), public.magasin_etab(magasin_id)));
CREATE POLICY "Mouvements: suppression" ON public.stock_mouvements
FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'responsable_maintenance')
);

-- Triggers updated_at
CREATE TRIGGER magasins_updated_at BEFORE UPDATE ON public.magasins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pieces_updated_at BEFORE UPDATE ON public.pieces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER stock_seuils_updated_at BEFORE UPDATE ON public.stock_seuils FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER stock_mouvements_updated_at BEFORE UPDATE ON public.stock_mouvements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vue stock actuel (security_invoker => RLS des mouvements s'applique)
CREATE VIEW public.v_stock_actuel
WITH (security_invoker = true) AS
SELECT
  m.piece_id,
  m.magasin_id,
  SUM(
    CASE WHEN m.type = 'sortie' THEN -m.quantite ELSE m.quantite END
  )::numeric(14,2) AS quantite
FROM public.stock_mouvements m
GROUP BY m.piece_id, m.magasin_id;

GRANT SELECT ON public.v_stock_actuel TO authenticated;
GRANT SELECT ON public.v_stock_actuel TO service_role;
