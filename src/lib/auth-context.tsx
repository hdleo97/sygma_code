import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "responsable_maintenance"
  | "technicien"
  | "demandeur"
  | "gestionnaire_stock"
  | "prestataire"
  | "responsable_etablissement";

export type Etablissement = {
  id: string;
  nom: string;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profil: { nom: string | null; prenom: string | null } | null;
  roles: AppRole[];
  etablissements: Etablissement[];
  currentEtablissementId: string | null;
  setCurrentEtablissementId: (id: string | null) => void;
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (r: AppRole[]) => boolean;
  isGlobal: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "sygma.current_etablissement";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profil, setProfil] = useState<AuthContextValue["profil"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [currentEtablissementId, setCurrentEtablissementIdState] = useState<
    string | null
  >(null);

  const setCurrentEtablissementId = useCallback((id: string | null) => {
    setCurrentEtablissementIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    const [profilRes, rolesRes, etabsRes] = await Promise.all([
      supabase
        .from("profils_utilisateurs")
        .select("nom, prenom")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("utilisateur_etablissements")
        .select("etablissement_id, etablissements(id, nom)")
        .eq("user_id", userId),
    ]);

    setProfil(profilRes.data ?? { nom: null, prenom: null });
    const nextRoles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
    setRoles(nextRoles);

    const isGlobal = nextRoles.some(
      (r) => r === "super_admin" || r === "responsable_maintenance",
    );

    let etabs: Etablissement[] = [];
    if (isGlobal) {
      const { data } = await supabase
        .from("etablissements")
        .select("id, nom")
        .order("nom");
      etabs = data ?? [];
    } else {
      etabs = (etabsRes.data ?? [])
        .map((r) => r.etablissements as unknown as Etablissement | null)
        .filter((x): x is Etablissement => !!x)
        .sort((a, b) => a.nom.localeCompare(b.nom));
    }
    setEtablissements(etabs);

    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    const nextCurrent =
      etabs.find((e) => e.id === stored)?.id ?? etabs[0]?.id ?? null;
    setCurrentEtablissementIdState(nextCurrent);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      await loadUserData(data.session.user.id);
    } else {
      setProfil(null);
      setRoles([]);
      setEtablissements([]);
      setCurrentEtablissementIdState(null);
    }
    setLoading(false);
  }, [loadUserData]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (!mounted) return;
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        void loadUserData(s.user.id);
      } else {
        setProfil(null);
        setRoles([]);
        setEtablissements([]);
        setCurrentEtablissementIdState(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh, loadUserData]);

  const value = useMemo<AuthContextValue>(() => {
    const isGlobal = roles.some(
      (r) => r === "super_admin" || r === "responsable_maintenance",
    );
    return {
      loading,
      session,
      user: session?.user ?? null,
      profil,
      roles,
      etablissements,
      currentEtablissementId,
      setCurrentEtablissementId,
      hasRole: (r) => roles.includes(r),
      hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
      isGlobal,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh,
    };
  }, [
    loading,
    session,
    profil,
    roles,
    etablissements,
    currentEtablissementId,
    setCurrentEtablissementId,
    refresh,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
