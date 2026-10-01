import { supabase } from "@/integrations/supabase/client";
import { prioriteDiLabel, statutDiLabel } from "@/lib/demandes";
import { fmtDate, type ExportFormat, type ExportRow } from "@/lib/exports";
import { formatDuree, natureInterventionLabel, statutInterventionLabel } from "@/lib/interventions";
import { VISITES_SELECT, visitesToRows, type VisiteRow } from "@/lib/rapports-format";

export type RapportType = "intervention" | "visite_quotidienne" | "mensuel_preventif" | "personnalise";

export const RAPPORT_TYPES: { value: RapportType; label: string }[] = [
  { value: "intervention", label: "Intervention" },
  { value: "visite_quotidienne", label: "Visite quotidienne" },
  { value: "mensuel_preventif", label: "Mensuel préventif" },
  { value: "personnalise", label: "Personnalisé" },
];

export function rapportTypeLabel(t: string): string {
  return RAPPORT_TYPES.find((x) => x.value === t)?.label ?? t;
}

export const RAPPORTS_BUCKET = "rapports";

export type RapportGenere = {
  id: string;
  type: RapportType;
  titre: string;
  filtres: Record<string, unknown>;
  format: string;
  fichier_path: string;
  etablissement_id: string | null;
  equipement_id: string | null;
  periode_debut: string | null;
  periode_fin: string | null;
  genere_par: string | null;
  created_at: string;
  etablissements: { nom: string } | null;
  equipements: { reference: string; designation: string } | null;
  profils_utilisateurs: { nom: string | null; prenom: string | null } | null;
};

export async function fetchRapports(): Promise<RapportGenere[]> {
  const { data, error } = await supabase
    .from("rapports_generes" as never)
    .select(
      "*, etablissements(nom), equipements(reference, designation), profils_utilisateurs(nom, prenom)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as RapportGenere[];
}

export async function saveRapport(params: {
  blob: Blob;
  format: ExportFormat;
  type: RapportType;
  titre: string;
  filtres: Record<string, unknown>;
  etablissement_id?: string | null;
  equipement_id?: string | null;
  periode_debut?: string | null;
  periode_fin?: string | null;
  userId: string;
}): Promise<void> {
  const path = `${params.userId}/${crypto.randomUUID()}.${params.format}`;
  const { error: upErr } = await supabase.storage
    .from(RAPPORTS_BUCKET)
    .upload(path, params.blob, { contentType: params.blob.type });
  if (upErr) throw upErr;
  const { error } = await supabase.from("rapports_generes" as never).insert({
    type: params.type,
    titre: params.titre,
    filtres: params.filtres,
    format: params.format,
    fichier_path: path,
    etablissement_id: params.etablissement_id || null,
    equipement_id: params.equipement_id || null,
    periode_debut: params.periode_debut || null,
    periode_fin: params.periode_fin || null,
    genere_par: params.userId,
  } as never);
  if (error) throw error;
}

export async function rapportUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(RAPPORTS_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export type Source = "interventions" | "demandes" | "visites";

export const SOURCES: { value: Source; label: string; type: RapportType }[] = [
  { value: "interventions", label: "Interventions", type: "intervention" },
  { value: "demandes", label: "Demandes d'intervention", type: "personnalise" },
  { value: "visites", label: "Visites quotidiennes", type: "visite_quotidienne" },
];

export type FiltresRapport = {
  source: Source;
  du: string;
  au: string;
  etablissement: string;
  equipement: string;
  technicien: string;
  statut: string;
  nature: string;
};

const nomP = (p: { nom: string | null; prenom: string | null } | null | undefined) =>
  [p?.prenom, p?.nom].filter(Boolean).join(" ");

export async function fetchSourceRows(f: FiltresRapport): Promise<ExportRow[]> {
  const all = (v: string) => !v || v === "all";
  const du = f.du ? `${f.du}T00:00:00` : null;
  const au = f.au ? `${f.au}T23:59:59` : null;

  if (f.source === "interventions") {
    let q = supabase
      .from("interventions")
      .select(
        "*, equipements(reference, designation), etablissements(nom), intervention_techniciens(technicien_id, profils_utilisateurs:profils_utilisateurs!intervention_techniciens_technicien_id_fkey(nom, prenom))",
      )
      .order("created_at", { ascending: false });
    if (du) q = q.gte("created_at", du);
    if (au) q = q.lte("created_at", au);
    if (!all(f.etablissement)) q = q.eq("etablissement_id", f.etablissement);
    if (!all(f.equipement)) q = q.eq("equipement_id", f.equipement);
    if (!all(f.statut)) q = q.eq("statut", f.statut as never);
    if (!all(f.nature)) q = q.eq("nature", f.nature as never);
    const { data, error } = await q;
    if (error) throw error;
    type R = {
      created_at: string; description: string; nature: "curative" | "preventive";
      statut: "planifiee" | "en_cours" | "terminee" | "signee";
      date_debut: string | null; date_fin: string | null; duree_minutes: number | null;
      equipements: { reference: string; designation: string } | null;
      etablissements: { nom: string } | null;
      intervention_techniciens: { technicien_id: string; profils_utilisateurs: { nom: string | null; prenom: string | null } | null }[];
    };
    return ((data ?? []) as unknown as R[])
      .filter((r) => all(f.technicien) || r.intervention_techniciens.some((t) => t.technicien_id === f.technicien))
      .map((r) => ({
        Date: fmtDate(r.created_at),
        Établissement: r.etablissements?.nom ?? "",
        Équipement: r.equipements ? `${r.equipements.reference} — ${r.equipements.designation}` : "",
        Description: r.description,
        Nature: natureInterventionLabel(r.nature),
        Statut: statutInterventionLabel(r.statut),
        Début: fmtDate(r.date_debut),
        Fin: fmtDate(r.date_fin),
        Durée: formatDuree(r.duree_minutes),
        Techniciens: r.intervention_techniciens.map((t) => nomP(t.profils_utilisateurs)).join(", "),
      }));
  }

  if (f.source === "demandes") {
    let q = supabase
      .from("demandes_intervention")
      .select(
        "*, equipements(reference, designation), etablissements(nom), demandeur:profils_utilisateurs!demandes_intervention_demandeur_id_fkey(nom, prenom), technicien:profils_utilisateurs!demandes_intervention_technicien_id_fkey(nom, prenom)",
      )
      .order("created_at", { ascending: false });
    if (du) q = q.gte("created_at", du);
    if (au) q = q.lte("created_at", au);
    if (!all(f.etablissement)) q = q.eq("etablissement_id", f.etablissement);
    if (!all(f.equipement)) q = q.eq("equipement_id", f.equipement);
    if (!all(f.statut)) q = q.eq("statut", f.statut as never);
    if (!all(f.technicien)) q = q.eq("technicien_id", f.technicien);
    const { data, error } = await q;
    if (error) throw error;
    type R = {
      created_at: string; description: string; localisation: string | null;
      priorite: Parameters<typeof prioriteDiLabel>[0]; statut: Parameters<typeof statutDiLabel>[0];
      equipements: { reference: string; designation: string } | null;
      etablissements: { nom: string } | null;
      demandeur: { nom: string | null; prenom: string | null } | null;
      technicien: { nom: string | null; prenom: string | null } | null;
    };
    return ((data ?? []) as unknown as R[]).map((d) => ({
      Date: fmtDate(d.created_at),
      Établissement: d.etablissements?.nom ?? "",
      Équipement: d.equipements ? `${d.equipements.reference} — ${d.equipements.designation}` : "",
      Description: d.description,
      Priorité: prioriteDiLabel(d.priorite),
      Statut: statutDiLabel(d.statut),
      Demandeur: nomP(d.demandeur),
      Technicien: nomP(d.technicien),
    }));
  }

  let q = supabase.from("visites_quotidiennes").select(VISITES_SELECT).order("date_visite");
  if (du) q = q.gte("date_visite", du);
  if (au) q = q.lte("date_visite", au);
  if (!all(f.etablissement)) q = q.eq("etablissement_id", f.etablissement);
  if (!all(f.equipement)) q = q.eq("equipement_id", f.equipement);
  if (!all(f.technicien)) q = q.eq("technicien_id", f.technicien);
  if (f.statut === "signee") q = q.not("signature_at", "is", null);
  if (f.statut === "non_signee") q = q.is("signature_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return visitesToRows((data ?? []) as unknown as VisiteRow[]);
}
