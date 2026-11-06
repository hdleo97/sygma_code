import { currentSiteId } from "@/lib/current-site";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DemandeSortie = Tables<"demandes_sortie_pieces">;
export type DemandeSortieLigne = Tables<"demandes_sortie_lignes">;
export type BonSortie = Tables<"bons_sortie">;

export type DsStatut = DemandeSortie["statut"];
export type DsUrgence = DemandeSortie["urgence"];

export const DS_STATUTS: { value: DsStatut; label: string }[] = [
  { value: "demande_creee", label: "Demande créée" },
  { value: "validee", label: "Validée" },
  { value: "traitee", label: "Traitée" },
  { value: "refusee", label: "Refusée" },
];

export const DS_URGENCES: { value: DsUrgence; label: string }[] = [
  { value: "faible", label: "Faible" },
  { value: "moyenne", label: "Moyenne" },
  { value: "haute", label: "Haute" },
  { value: "critique", label: "Critique" },
];

export function statutSortieLabel(s: DsStatut): string {
  return DS_STATUTS.find((x) => x.value === s)?.label ?? s;
}

export function urgenceLabel(u: DsUrgence): string {
  return DS_URGENCES.find((x) => x.value === u)?.label ?? u;
}

export function statutSortieClasses(s: DsStatut): string {
  switch (s) {
    case "demande_creee":
      return "border-border bg-muted text-muted-foreground";
    case "validee":
      return "border-primary/20 bg-primary/10 text-primary";
    case "traitee":
      return "border-emerald-600/20 bg-emerald-600/10 text-emerald-700";
    case "refusee":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function urgenceClasses(u: DsUrgence): string {
  switch (u) {
    case "critique":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "haute":
      return "border-amber-600/30 bg-amber-500/10 text-amber-700";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

const SELECT_DEMANDE = `
  *,
  demandes_sortie_lignes(
    id, piece_id, quantite_demandee, quantite_sortie,
    pieces(code_article, designation, unite, fournisseur)
  ),
  interventions(id, description, nature),
  equipements(reference, designation),
  technicien:profils_utilisateurs!demandes_sortie_pieces_technicien_id_fkey(nom, prenom),
  valideur:profils_utilisateurs!demandes_sortie_pieces_valide_par_fkey(nom, prenom),
  gestionnaire:profils_utilisateurs!demandes_sortie_pieces_traite_par_fkey(nom, prenom),
  bons_sortie(id, numero, date_sortie, magasin_id, magasins(nom))
`;

type Personne = { nom: string | null; prenom: string | null } | null;

export type LigneAvecPiece = DemandeSortieLigne & {
  pieces: {
    code_article: string;
    designation: string;
    unite: string;
    fournisseur: string | null;
  } | null;
};

export type DemandeSortieDetail = DemandeSortie & {
  demandes_sortie_lignes: LigneAvecPiece[];
  interventions: { id: string; description: string; nature: string } | null;
  equipements: { reference: string; designation: string } | null;
  technicien: Personne;
  valideur: Personne;
  gestionnaire: Personne;
  bons_sortie: {
    id: string;
    numero: number;
    date_sortie: string;
    magasin_id: string;
    magasins: { nom: string } | null;
  }[];
};

export function nomComplet(p: Personne): string {
  if (!p) return "—";
  return [p.prenom, p.nom].filter(Boolean).join(" ") || "—";
}

export function numeroBon(numero: number): string {
  return `BS-${String(numero).padStart(5, "0")}`;
}

export async function fetchDemandesSortie(): Promise<DemandeSortieDetail[]> {
  const { data, error } = await supabase
    .from("demandes_sortie_pieces")
    .select(SELECT_DEMANDE)
    .eq("etablissement_id", currentSiteId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DemandeSortieDetail[];
}

export async function fetchDemandeSortie(
  id: string,
): Promise<DemandeSortieDetail | null> {
  const { data, error } = await supabase
    .from("demandes_sortie_pieces")
    .select(SELECT_DEMANDE)
    .eq("etablissement_id", currentSiteId())
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as DemandeSortieDetail | null;
}

export type NouvelleLigne = { piece_id: string; quantite: number };

export async function creerDemandeSortie(input: {
  technicien_id: string;
  etablissement_id: string;
  intervention_id: string | null;
  equipement_id: string | null;
  urgence: DsUrgence;
  justification: string | null;
  lignes: NouvelleLigne[];
}): Promise<string> {
  const { data, error } = await supabase
    .from("demandes_sortie_pieces")
    .insert({
      technicien_id: input.technicien_id,
      etablissement_id: input.etablissement_id,
      intervention_id: input.intervention_id,
      equipement_id: input.equipement_id,
      urgence: input.urgence,
      justification: input.justification,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: errLignes } = await supabase
    .from("demandes_sortie_lignes")
    .insert(
      input.lignes.map((l) => ({
        demande_id: data.id,
        piece_id: l.piece_id,
        quantite_demandee: l.quantite,
      })),
    );
  if (errLignes) throw errLignes;
  return data.id;
}

/** Validation par le responsable, avec ajustement possible des quantités. */
export async function validerDemandeSortie(
  demandeId: string,
  ajustements: { ligne_id: string; quantite: number }[],
): Promise<void> {
  for (const a of ajustements) {
    const { error } = await supabase
      .from("demandes_sortie_lignes")
      .update({ quantite_demandee: a.quantite })
      .eq("id", a.ligne_id);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("demandes_sortie_pieces")
    .update({ statut: "validee" })
    .eq("id", demandeId);
  if (error) throw error;
}

export async function refuserDemandeSortie(
  demandeId: string,
  motif: string,
): Promise<void> {
  const { error } = await supabase
    .from("demandes_sortie_pieces")
    .update({ statut: "refusee", motif_refus: motif })
    .eq("id", demandeId);
  if (error) throw error;
}

/**
 * Traitement par le gestionnaire de stock : mouvements de sortie,
 * bon de sortie numéroté et passage au statut « traitée ».
 */
export async function effectuerSortie(input: {
  demande: DemandeSortieDetail;
  magasin_id: string;
  user_id: string;
  quantites: { ligne_id: string; quantite: number }[];
}): Promise<void> {
  const { error } = await supabase.rpc("traiter_sortie", {
    _demande_id: input.demande.id,
    _magasin_id: input.magasin_id,
    _quantites: input.quantites,
  });
  if (error) throw error;
}

export type BonSortieIntervention = {
  id: string;
  numero: number;
  date_sortie: string;
  magasins: { nom: string } | null;
  demandes_sortie_pieces: {
    id: string;
    demandes_sortie_lignes: LigneAvecPiece[];
  } | null;
};

/** Bons de sortie déjà générés pour une intervention (rapport d'intervention). */
export async function fetchBonsSortieIntervention(
  interventionId: string,
): Promise<BonSortieIntervention[]> {
  const { data, error } = await supabase
    .from("bons_sortie")
    .select(
      `id, numero, date_sortie, magasins(nom),
       demandes_sortie_pieces(id, demandes_sortie_lignes(id, piece_id, quantite_demandee, quantite_sortie, pieces(code_article, designation, unite, fournisseur)))`,
    )
    .eq("intervention_id", interventionId)
    .order("numero");
  if (error) throw error;
  return (data ?? []) as unknown as BonSortieIntervention[];
}
