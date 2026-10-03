import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

// Les nouvelles tables ne sont pas encore dans les types générés : accès souple.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export type Organisation = { nom_organisation: string; logo_path: string | null };
export type Referentiel = {
  id: string;
  type: "categorie_equipement" | "zone";
  libelle: string;
  actif: boolean;
  ordre: number;
};
export type LibelleStatut = {
  id: string;
  domaine: string;
  code: string;
  libelle: string;
  couleur: string;
};

export const DOMAINES_STATUTS: { value: string; label: string }[] = [
  { value: "di_priorite", label: "Priorités des demandes" },
  { value: "di_statut", label: "Statuts des demandes" },
  { value: "intervention_statut", label: "Statuts des interventions" },
  { value: "equipement_statut", label: "Statuts des équipements" },
];

export async function fetchOrganisation(): Promise<Organisation> {
  const { data } = await db
    .from("parametres_organisation")
    .select("nom_organisation, logo_path")
    .eq("id", 1)
    .maybeSingle();
  return data ?? { nom_organisation: "SYGMA", logo_path: null };
}

/** Logo en data URL (pour jsPDF), ou null. */
export async function fetchLogoDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("branding").download(path);
  if (!data) return null;
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => resolve(null);
    r.readAsDataURL(data);
  });
}

export async function fetchReferentiels(): Promise<Referentiel[]> {
  const { data, error } = await db
    .from("referentiels")
    .select("*")
    .order("ordre")
    .order("libelle");
  if (error) throw error;
  return data ?? [];
}

export function useReferentiels() {
  return useQuery({ queryKey: ["referentiels"], queryFn: fetchReferentiels });
}

export async function fetchLibellesStatuts(): Promise<LibelleStatut[]> {
  const { data, error } = await db
    .from("libelles_statuts")
    .select("*")
    .order("domaine")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
