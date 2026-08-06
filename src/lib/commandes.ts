import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CommandeAchat = Tables<"commandes_achat">;
export type CommandeLigne = Tables<"commandes_achat_lignes">;
export type CommandeStatut = CommandeAchat["statut"];

export const COMMANDE_BUCKET = "commandes";

export const COMMANDE_STATUTS: { value: CommandeStatut; label: string }[] = [
  { value: "a_commander", label: "À commander" },
  { value: "commandee", label: "Commandée" },
  { value: "recue_partiellement", label: "Reçue partiellement" },
  { value: "recue", label: "Reçue" },
  { value: "cloturee", label: "Clôturée" },
];

export function statutCommandeLabel(s: CommandeStatut): string {
  return COMMANDE_STATUTS.find((x) => x.value === s)?.label ?? s;
}

export function statutCommandeClasses(s: CommandeStatut): string {
  switch (s) {
    case "a_commander":
      return "border-border bg-muted text-muted-foreground";
    case "commandee":
      return "border-primary/20 bg-primary/10 text-primary";
    case "recue_partiellement":
      return "border-amber-600/30 bg-amber-500/10 text-amber-700";
    case "recue":
      return "border-emerald-600/20 bg-emerald-600/10 text-emerald-700";
    case "cloturee":
      return "border-border bg-foreground/5 text-foreground/70";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function numeroCommande(numero: number | null): string {
  return numero ? `CMD-${String(numero).padStart(5, "0")}` : "CMD-—";
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

type Personne = { nom: string | null; prenom: string | null } | null;

export function nomComplet(p: Personne): string {
  if (!p) return "—";
  return [p.prenom, p.nom].filter(Boolean).join(" ") || "—";
}

export type LigneAvecPiece = CommandeLigne & {
  pieces: {
    code_article: string;
    designation: string;
    unite: string;
    fournisseur: string | null;
  } | null;
};

export type CommandeDetail = CommandeAchat & {
  commandes_achat_lignes: LigneAvecPiece[];
  magasins: { id: string; nom: string } | null;
  etablissements: { nom: string } | null;
  demandeur: Personne;
};

const SELECT_COMMANDE = `
  *,
  commandes_achat_lignes(
    id, commande_id, piece_id, quantite_commandee, quantite_recue, prix_unitaire,
    created_at, updated_at,
    pieces(code_article, designation, unite, fournisseur)
  ),
  magasins(id, nom),
  etablissements(nom),
  demandeur:profils_utilisateurs!commandes_achat_demandeur_id_fkey(nom, prenom)
`;

export async function fetchCommandes(): Promise<CommandeDetail[]> {
  const { data, error } = await supabase
    .from("commandes_achat")
    .select(SELECT_COMMANDE)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CommandeDetail[];
}

export async function fetchCommande(id: string): Promise<CommandeDetail | null> {
  const { data, error } = await supabase
    .from("commandes_achat")
    .select(SELECT_COMMANDE)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CommandeDetail) ?? null;
}

export type NouvelleLigne = {
  piece_id: string;
  quantite_commandee: number;
  prix_unitaire?: number | null;
};

export async function creerCommande(input: {
  etablissement_id: string;
  magasin_id: string | null;
  fournisseur: string;
  reference?: string | null;
  notes?: string | null;
  montant_estime?: number | null;
  demandeur_id?: string | null;
  pieces_jointes?: string[];
  lignes: NouvelleLigne[];
}): Promise<string> {
  const { lignes, ...commande } = input;
  const { data, error } = await supabase
    .from("commandes_achat")
    .insert({
      etablissement_id: commande.etablissement_id,
      magasin_id: commande.magasin_id,
      fournisseur: commande.fournisseur,
      reference: commande.reference ?? null,
      notes: commande.notes ?? null,
      montant_estime: commande.montant_estime ?? null,
      demandeur_id: commande.demandeur_id ?? null,
      pieces_jointes: commande.pieces_jointes ?? [],
    })
    .select("id")
    .single();
  if (error) throw error;

  if (lignes.length > 0) {
    const { error: e2 } = await supabase.from("commandes_achat_lignes").insert(
      lignes.map((l) => ({
        commande_id: data.id,
        piece_id: l.piece_id,
        quantite_commandee: l.quantite_commandee,
        prix_unitaire: l.prix_unitaire ?? null,
      })),
    );
    if (e2) throw e2;
  }
  return data.id;
}

export async function confirmerCommande(id: string): Promise<void> {
  const { error } = await supabase
    .from("commandes_achat")
    .update({ statut: "commandee", date_commande: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function cloturerCommande(id: string): Promise<void> {
  const { error } = await supabase
    .from("commandes_achat")
    .update({ statut: "cloturee" })
    .eq("id", id);
  if (error) throw error;
}

export async function enregistrerReception(
  commandeId: string,
  magasinId: string,
  lignes: { ligne_id: string; quantite: number }[],
): Promise<void> {
  const utiles = lignes.filter((l) => l.quantite > 0);
  if (utiles.length === 0) throw new Error("Aucune quantité reçue saisie");
  const { error } = await supabase.rpc("reception_commande", {
    _commande_id: commandeId,
    _magasin_id: magasinId,
    _lignes: utiles,
  });
  if (error) throw error;
}

export async function uploadPieceJointeCommande(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(COMMANDE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getPieceJointeCommandeUrl(
  path: string,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(COMMANDE_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function lignesTableau(c: CommandeDetail): (string | number)[][] {
  return c.commandes_achat_lignes.map((l) => [
    l.pieces?.code_article ?? "—",
    l.pieces?.designation ?? "—",
    `${Number(l.quantite_commandee)} ${l.pieces?.unite ?? ""}`.trim(),
    `${Number(l.quantite_recue)} ${l.pieces?.unite ?? ""}`.trim(),
    l.prix_unitaire != null ? Number(l.prix_unitaire).toFixed(2) : "—",
  ]);
}

export function exporterCommandePdf(c: CommandeDetail): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("SYGMA — Commande d'achat", 14, 18);
  doc.setFontSize(10);

  const infos: string[][] = [
    ["N° commande", numeroCommande(c.numero)],
    ["Fournisseur", c.fournisseur],
    ["Établissement", c.etablissements?.nom ?? "—"],
    ["Magasin de destination", c.magasins?.nom ?? "—"],
    ["Statut", statutCommandeLabel(c.statut)],
    ["Demandeur", nomComplet(c.demandeur)],
    ["Date de commande", formatDateTime(c.date_commande)],
    [
      "Montant estimé",
      c.montant_estime != null ? `${Number(c.montant_estime).toFixed(2)}` : "—",
    ],
    ["Référence", c.reference ?? "—"],
  ];

  autoTable(doc, {
    startY: 26,
    head: [["Informations", ""]],
    body: infos,
    theme: "grid",
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    head: [["Code", "Désignation", "Qté commandée", "Qté reçue", "PU"]],
    body: lignesTableau(c),
    theme: "striped",
    styles: { fontSize: 9 },
  });

  if (c.notes) {
    autoTable(doc, {
      head: [["Notes"]],
      body: [[c.notes]],
      theme: "grid",
      styles: { fontSize: 9 },
    });
  }

  doc.save(`${numeroCommande(c.numero)}.pdf`);
}

export function exporterCommandeExcel(c: CommandeDetail): void {
  const rows = c.commandes_achat_lignes.map((l) => ({
    Commande: numeroCommande(c.numero),
    Fournisseur: c.fournisseur,
    Statut: statutCommandeLabel(c.statut),
    Magasin: c.magasins?.nom ?? "",
    Code: l.pieces?.code_article ?? "",
    Désignation: l.pieces?.designation ?? "",
    Unité: l.pieces?.unite ?? "",
    "Qté commandée": Number(l.quantite_commandee),
    "Qté reçue": Number(l.quantite_recue),
    "Reste à recevoir": Number(l.quantite_commandee) - Number(l.quantite_recue),
    "Prix unitaire": l.prix_unitaire != null ? Number(l.prix_unitaire) : "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Commande");
  XLSX.writeFile(wb, `${numeroCommande(c.numero)}.xlsx`);
}

export function exporterCommandesExcel(list: CommandeDetail[]): void {
  const rows = list.map((c) => ({
    Commande: numeroCommande(c.numero),
    Fournisseur: c.fournisseur,
    Établissement: c.etablissements?.nom ?? "",
    Magasin: c.magasins?.nom ?? "",
    Statut: statutCommandeLabel(c.statut),
    Demandeur: nomComplet(c.demandeur),
    "Date de commande": formatDateTime(c.date_commande),
    "Montant estimé": c.montant_estime != null ? Number(c.montant_estime) : "",
    Lignes: c.commandes_achat_lignes.length,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Commandes");
  XLSX.writeFile(wb, "commandes-achat.xlsx");
}
