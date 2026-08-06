import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  FileDown,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COMMANDE_STATUTS,
  exporterCommandesExcel,
  fetchCommandes,
  formatDateTime,
  nomComplet,
  numeroCommande,
  statutCommandeClasses,
  statutCommandeLabel,
} from "@/lib/commandes";
import {
  fetchMagasins,
  fetchPieces,
  fetchSeuils,
  fetchStockActuel,
  formatQuantite,
  stockKey,
} from "@/lib/stocks";

export const Route = createFileRoute("/commandes/")({
  component: CommandesListe,
  head: () => ({
    meta: [
      { title: "Commandes d'achat — SYGMA" },
      {
        name: "description",
        content:
          "Suivez vos commandes d'achat de pièces : création depuis les alertes de seuil, réceptions partielles et exports.",
      },
      { property: "og:title", content: "Commandes d'achat — SYGMA" },
      {
        property: "og:description",
        content: "Gestion des commandes d'achat et des réceptions de pièces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CommandesListe() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("all");
  const [selection, setSelection] = useState<string[]>([]);

  const commandesQ = useQuery({ queryKey: ["commandes"], queryFn: fetchCommandes });
  const piecesQ = useQuery({ queryKey: ["pieces"], queryFn: fetchPieces });
  const magasinsQ = useQuery({ queryKey: ["magasins"], queryFn: fetchMagasins });
  const stockQ = useQuery({ queryKey: ["stock-actuel"], queryFn: fetchStockActuel });
  const seuilsQ = useQuery({ queryKey: ["stock-seuils"], queryFn: fetchSeuils });

  const commandes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (commandesQ.data ?? []).filter((c) => {
      if (statut !== "all" && c.statut !== statut) return false;
      if (!q) return true;
      return (
        c.fournisseur.toLowerCase().includes(q) ||
        numeroCommande(c.numero).toLowerCase().includes(q) ||
        (c.reference ?? "").toLowerCase().includes(q)
      );
    });
  }, [commandesQ.data, search, statut]);

  const sousSeuil = useMemo(() => {
    const pieces = piecesQ.data ?? [];
    const magasins = magasinsQ.data ?? [];
    const stockMap = new Map<string, number>();
    for (const l of stockQ.data ?? [])
      stockMap.set(stockKey(l.piece_id, l.magasin_id), l.quantite);

    return (seuilsQ.data ?? [])
      .map((s) => {
        const piece = pieces.find((p) => p.id === s.piece_id);
        const magasin = magasins.find((m) => m.id === s.magasin_id);
        const quantite = stockMap.get(stockKey(s.piece_id, s.magasin_id)) ?? 0;
        const seuil = Number(s.seuil_alerte);
        return { s, piece, magasin, quantite, seuil };
      })
      .filter((r) => r.piece && r.magasin && r.quantite < r.seuil);
  }, [piecesQ.data, magasinsQ.data, stockQ.data, seuilsQ.data]);

  const toggle = (id: string) =>
    setSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const creerDepuisSelection = () => {
    const magasinId = sousSeuil.find((r) => selection.includes(r.piece!.id))
      ?.magasin?.id;
    void navigate({
      to: "/commandes/nouvelle",
      search: { pieces: selection.join(","), magasin: magasinId ?? "" },
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Commandes d'achat
          </h1>
          <p className="text-sm text-muted-foreground">
            Réapprovisionnement des pièces : commandes, réceptions et exports.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exporterCommandesExcel(commandes)}
            disabled={commandes.length === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button asChild>
            <Link to="/commandes/nouvelle">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle commande
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="commandes">
        <TabsList>
          <TabsTrigger value="commandes">Commandes</TabsTrigger>
          <TabsTrigger value="seuil">
            Pièces sous le seuil
            {sousSeuil.length > 0 && (
              <span className="ml-2 rounded bg-destructive/10 px-1.5 text-xs text-destructive">
                {sousSeuil.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commandes" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Rechercher un fournisseur, un numéro…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {COMMANDE_STATUTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {commandesQ.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : commandes.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              Aucune commande pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Lignes</TableHead>
                    <TableHead>Demandeur</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandes.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() =>
                        void navigate({ to: "/commandes/$id", params: { id: c.id } })
                      }
                    >
                      <TableCell className="font-medium">
                        {numeroCommande(c.numero)}
                      </TableCell>
                      <TableCell>{c.fournisseur}</TableCell>
                      <TableCell>{c.magasins?.nom ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statutCommandeClasses(c.statut)}
                        >
                          {statutCommandeLabel(c.statut)}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.commandes_achat_lignes.length}</TableCell>
                      <TableCell>{nomComplet(c.demandeur)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(c.date_commande ?? c.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="seuil" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {selection.length} pièce(s) sélectionnée(s)
            </p>
            <Button disabled={selection.length === 0} onClick={creerDepuisSelection}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Ajouter à une commande
            </Button>
          </div>

          {sousSeuil.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              Aucune pièce sous le seuil d'alerte.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Code</TableHead>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Seuil</TableHead>
                    <TableHead>Fournisseur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sousSeuil.map((r) => (
                    <TableRow key={r.s.id}>
                      <TableCell>
                        <Checkbox
                          checked={selection.includes(r.piece!.id)}
                          onCheckedChange={() => toggle(r.piece!.id)}
                          aria-label={`Sélectionner ${r.piece!.code_article}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.piece!.code_article}
                      </TableCell>
                      <TableCell>{r.piece!.designation}</TableCell>
                      <TableCell>{r.magasin!.nom}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {formatQuantite(r.quantite, r.piece!.unite)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatQuantite(r.seuil, r.piece!.unite)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.piece!.fournisseur ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
