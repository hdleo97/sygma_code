import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PlanPreventif = Tables<"plans_preventifs">;
export type PlanEcheance = Tables<"plan_echeances">;
export type VisiteQuotidienne = Tables<"visites_quotidiennes">;

export type PeriodiciteType = PlanPreventif["periodicite"];

export const PERIODICITES: { value: PeriodiciteType; label: string }[] = [
  { value: "temps", label: "Temps (jours)" },
  { value: "compteur", label: "Compteur (heures, cycles…)" },
];

export const DOC_BUCKET = "equipements";

export type PlanDetail = PlanPreventif & {
  equipements: { id: string; reference: string; designation: string } | null;
  plan_echeances: (PlanEcheance & {
    equipements: { id: string; reference: string; designation: string } | null;
  })[];
};

const SELECT_PLAN = `
  *,
  equipements(id, reference, designation),
  plan_echeances(*, equipements(id, reference, designation))
`;

export async function fetchPlans(): Promise<PlanDetail[]> {
  const { data, error } = await supabase
    .from("plans_preventifs")
    .select(SELECT_PLAN)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlanDetail[];
}

export async function createPlan(values: {
  etablissement_id: string;
  equipement_id: string | null;
  categorie_equipement: string | null;
  libelle: string;
  description: string | null;
  periodicite: PeriodiciteType;
  periodicite_valeur: number;
  unite_compteur: string | null;
  checklist_categorie: string | null;
  duree_estimee_minutes: number | null;
  date_debut: string;
  cree_par: string | null;
}): Promise<PlanPreventif> {
  const { data, error } = await supabase
    .from("plans_preventifs")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setPlanActif(id: string, actif: boolean): Promise<void> {
  const { error } = await supabase
    .from("plans_preventifs")
    .update({ actif })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from("plans_preventifs").delete().eq("id", id);
  if (error) throw error;
}

export async function updateReleveCompteur(
  echeanceId: string,
  valeur: number,
): Promise<void> {
  const { error } = await supabase
    .from("plan_echeances")
    .update({ compteur_releve: valeur })
    .eq("id", echeanceId);
  if (error) throw error;
}

/** Déclenche manuellement la génération (la même fonction tourne en tâche planifiée). */
export async function genererPreventifs(): Promise<number> {
  const { data, error } = await supabase.rpc("generer_interventions_preventives");
  if (error) throw error;
  return (data as number | null) ?? 0;
}

export type PreventifPlanifie = {
  id: string;
  description: string;
  statut: Tables<"interventions">["statut"];
  date_planifiee: string | null;
  duree_estimee_minutes: number | null;
  equipements: { reference: string; designation: string } | null;
};

export async function fetchPreventifsPlanifies(): Promise<PreventifPlanifie[]> {
  const { data, error } = await supabase
    .from("interventions")
    .select(
      "id, description, statut, date_planifiee, duree_estimee_minutes, equipements(reference, designation)",
    )
    .eq("nature", "preventive")
    .in("statut", ["planifiee", "en_cours"])
    .order("date_planifiee", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PreventifPlanifie[];
}

/** Niveau d'alerte d'une échéance : dépassée, proche (< 7 j) ou à venir. */
export type NiveauEcheance = "depassee" | "proche" | "a_venir" | "inconnue";

export function niveauEcheance(date: string | null): NiveauEcheance {
  if (!date) return "inconnue";
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return "inconnue";
  const diff = t - Date.now();
  if (diff < 0) return "depassee";
  if (diff < 7 * 24 * 3600 * 1000) return "proche";
  return "a_venir";
}

export function echeanceClasses(n: NiveauEcheance): string {
  switch (n) {
    case "depassee":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "proche":
      return "border-amber-600/30 bg-amber-500/10 text-amber-700";
    case "a_venir":
      return "border-primary/20 bg-primary/10 text-primary";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function echeanceLabel(n: NiveauEcheance): string {
  switch (n) {
    case "depassee":
      return "Échéance dépassée";
    case "proche":
      return "Échéance proche";
    case "a_venir":
      return "À venir";
    default:
      return "Non planifiée";
  }
}

export function formatDateHeure(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/* ------------------------------------------------------------------ */
/* Visites quotidiennes                                                */
/* ------------------------------------------------------------------ */

export type PointControle = {
  operation_id: string | null;
  libelle: string;
  conforme: boolean;
  commentaire: string;
};

export async function enregistrerVisite(params: {
  equipement_id: string;
  etablissement_id: string;
  technicien_id: string;
  observations: string | null;
  signature: string;
  signature_nom: string;
  points: PointControle[];
}): Promise<string> {
  const { data, error } = await supabase
    .from("visites_quotidiennes")
    .insert({
      equipement_id: params.equipement_id,
      etablissement_id: params.etablissement_id,
      technicien_id: params.technicien_id,
      observations: params.observations,
    })
    .select("id")
    .single();
  if (error) throw error;
  const visiteId = data.id;

  if (params.points.length > 0) {
    const { error: opErr } = await supabase
      .from("visites_quotidiennes_operations")
      .insert(
        params.points.map((p) => ({
          visite_id: visiteId,
          operation_id: p.operation_id,
          libelle_libre: p.operation_id ? null : p.libelle,
          conforme: p.conforme,
          commentaire: p.commentaire || null,
        })),
      );
    if (opErr) throw opErr;
  }

  // La signature déclenche l'écriture dans la fiche de vie.
  const { error: signErr } = await supabase
    .from("visites_quotidiennes")
    .update({
      signature: params.signature,
      signature_nom: params.signature_nom,
      signature_at: new Date().toISOString(),
    })
    .eq("id", visiteId);
  if (signErr) throw signErr;

  return visiteId;
}

export async function fetchVisites(): Promise<
  (VisiteQuotidienne & {
    equipements: { reference: string; designation: string } | null;
  })[]
> {
  const { data, error } = await supabase
    .from("visites_quotidiennes")
    .select("*, equipements(reference, designation)")
    .order("date_visite", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as (VisiteQuotidienne & {
    equipements: { reference: string; designation: string } | null;
  })[];
}

/* ------------------------------------------------------------------ */
/* Documents équipement (manuel technique / gamme préventive)          */
/* ------------------------------------------------------------------ */

export type DocumentKind = "manuel_path" | "gamme_path";

export async function uploadDocumentEquipement(
  equipementId: string,
  kind: DocumentKind,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `docs/${equipementId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(DOC_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;

  const { error: updErr } = await supabase
    .from("equipements")
    .update(
      kind === "manuel_path" ? { manuel_path: path } : { gamme_path: path },
    )
    .eq("id", equipementId);
  if (updErr) throw updErr;
  return path;
}

export async function getDocumentUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function isPdf(path: string | null): boolean {
  return !!path && path.toLowerCase().endsWith(".pdf");
}
