
-- Enum for application roles
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'responsable_maintenance',
  'technicien',
  'demandeur',
  'gestionnaire_stock',
  'prestataire',
  'responsable_etablissement'
);

-- ================= etablissements =================
CREATE TABLE public.etablissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  adresse text,
  responsable text,
  contact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etablissements TO authenticated;
GRANT ALL ON public.etablissements TO service_role;
ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;

-- ================= profils_utilisateurs =================
CREATE TABLE public.profils_utilisateurs (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text,
  prenom text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profils_utilisateurs TO authenticated;
GRANT ALL ON public.profils_utilisateurs TO service_role;
ALTER TABLE public.profils_utilisateurs ENABLE ROW LEVEL SECURITY;

-- ================= user_roles (roles assignments) =================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ================= utilisateur_etablissements (M2M) =================
CREATE TABLE public.utilisateur_etablissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, etablissement_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utilisateur_etablissements TO authenticated;
GRANT ALL ON public.utilisateur_etablissements TO service_role;
ALTER TABLE public.utilisateur_etablissements ENABLE ROW LEVEL SECURITY;

-- ================= Security definer helpers =================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_global_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'responsable_maintenance')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_in_etablissement(_user_id uuid, _etab uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.utilisateur_etablissements
    WHERE user_id = _user_id AND etablissement_id = _etab
  );
$$;

-- ================= updated_at trigger =================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_etablissements_updated_at
  BEFORE UPDATE ON public.etablissements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profils_updated_at
  BEFORE UPDATE ON public.profils_utilisateurs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= Auto-create profile on signup =================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profils_utilisateurs (id, nom, prenom)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nom',
    NEW.raw_user_meta_data ->> 'prenom'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================= RLS Policies =================

-- etablissements
CREATE POLICY "etab_select" ON public.etablissements FOR SELECT TO authenticated
  USING (
    public.has_global_access(auth.uid())
    OR public.user_in_etablissement(auth.uid(), id)
  );
CREATE POLICY "etab_insert" ON public.etablissements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "etab_update" ON public.etablissements FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'responsable_etablissement')
        AND public.user_in_etablissement(auth.uid(), id))
  );
CREATE POLICY "etab_delete" ON public.etablissements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- profils_utilisateurs
CREATE POLICY "profil_select_self_or_global" ON public.profils_utilisateurs FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_global_access(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.utilisateur_etablissements me
      JOIN public.utilisateur_etablissements other
        ON other.etablissement_id = me.etablissement_id
      WHERE me.user_id = auth.uid()
        AND other.user_id = profils_utilisateurs.id
    )
  );
CREATE POLICY "profil_insert_self_or_admin" ON public.profils_utilisateurs FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "profil_update_self_or_admin" ON public.profils_utilisateurs FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "profil_delete_admin" ON public.profils_utilisateurs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- user_roles
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_global_access(auth.uid())
  );
CREATE POLICY "roles_manage_admin" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- utilisateur_etablissements
CREATE POLICY "ue_select" ON public.utilisateur_etablissements FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_global_access(auth.uid())
    OR (public.has_role(auth.uid(), 'responsable_etablissement')
        AND public.user_in_etablissement(auth.uid(), etablissement_id))
  );
CREATE POLICY "ue_manage_admin" ON public.utilisateur_etablissements FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'responsable_etablissement')
        AND public.user_in_etablissement(auth.uid(), etablissement_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (public.has_role(auth.uid(), 'responsable_etablissement')
        AND public.user_in_etablissement(auth.uid(), etablissement_id))
  );
