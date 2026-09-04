import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profil = Tables<"profils_utilisateurs">;

export const DISPONIBILITES: { value: string; label: string }[] = [
  { value: "disponible", label: "Disponible" },
  { value: "occupe", label: "Occupé" },
  { value: "absent", label: "Absent" },
  { value: "conge", label: "En congé" },
];

export function disponibiliteLabel(v: string | null): string {
  return DISPONIBILITES.find((d) => d.value === v)?.label ?? (v ?? "—");
}

export function disponibiliteClasses(v: string | null): string {
  switch (v) {
    case "disponible":
      return "bg-primary/10 text-primary border-primary/20";
    case "occupe":
      return "bg-accent/10 text-accent border-accent/20";
    case "absent":
    case "conge":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function profilName(p: {
  nom: string | null;
  prenom: string | null;
  id?: string;
}): string {
  return [p.prenom, p.nom].filter(Boolean).join(" ") || (p.id ?? "—");
}

/** Techniciens internes (rôles technicien / prestataire) avec leur profil complet. */
export async function fetchTechnicienProfils(): Promise<Profil[]> {
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["technicien", "prestataire"]);
  if (rolesError) throw rolesError;

  const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (ids.length === 0) return [];

  const { data: profils, error: profilsError } = await supabase
    .from("profils_utilisateurs")
    .select("*")
    .in("id", ids);
  if (profilsError) throw profilsError;

  const seen = new Set<string>();
  return (profils ?? [])
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => profilName(a).localeCompare(profilName(b)));
}

export type PlanningIntervention = {
  id: string;
  description: string;
  statut: Tables<"interventions">["statut"];
  nature: Tables<"interventions">["nature"];
  date_planifiee: string | null;
  duree_estimee_minutes: number | null;
  etablissement_id: string;
  technicien_id: string;
};

/** Interventions en cours ou à venir, par technicien. */
export async function fetchPlanningTechniciens(
  etablissementId?: string | null,
): Promise<PlanningIntervention[]> {
  const { data, error } = await supabase
    .from("intervention_techniciens")
    .select(
      "technicien_id, interventions(id, description, statut, nature, date_planifiee, duree_estimee_minutes, etablissement_id)",
    );
  if (error) throw error;

  return (data ?? [])
    .map((r) => {
      const i = r.interventions as unknown as Omit<
        PlanningIntervention,
        "technicien_id"
      > | null;
      if (!i) return null;
      return { ...i, technicien_id: r.technicien_id as string };
    })
    .filter((x): x is PlanningIntervention => !!x)
    .filter((x) => x.statut === "planifiee" || x.statut === "en_cours")
    .filter((x) => !etablissementId || x.etablissement_id === etablissementId)
    .sort((a, b) =>
      (a.date_planifiee ?? "9999").localeCompare(b.date_planifiee ?? "9999"),
    );
}

export async function updateProfilTechnicien(
  id: string,
  values: {
    competences?: string[];
    disponibilite?: string;
    superieur_id?: string | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("profils_utilisateurs")
    .update(values)
    .eq("id", id);
  if (error) throw error;
}
