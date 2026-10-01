import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ExportMenu } from "@/components/export-menu";
import { exportRows, fmtDate } from "@/lib/exports";

import { EquipementPhoto } from "@/components/equipement-photo";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  STATUTS,
  statutClasses,
  statutLabel,
  type Equipement,
} from "@/lib/equipements";

export const Route = createFileRoute("/equipements/")({
  component: EquipementsListe,
  head: () => ({
    meta: [
      { title: "Équipements — Parc machine SYGMA" },
      {
        name: "description",
        content:
          "Consultez et filtrez le parc machine : référence, catégorie, statut et établissement.",
      },
      { property: "og:title", content: "Équipements — SYGMA" },
      {
        property: "og:description",
        content: "Parc machine SYGMA : liste, recherche et filtres.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function EquipementsListe() {
  const { etablissements } = useAuth();
  const [search, setSearch] = useState("");
  const [categorie, setCategorie] = useState("all");
  const [statut, setStatut] = useState("all");
  const [etab, setEtab] = useState("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["equipements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipements")
        .select("*")
        .order("reference");
      if (error) throw error;
      return data as Equipement[];
    },
  });

  const categories = useMemo(
    () =>
      Array.from(
        new Set((data ?? []).map((e) => e.categorie).filter(Boolean)),
      ).sort() as string[],
    [data],
  );

  const etabName = (id: string) =>
    etablissements.find((e) => e.id === id)?.nom ?? "—";

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      if (categorie !== "all" && e.categorie !== categorie) return false;
      if (statut !== "all" && e.statut !== statut) return false;
      if (etab !== "all" && e.etablissement_id !== etab) return false;
      if (!q) return true;
      return [
        e.reference,
        e.designation,
        e.marque,
        e.modele,
        e.numero_serie,
        e.zone,
        e.categorie,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [data, search, categorie, statut, etab]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Équipements
          </h1>
          <p className="text-sm text-muted-foreground">
            Parc machine — {rows.length} équipement{rows.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu disabled={rows.length === 0} onExport={(f) => exportRows(rows.map((e) => ({ Référence: e.reference, Désignation: e.designation, Catégorie: e.categorie ?? "", Zone: e.zone ?? "", Marque: e.marque ?? "", Modèle: e.modele ?? "", "N° série": e.numero_serie ?? "", "Mise en service": e.date_mise_en_service ?? "", Fournisseur: e.fournisseur ?? "", Statut: e.statut })), f, "Parc équipements")} />
          <Button asChild>
          <Link to="/equipements/nouveau">
            <Plus className="mr-2 h-4 w-4" />
            Nouvel équipement
          </Link>
        </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher…"
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
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={etab} onValueChange={setEtab}>
          <SelectTrigger>
            <SelectValue placeholder="Établissement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les établissements</SelectItem>
            {etablissements.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement du parc…
          </div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-destructive">
            Impossible de charger les équipements.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aucun équipement ne correspond aux critères.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Photo</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Catégorie
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">Zone</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Établissement
                  </TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer">
                    <TableCell>
                      <Link to="/equipements/$id" params={{ id: e.id }}>
                        <EquipementPhoto
                          path={e.photo_path}
                          alt={e.designation}
                          className="h-10 w-10"
                        />
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link to="/equipements/$id" params={{ id: e.id }}>
                        {e.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to="/equipements/$id" params={{ id: e.id }}>
                        {e.designation}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {e.categorie ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {e.zone ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {etabName(e.etablissement_id)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutClasses(e.statut)}`}
                      >
                        {statutLabel(e.statut)}
                      </span>
                    </TableCell>
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
