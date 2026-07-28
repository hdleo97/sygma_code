import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Equipement = Tables<"equipements">;

export type EquipementStatut = Equipement["statut"];

export const STATUTS: { value: EquipementStatut; label: string }[] = [
  { value: "en_service", label: "En service" },
  { value: "en_panne", label: "En panne" },
  { value: "en_maintenance", label: "En maintenance" },
  { value: "hors_service", label: "Hors service" },
  { value: "reforme", label: "Réformé" },
];

export function statutLabel(s: EquipementStatut): string {
  return STATUTS.find((x) => x.value === s)?.label ?? s;
}

export function statutClasses(s: EquipementStatut): string {
  switch (s) {
    case "en_service":
      return "bg-primary/10 text-primary border-primary/20";
    case "en_panne":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "en_maintenance":
      return "bg-accent/10 text-accent border-accent/20";
    case "hors_service":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export const PHOTO_BUCKET = "equipements";

export async function getPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function uploadPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("fr-FR", { dateStyle: "medium" });
}
