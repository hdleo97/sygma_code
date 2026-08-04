import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
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
  ORIGINES,
  fetchMagasins,
  fetchPieces,
  type MouvementOrigine,
  type PieceEtat,
} from "@/lib/stocks";

export const Route = createFileRoute("/stocks/entree")({
  component: EntreeStock,
  head: () => ({
    meta: [
      { title: "Entrée de stock — SYGMA" },
      {
        name: "description",
        content:
          "Enregistrez une entrée de pièces en magasin : quantité, origine et état de la pièce.",
      },
      { property: "og:title", content: "Entrée de stock — SYGMA" },
      {
        property: "og:description",
        content: "Saisie d'une entrée de pièces en magasin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function EntreeStock() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const piecesQ = useQuery({ queryKey: ["pieces"], queryFn: fetchPieces });
  const magasinsQ = useQuery({ queryKey: ["magasins"], queryFn: fetchMagasins });

  const [pieceId, setPieceId] = useState("");
  const [magasinId, setMagasinId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [origine, setOrigine] = useState<MouvementOrigine>("commande_achat");
  const [etat, setEtat] = useState<PieceEtat>("neuf");
  const [reference, setReference] = useState("");
  const [commentaire, setCommentaire] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const qte = Number(quantite);
      const { error } = await supabase.from("stock_mouvements").insert({
        piece_id: pieceId,
        magasin_id: magasinId,
        type: "entree",
        quantite: qte,
        origine,
        etat_piece: etat,
        reference: reference.trim() || null,
        justification: commentaire.trim() || null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée de stock enregistrée");
      void queryClient.invalidateQueries({ queryKey: ["stock-actuel"] });
      void navigate({ to: "/stocks" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const qte = Number(quantite);
  const valide = pieceId && magasinId && Number.isFinite(qte) && qte > 0;

  return (
    <div className="p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => void navigate({ to: "/stocks" })}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour aux stocks
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Entrée de stock
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Enregistrez la réception de pièces dans un magasin.
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
            <Label htmlFor="quantite">Quantité *</Label>
            <Input
              id="quantite"
              type="number"
              min="0"
              step="0.01"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Origine</Label>
            <Select value={origine} onValueChange={(v) => setOrigine(v as MouvementOrigine)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGINES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="space-y-2">
            <Label htmlFor="reference">Référence libre</Label>
            <Input
              id="reference"
              placeholder="N° de commande, équipement source…"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="commentaire">Commentaire</Label>
          <Textarea
            id="commentaire"
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={!valide || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer l'entrée
          </Button>
        </div>
      </form>
    </div>
  );
}
