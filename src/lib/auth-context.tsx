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
import { rolesForSite, type SiteAssignment } from "@/lib/site-access";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/app-errors";

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
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profil, setProfil] = useState<AuthContextValue["profil"]>(null);
  const [siteRoles, setSiteRoles] = useState<SiteAssignment[]>([]);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [currentEtablissementId, setCurrentEtablissementIdState] = useState<
    string | null
  >(null);

  const setCurrentEtablissementId = useCallback((id: string | null) => {
    if (!id || !etablissements.some((e) => e.id === id)) return;
    setCurrentEtablissementIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [etablissements]);

  const loadUserData = useCallback(async (userId: string) => {
    const [profilRes, rolesRes, etabsRes] = await Promise.all([
      supabase
        .from("profils_utilisateurs")
        .select("nom, prenom")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("utilisateur_etablissement_roles").select("etablissement_id, role").eq("user_id", userId),
      supabase
        .from("utilisateur_etablissements")
        .select("etablissement_id, etablissements(id, nom)")
        .eq("user_id", userId),
    ]);

    const error = profilRes.error ?? rolesRes.error ?? etabsRes.error;
    if (error) {
      setProfil(null); setSiteRoles([]); setEtablissements([]); setCurrentEtablissementIdState(null);
      toast.error(errorMessage(error));
      return;
    }
    setProfil(profilRes.data ?? { nom: null, prenom: null });
    setSiteRoles(rolesRes.data ?? []);
    const etabs = (etabsRes.data ?? [])
        .map((r) => r.etablissements as unknown as Etablissement | null)
        .filter((x): x is Etablissement => !!x)
        .sort((a, b) => a.nom.localeCompare(b.nom));
    setEtablissements(etabs);

    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    const nextCurrent =
      etabs.find((e) => e.id === stored)?.id ?? etabs[0]?.id ?? null;
    setCurrentEtablissementIdState(nextCurrent);
    if (nextCurrent) window.localStorage.setItem(STORAGE_KEY, nextCurrent);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signOut = useCallback(async () => {
    const activityKey = session?.user.id ? `sygma.activity.${session.user.id}` : null;
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      // Local cleanup must not depend on a successful network revocation.
      await supabase.auth.signOut({ scope: "local" });
    }
    setSession(null); setProfil(null); setSiteRoles([]); setEtablissements([]); setCurrentEtablissementIdState(null);
    window.localStorage.removeItem(STORAGE_KEY);
    if (activityKey) window.localStorage.removeItem(activityKey);
  }, [queryClient, session?.user.id]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      await loadUserData(data.session.user.id);
    } else {
      setProfil(null);
      setSiteRoles([]);
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
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      setSession(s);
      if (s?.user) {
        setTimeout(() => void loadUserData(s.user.id), 0);
      } else {
        setProfil(null);
        setSiteRoles([]);
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
    const roles = rolesForSite(siteRoles, currentEtablissementId) as AppRole[];
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
      signOut,
      refresh,
    };
  }, [
    loading,
    session,
    profil,
    siteRoles,
    etablissements,
    currentEtablissementId,
    setCurrentEtablissementId,
    refresh,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
