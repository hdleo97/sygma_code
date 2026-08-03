import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  formatDuree,
  natureInterventionLabel,
  statutInterventionLabel,
  type InterventionNature,
} from "@/lib/interventions";

export type FicheDeVieEvenement = Tables<"fiche_de_vie_evenements"> & {
  interventions: {
    id: string;
    description: string;
    duree_minutes: number | null;
    date_debut: string | null;
    date_fin: string | null;
  } | null;
};

export type FicheDeVieFiltres = {
  du?: string | null;
  au?: string | null;
  nature?: InterventionNature | "toutes";
};

export async function fetchFicheDeVie(
  equipementId: string,
  filtres: FicheDeVieFiltres = {},
): Promise<FicheDeVieEvenement[]> {
  let query = supabase
    .from("fiche_de_vie_evenements")
    .select(
      "*, interventions(id, description, duree_minutes, date_debut, date_fin)",
    )
    .eq("equipement_id", equipementId)
    .order("date_evenement", { ascending: false });

  if (filtres.du) query = query.gte("date_evenement", `${filtres.du}T00:00:00`);
  if (filtres.au) query = query.lte("date_evenement", `${filtres.au}T23:59:59`);
  if (filtres.nature && filtres.nature !== "toutes")
    query = query.eq("nature", filtres.nature);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as FicheDeVieEvenement[];
}

export function formatDateFdv(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/** Export Excel de la fiche de vie (liste des interventions signées). */
export function exporterFicheDeVieExcel(
  rows: FicheDeVieEvenement[],
  equipementLabel: string,
): void {
  const lignes = rows.map((r) => ({
    Date: formatDateFdv(r.date_evenement),
    Type: natureInterventionLabel(r.nature),
    "Technicien(s)": r.techniciens ?? "",
    Intervention: r.interventions?.description ?? "",
    "Opérations réalisées": r.resume ?? "",
    Durée: formatDuree(r.interventions?.duree_minutes ?? null),
    "Statut final": statutInterventionLabel(r.statut_final),
  }));

  const sheet = XLSX.utils.json_to_sheet(
    lignes.length > 0
      ? lignes
      : [
          {
            Date: "",
            Type: "",
            "Technicien(s)": "",
            Intervention: "",
            "Opérations réalisées": "",
            Durée: "",
            "Statut final": "",
          },
        ],
  );
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 40 },
    { wch: 50 },
    { wch: 12 },
    { wch: 14 },
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Fiche de vie");
  const nom = equipementLabel.replace(/[^\w-]+/g, "-").slice(0, 40);
  XLSX.writeFile(book, `fiche-de-vie-${nom}.xlsx`);
}
