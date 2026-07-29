import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Demande = Tables<"demandes_intervention">;
export type DemandeHistorique = Tables<"demandes_intervention_historique">;
export type DemandeStatut = Demande["statut"];
export type DemandePriorite = Demande["priorite"];

export const STATUTS_DI: { value: DemandeStatut; label: string }[] = [
  { value: "nouvelle", label: "Nouvelle" },
  { value: "validee", label: "Validée" },
  { value: "affectee", label: "Affectée" },
  { value: "en_cours", label: "En cours" },
  { value: "terminee", label: "Terminée" },
  { value: "cloturee", label: "Clôturée" },
  { value: "refusee", label: "Refusée" },
];

export const PRIORITES_DI: { value: DemandePriorite; label: string }[] = [
  { value: "faible", label: "Faible" },
  { value: "moyenne", label: "Moyenne" },
  { value: "haute", label: "Haute" },
  { value: "critique", label: "Critique" },
];

/** Transitions autorisées, identiques à la contrainte appliquée en base. */
export const TRANSITIONS: Record<DemandeStatut, DemandeStatut[]> = {
  nouvelle: ["validee", "refusee"],
  validee: ["affectee", "refusee"],
  affectee: ["en_cours"],
  en_cours: ["terminee"],
  terminee: ["cloturee"],
  cloturee: [],
  refusee: [],
};

export function statutDiLabel(s: DemandeStatut): string {
  return STATUTS_DI.find((x) => x.value === s)?.label ?? s;
}

export function prioriteDiLabel(p: DemandePriorite): string {
  return PRIORITES_DI.find((x) => x.value === p)?.label ?? p;
}

export function statutDiClasses(s: DemandeStatut): string {
  switch (s) {
    case "nouvelle":
      return "bg-muted text-muted-foreground border-border";
    case "validee":
    case "affectee":
      return "bg-primary/10 text-primary border-primary/20";
    case "en_cours":
      return "bg-accent/10 text-accent border-accent/20";
    case "terminee":
      return "bg-primary/15 text-primary border-primary/30";
    case "cloturee":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-destructive/10 text-destructive border-destructive/20";
  }
}

export function prioriteDiClasses(p: DemandePriorite): string {
  switch (p) {
    case "critique":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "haute":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "moyenne":
      return "bg-accent/10 text-accent border-accent/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export const DI_BUCKET = "demandes";

export async function uploadPieceJointe(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(DI_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getPieceJointeUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(DI_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}
