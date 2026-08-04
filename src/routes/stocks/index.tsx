import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownToLine, Loader2, Scale, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
import {
  fetchMagasins,
  fetchPieces,
  fetchSeuils,
  fetchStockActuel,
  formatQuantite,
  stockKey,
} from "@/lib/stocks";

export const Route = createFileRoute("/stocks/")({
  component: StocksListe,
  head: () => ({
    meta: [
      { title: "Stocks — Pièces et magasins SYGMA" },
      {
        name: "description",
        content:
          "Suivez les quantités disponibles par pièce et par magasin, avec alertes de seuil.",
      },
      { property: "og:title", content: "Stocks — SYGMA" },
      {
        property: "og:description",
        content: "Stock actuel par pièce et magasin, seuils d'alerte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function StocksListe() {
  const [search, setSearch] = useState("");
  const [magasin, setMagasin] = useState("all");
  const [categorie, setCategorie] = useState("all");
  const [alerteSeule, setAlerteSeule] = useState(false);

  const piecesQ = useQuery({ queryKey: ["pieces"], queryFn: fetchPieces });
  const magasinsQ = useQuery({ queryKey: ["magasins"], queryFn: fetchMagasins });
  const stockQ = useQuery({ queryKey: ["stock-actuel"], queryFn: fetchStockActuel });
  const seuilsQ = useQuery({ queryKey: ["stock-seuils"], queryFn: fetchSeuils });

  const isLoading =
    piecesQ.isLoading || magasinsQ.isLoading || stockQ.isLoading || seuilsQ.isLoading;
  const isError = piecesQ.isError || magasinsQ.isError || stockQ.isError || seuilsQ.isError;

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of stockQ.data ?? []) m.set(stockKey(l.piece_id, l.magasin_id), l.quantite);
    return m;
  }, [stockQ.data]);

  const seuilMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of seuilsQ.data ?? [])
      m.set(stockKey(s.piece_id, s.magasin_id), Number(s.seuil_alerte));
    return m;
  }, [seuilsQ.data]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set((piecesQ.data ?? []).map((p) => p.categorie).filter(Boolean)),
      ).sort() as string[],
    [piecesQ.data],
  );

  const magasins = magasinsQ.data ?? [];
  const magasinsAffiches = magasin === "all" ? magasins : magasins.filter((m) => m.id === magasin);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (piecesQ.data ?? []).filter((p) => {
      if (categorie !== "all" && p.categorie !== categorie) return false;
      if (q) {
        const match = [p.code_article, p.designation, p.categorie, p.fournisseur]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q));
        if (!match) return false;
      }
      if (alerteSeule) {
        const sousSeuil = magasinsAffiches.some((m) => {
          const seuil = seuilMap.get(stockKey(p.id, m.id));
          if (seuil === undefined) return false;
          return (stockMap.get(stockKey(p.id, m.id)) ?? 0) < seuil;
        });
        if (!sousSeuil) return false;
      }
      return true;
    });
  }, [piecesQ.data, search, categorie, alerteSeule, magasinsAffiches, seuilMap, stockMap]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Stocks</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} pièce{rows.length > 1 ? "s" : ""} — {magasins.length} magasin
            {magasins.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/stocks/entree">
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Entrée de stock
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/stocks/ajustement">
              <Scale className="mr-2 h-4 w-4" />
              Ajustement d'inventaire
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher une pièce…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categorie} onValueChange={setCategorie}>
          <SelectTrigger>
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={magasin} onValueChange={setMagasin}>
          <SelectTrigger>
            <SelectValue placeholder="Magasin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les magasins</SelectItem>
            {magasins.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={alerteSeule ? "default" : "outline"}
          onClick={() => setAlerteSeule((v) => !v)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Sous le seuil uniquement
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des stocks…
          </div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-destructive">
            Impossible de charger les stocks.
          </div>
        ) : magasins.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aucun magasin accessible pour votre profil.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aucune pièce ne correspond aux critères.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code article</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                  <TableHead className="hidden lg:table-cell">Fournisseur</TableHead>
                  {magasinsAffiches.map((m) => (
                    <TableHead key={m.id} className="text-right">
                      {m.nom}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.code_article}</TableCell>
                    <TableCell>{p.designation}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {p.categorie ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {p.fournisseur ?? "—"}
                    </TableCell>
                    {magasinsAffiches.map((m) => {
                      const key = stockKey(p.id, m.id);
                      const qte = stockMap.get(key) ?? 0;
                      const seuil = seuilMap.get(key);
                      const sousSeuil = seuil !== undefined && qte < seuil;
                      return (
                        <TableCell key={m.id} className="text-right">
                          <span
                            className={
                              sousSeuil
                                ? "inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                                : "text-sm text-foreground"
                            }
                            title={seuil !== undefined ? `Seuil : ${seuil}` : undefined}
                          >
                            {sousSeuil && <AlertTriangle className="h-3 w-3" />}
                            {formatQuantite(qte, p.unite)}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
