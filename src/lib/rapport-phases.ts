import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ChecklistOperation = Tables<"checklist_operations">;
export type OperationRealisee = Tables<"rapport_operations_realisees">;

export type Phase = 1 | 2 | 3 | 4 | 5;

export const PHASES: { value: Phase; label: string }[] = [
  { value: 1, label: "Création de l'environnement de maintenance" },
  { value: 2, label: "Démontage" },
  { value: 3, label: "Vérification et travaux" },
  { value: 4, label: "Fermeture" },
  { value: 5, label: "Réglages et redémarrage" },
];

export function phaseLabel(p: number): string {
  return PHASES.find((x) => x.value === p)?.label ?? `Phase ${p}`;
}

/** Checklist standard : opérations génériques + celles de la catégorie donnée. */
export async function fetchChecklist(
  categorie: string | null,
): Promise<ChecklistOperation[]> {
  let query = supabase
    .from("checklist_operations")
    .select("*")
    .eq("actif", true)
    .order("phase")
    .order("ordre");

  query = categorie
    ? query.or(`categorie_equipement.is.null,categorie_equipement.eq.${categorie}`)
    : query.is("categorie_equipement", null);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchOperationsRealisees(
  interventionId: string,
): Promise<OperationRealisee[]> {
  const { data, error } = await supabase
    .from("rapport_operations_realisees")
    .select("*")
    .eq("intervention_id", interventionId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function cocherOperation(params: {
  interventionId: string;
  phase: number;
  operationId: string;
}): Promise<void> {
  const { error } = await supabase.from("rapport_operations_realisees").insert({
    intervention_id: params.interventionId,
    phase: params.phase,
    operation_id: params.operationId,
  });
  if (error) throw error;
}

export async function ajouterOperationLibre(params: {
  interventionId: string;
  phase: number;
  libelle: string;
}): Promise<void> {
  const { error } = await supabase.from("rapport_operations_realisees").insert({
    intervention_id: params.interventionId,
    phase: params.phase,
    libelle_libre: params.libelle.trim(),
  });
  if (error) throw error;
}

export async function supprimerOperation(id: string): Promise<void> {
  const { error } = await supabase
    .from("rapport_operations_realisees")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
