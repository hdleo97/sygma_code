import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useAuth } from "@/lib/auth-context";
import { creerCommande, uploadPieceJointeCommande } from "@/lib/commandes";
import { fetchMagasins, fetchPieces } from "@/lib/stocks";

export const Route = createFileRoute("/commandes/nouvelle")({
  component: NouvelleCommande,
  validateSearch: (search: Record<string, unknown>) => ({
    pieces: typeof search.pieces === "string" ? search.pieces : "",
    magasin: typeof search.magasin === "string" ? search.magasin : "",
  }),
  head: () => ({
    meta: [
      { title: "Nouvelle commande d'achat — SYGMA" },
      {
        name: "description",
        content:
          "Créez une commande d'achat de pièces : fournisseur, magasin de destination, lignes et pièces jointes.",
      },
      { property: "og:title", content: "Nouvelle commande d'achat — SYGMA" },
      {
        property: "og:description",
        content: "Saisie d'une commande d'achat de pièces détachées.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Ligne = { piece_id: string; quantite: string; prix: string };

function NouvelleCommande() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { pieces: piecesParam, magasin: magasinParam } = Route.useSearch();

  const piecesQ = useQuery({ queryKey: ["pieces"], queryFn: fetchPieces });
  const magasinsQ = useQuery({ queryKey: ["magasins"], queryFn: fetchMagasins });

  const [magasinId, setMagasinId] = useState(magasinParam);
  const [fournisseur, setFournisseur] = useState("");
  const [reference, setReference] = useState("");
  const [montant, setMontant] = useState("");
  const [notes, setNotes] = useState("");
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([
    { piece_id: "", quantite: "", prix: "" },
  ]);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !piecesParam) return;
    const ids: string[] = piecesParam.split(",").filter(Boolean);
    if (ids.length === 0) return;
    setLignes(ids.map((id: string) => ({ piece_id: id, quantite: "1", prix: "" })));
    setPrefilled(true);
  }, [piecesParam, prefilled]);

  const magasin = (magasinsQ.data ?? []).find((m) => m.id === magasinId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!magasin) throw new Error("Magasin de destination obligatoire");
      const paths: string[] = [];
      for (const f of fichiers) paths.push(await uploadPieceJointeCommande(f));

      return creerCommande({
        etablissement_id: magasin.etablissement_id,
        magasin_id: magasin.id,
        fournisseur: fournisseur.trim(),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        montant_estime: montant ? Number(montant) : null,
        demandeur_id: user?.id ?? null,
        pieces_jointes: paths,
        lignes: lignes
          .filter((l) => l.piece_id && Number(l.quantite) > 0)
          .map((l) => ({
            piece_id: l.piece_id,
            quantite_commandee: Number(l.quantite),
            prix_unitaire: l.prix ? Number(l.prix) : null,
          })),
      });
    },
    onSuccess: (id) => {
      toast.success("Commande créée");
      void queryClient.invalidateQueries({ queryKey: ["commandes"] });
      void navigate({ to: "/commandes/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lignesValides = lignes.filter(
    (l) => l.piece_id && Number(l.quantite) > 0,
  );
  const valide = Boolean(magasinId) && fournisseur.trim() && lignesValides.length > 0;

  return (
    <div className="p-4 sm:p-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => void navigate({ to: "/commandes" })}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Retour aux commandes
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Nouvelle commande d'achat
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Sélectionnez le fournisseur, le magasin de destination et les pièces à
        commander.
      </p>

      <form
        className="max-w-4xl space-y-6 rounded-lg border border-border bg-card p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (valide) mutation.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fournisseur">Fournisseur *</Label>
            <Input
              id="fournisseur"
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Magasin de destination *</Label>
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
            <Label htmlFor="reference">Référence (devis, n° fournisseur)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="montant">Montant estimé</Label>
            <Input
              id="montant"
              type="number"
              min="0"
              step="0.01"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Pièces à commander *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLignes((p) => [...p, { piece_id: "", quantite: "", prix: "" }])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une pièce
            </Button>
          </div>

          {lignes.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
              <Select
                value={l.piece_id}
                onValueChange={(v) =>
                  setLignes((p) =>
                    p.map((x, j) => (j === i ? { ...x, piece_id: v } : x)),
                  )
                }
              >
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
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Quantité"
                value={l.quantite}
                onChange={(e) =>
                  setLignes((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, quantite: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Prix unitaire"
                value={l.prix}
                onChange={(e) =>
                  setLignes((p) =>
                    p.map((x, j) => (j === i ? { ...x, prix: e.target.value } : x)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setLignes((p) => p.filter((_, j) => j !== i))}
                aria-label="Supprimer la ligne"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fichiers">Pièces jointes (devis, bon de commande)</Label>
          <Input
            id="fichiers"
            type="file"
            multiple
            onChange={(e) => setFichiers(Array.from(e.target.files ?? []))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!valide || mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Créer la commande
          </Button>
        </div>
      </form>
    </div>
  );
}
