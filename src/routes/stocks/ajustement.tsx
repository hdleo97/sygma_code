import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  ETATS,
  fetchMagasins,
  fetchPieces,
  fetchStockActuel,
  formatQuantite,
  stockKey,
  type PieceEtat,
} from "@/lib/stocks";

export const Route = createFileRoute("/stocks/ajustement")({
  component: AjustementStock,
  head: () => ({
    meta: [
      { title: "Ajustement d'inventaire — SYGMA" },
      {
        name: "description",
        content:
          "Corrigez la quantité en stock d'une pièce après inventaire, avec justification obligatoire.",
      },
      { property: "og:title", content: "Ajustement d'inventaire — SYGMA" },
      {
        property: "og:description",
        content: "Correction de stock après inventaire physique.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AjustementStock() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const piecesQ = useQuery({ queryKey: ["pieces"], queryFn: fetchPieces });
  const magasinsQ = useQuery({ queryKey: ["magasins"], queryFn: fetchMagasins });
  const stockQ = useQuery({ queryKey: ["stock-actuel"], queryFn: fetchStockActuel });

  const [pieceId, setPieceId] = useState("");
  const [magasinId, setMagasinId] = useState("");
  const [quantiteReelle, setQuantiteReelle] = useState("");
  const [etat, setEtat] = useState<PieceEtat>("fonctionnel");
  const [justification, setJustification] = useState("");

  const piece = (piecesQ.data ?? []).find((p) => p.id === pieceId);

  const stockActuel = useMemo(() => {
    if (!pieceId || !magasinId) return null;
    const key = stockKey(pieceId, magasinId);
    return (stockQ.data ?? []).find((l) => stockKey(l.piece_id, l.magasin_id) === key)?.quantite ?? 0;
  }, [pieceId, magasinId, stockQ.data]);

  const reelle = Number(quantiteReelle);
  const ecart =
    stockActuel !== null && quantiteReelle !== "" && Number.isFinite(reelle)
      ? reelle - stockActuel
      : null;

  const valide =
    !!pieceId &&
    !!magasinId &&
    quantiteReelle !== "" &&
    Number.isFinite(reelle) &&
    reelle >= 0 &&
    justification.trim().length >= 5 &&
    ecart !== null &&
    ecart !== 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stock_mouvements").insert({
        piece_id: pieceId,
        magasin_id: magasinId,
        type: "ajustement",
        quantite: ecart as number,
        origine: "autre",
        etat_piece: etat,
        justification: justification.trim(),
        reference: "Inventaire",
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajustement d'inventaire enregistré");
      void queryClient.invalidateQueries({ queryKey: ["stock-actuel"] });
      void navigate({ to: "/stocks" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => void navigate({ to: "/stocks" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour aux stocks
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Ajustement d'inventaire
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Saisissez la quantité réellement comptée. L'écart est enregistré comme mouvement
        d'ajustement, avec justification obligatoire.
      </p>

      <form
        className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (valide) mutation.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Pièce *</Label>
            <Select value={pieceId} onValueChange={setPieceId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une pièce" />
              </SelectTrigger>
              <SelectContent>
                {(piecesQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code_article} — {p.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Magasin *</Label>
            <Select value={magasinId} onValueChange={setMagasinId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un magasin" />
              </SelectTrigger>
              <SelectContent>
                {(magasinsQ.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Stock théorique</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
              {stockActuel === null ? "—" : formatQuantite(stockActuel, piece?.unite)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reelle">Quantité comptée *</Label>
            <Input
              id="reelle"
              type="number"
              min="0"
              step="0.01"
              value={quantiteReelle}
              onChange={(e) => setQuantiteReelle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Écart</Label>
            <div
              className={`flex h-9 items-center rounded-md border px-3 text-sm ${
                ecart === null || ecart === 0
                  ? "border-input bg-muted/40 text-muted-foreground"
                  : ecart > 0
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-destructive/20 bg-destructive/10 text-destructive"
              }`}
            >
              {ecart === null ? "—" : `${ecart > 0 ? "+" : ""}${ecart}`}
            </div>
          </div>

          <div className="space-y-2">
            <Label>État de la pièce</Label>
            <Select value={etat} onValueChange={(v) => setEtat(v as PieceEtat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ETATS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="justification">Justification * (5 caractères minimum)</Label>
          <Textarea
            id="justification"
            rows={3}
            placeholder="Motif de l'écart constaté lors de l'inventaire…"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={!valide || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer l'ajustement
          </Button>
        </div>
      </form>
    </div>
  );
}
