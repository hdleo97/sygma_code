import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Magasin = Tables<"magasins">;
export type Piece = Tables<"pieces">;
export type StockMouvement = Tables<"stock_mouvements">;
export type StockSeuil = Tables<"stock_seuils">;

export type MouvementType = StockMouvement["type"];
export type MouvementOrigine = StockMouvement["origine"];
export type PieceEtat = StockMouvement["etat_piece"];

export const MOUVEMENT_TYPES: { value: MouvementType; label: string }[] = [
  { value: "entree", label: "Entrée" },
  { value: "sortie", label: "Sortie" },
  { value: "ajustement", label: "Ajustement" },
];

export const ORIGINES: { value: MouvementOrigine; label: string }[] = [
  { value: "commande_achat", label: "Commande d'achat" },
  { value: "cannibalisation", label: "Cannibalisation" },
  { value: "autre", label: "Autre" },
];

export const ETATS: { value: PieceEtat; label: string }[] = [
  { value: "neuf", label: "Neuf" },
  { value: "fonctionnel", label: "Fonctionnel" },
  { value: "hors_service", label: "Hors service" },
];

export function labelOf<T extends string>(
  list: { value: T; label: string }[],
  value: T,
): string {
  return list.find((x) => x.value === value)?.label ?? value;
}

export async function fetchMagasins(): Promise<Magasin[]> {
  const { data, error } = await supabase
    .from("magasins")
    .select("*")
    .order("nom");
  if (error) throw error;
  return data ?? [];
}

export async function fetchPieces(): Promise<Piece[]> {
  const { data, error } = await supabase
    .from("pieces")
    .select("*")
    .order("code_article");
  if (error) throw error;
  return data ?? [];
}

export type StockLigne = {
  piece_id: string;
  magasin_id: string;
  quantite: number;
};

export async function fetchStockActuel(): Promise<StockLigne[]> {
  const { data, error } = await supabase
    .from("v_stock_actuel")
    .select("piece_id, magasin_id, quantite");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    piece_id: r.piece_id as string,
    magasin_id: r.magasin_id as string,
    quantite: Number(r.quantite ?? 0),
  }));
}

export async function fetchSeuils(): Promise<StockSeuil[]> {
  const { data, error } = await supabase.from("stock_seuils").select("*");
  if (error) throw error;
  return data ?? [];
}

export function stockKey(pieceId: string, magasinId: string): string {
  return `${pieceId}::${magasinId}`;
}

export function formatQuantite(value: number, unite?: string | null): string {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unite ? `${n} ${unite}` : n;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
