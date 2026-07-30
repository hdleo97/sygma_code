import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Intervention = Tables<"interventions">;
export type InterventionStatut = Intervention["statut"];
export type InterventionNature = Intervention["nature"];

export const STATUTS_INTERVENTION: {
  value: InterventionStatut;
  label: string;
}[] = [
  { value: "planifiee", label: "Planifiée" },
  { value: "en_cours", label: "En cours" },
  { value: "terminee", label: "Terminée" },
  { value: "signee", label: "Signée" },
];

export const NATURES_INTERVENTION: {
  value: InterventionNature;
  label: string;
}[] = [
  { value: "curative", label: "Curative" },
  { value: "preventive", label: "Préventive" },
];

export function statutInterventionLabel(s: InterventionStatut): string {
  return STATUTS_INTERVENTION.find((x) => x.value === s)?.label ?? s;
}

export function natureInterventionLabel(n: InterventionNature): string {
  return NATURES_INTERVENTION.find((x) => x.value === n)?.label ?? n;
}

export function statutInterventionClasses(s: InterventionStatut): string {
  switch (s) {
    case "planifiee":
      return "bg-muted text-muted-foreground border-border";
    case "en_cours":
      return "bg-accent/10 text-accent border-accent/20";
    case "terminee":
      return "bg-primary/10 text-primary border-primary/20";
    default:
      return "bg-primary/20 text-primary border-primary/40";
  }
}

/** Transitions autorisées côté interface. */
export const TRANSITIONS_INTERVENTION: Record<
  InterventionStatut,
  InterventionStatut[]
> = {
  planifiee: ["en_cours"],
  en_cours: ["terminee"],
  terminee: ["signee"],
  signee: [],
};

export function formatDuree(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Durée en minutes entre deux instants ISO, null si incomplet ou invalide. */
export function computeDuree(
  debut: string | null,
  fin: string | null,
): number | null {
  if (!debut || !fin) return null;
  const d = new Date(debut).getTime();
  const f = new Date(fin).getTime();
  if (Number.isNaN(d) || Number.isNaN(f) || f < d) return null;
  return Math.round((f - d) / 60000);
}

/** Convertit une valeur ISO en valeur pour <input type="datetime-local">. */
export function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type TechnicienOption = {
  id: string;
  nom: string | null;
  prenom: string | null;
};

export function technicienName(t: TechnicienOption): string {
  return [t.prenom, t.nom].filter(Boolean).join(" ") || t.id;
}

export async function fetchTechniciens(): Promise<TechnicienOption[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, profils_utilisateurs(id, nom, prenom)")
    .in("role", ["technicien", "prestataire"]);
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.profils_utilisateurs as unknown as TechnicienOption | null)
    .filter((p): p is TechnicienOption => !!p);
}
