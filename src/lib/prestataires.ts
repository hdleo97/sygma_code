import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Prestataire = Tables<"prestataires">;
export type PrestataireInput = TablesInsert<"prestataires">;

export async function fetchPrestataires(
  etablissementId?: string | null,
): Promise<Prestataire[]> {
  let q = supabase.from("prestataires").select("*").order("raison_sociale");
  if (etablissementId) {
    q = q.eq("etablissement_id", etablissementId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertPrestataire(
  input: Partial<PrestataireInput> & { id?: string },
): Promise<Prestataire> {
  const { data, error } = input.id
    ? await supabase
        .from("prestataires")
        .update(input)
        .eq("id", input.id)
        .select("*")
        .single()
    : await supabase.from("prestataires").insert(input as PrestataireInput).select("*").single();
  if (error) throw error;
  return data;
}

export async function deletePrestataire(id: string): Promise<void> {
  const { error } = await supabase.from("prestataires").delete().eq("id", id);
  if (error) throw error;
}

export function contratLabel(p: Prestataire): string {
  const parts = [
    p.contrat_reference,
    p.contrat_debut && p.contrat_fin
      ? `${new Date(p.contrat_debut).toLocaleDateString("fr-FR")} → ${new Date(
          p.contrat_fin,
        ).toLocaleDateString("fr-FR")}`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
