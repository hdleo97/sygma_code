import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, PackageMinus, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/demandes";
import {
  fetchDemandesSortie,
  nomComplet,
  numeroBon,
  statutSortieClasses,
  statutSortieLabel,
  urgenceClasses,
  urgenceLabel,
  type DemandeSortieDetail,
} from "@/lib/sorties";

export const Route = createFileRoute("/sorties/")({
  component: SortiesListe,
  head: () => ({
    meta: [
      { title: "Sorties de pièces — SYGMA" },
      {
        name: "description",
        content:
          "Circuit de sortie de pièces : demande du technicien, validation du responsable, traitement par le gestionnaire de stock.",
      },
      { property: "og:title", content: "Sorties de pièces — SYGMA" },
      {
        property: "og:description",
        content:
          "Suivi des demandes de sortie de pièces et des bons de sortie générés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Carte({ d }: { d: DemandeSortieDetail }) {
  const bon = d.bons_sortie?.[0];
  const lignes = d.demandes_sortie_lignes ?? [];
  return (
    <Link
      to="/sorties/$id"
      params={{ id: d.id }}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutSortieClasses(d.statut)}`}
        >
          {statutSortieLabel(d.statut)}
        </span>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${urgenceClasses(d.urgence)}`}
        >
          Urgence : {urgenceLabel(d.urgence)}
        </span>
        {bon && (
          <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {numeroBon(bon.numero)}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDateTime(d.created_at)}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">
        {lignes.length} pièce
        {lignes.length > 1 ? "s" : ""} —{" "}
        {lignes
          .map((l) => l.pieces?.code_article ?? "?")
          .join(", ")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Demandeur : {nomComplet(d.technicien)}
        {d.equipements
          ? ` • Équipement : ${d.equipements.reference} — ${d.equipements.designation}`
          : ""}
      </p>
    </Link>
  );
}

function Liste({
  items,
  vide,
}: {
  items: DemandeSortieDetail[];
  vide: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {vide}
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {items.map((d) => (
        <Carte key={d.id} d={d} />
      ))}
    </div>
  );
}

function SortiesListe() {
  const { user, hasAnyRole } = useAuth();
  const isResponsable = hasAnyRole([
    "super_admin",
    "responsable_maintenance",
    "responsable_etablissement",
  ]);
  const isGestionnaire = hasAnyRole([
    "super_admin",
    "responsable_maintenance",
    "gestionnaire_stock",
  ]);

  const [tab, setTab] = useState(
    isResponsable ? "a-valider" : isGestionnaire ? "a-traiter" : "mes-demandes",
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["demandes-sortie"],
    queryFn: fetchDemandesSortie,
  });

  const all = data ?? [];
  const miennes = all.filter((d) => d.technicien_id === user?.id);
  const aValider = all.filter((d) => d.statut === "demande_creee");
  const aTraiter = all.filter((d) => d.statut === "validee");

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sorties de pièces
          </h1>
          <p className="text-sm text-muted-foreground">
            Demande → validation → sortie de magasin et bon de sortie.
          </p>
        </div>
        <Button asChild>
          <Link to="/sorties/nouvelle">
            <Plus className="mr-2 h-4 w-4" />
            Demander des pièces
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : isError ? (
        <div className="p-10 text-center text-sm text-destructive">
          Impossible de charger les demandes de sortie.
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="mes-demandes">
              <PackageMinus className="mr-2 h-4 w-4" />
              Mes demandes ({miennes.length})
            </TabsTrigger>
            {isResponsable && (
              <TabsTrigger value="a-valider">
                À valider ({aValider.length})
              </TabsTrigger>
            )}
            {isGestionnaire && (
              <TabsTrigger value="a-traiter">
                À traiter ({aTraiter.length})
              </TabsTrigger>
            )}
            {(isResponsable || isGestionnaire) && (
              <TabsTrigger value="toutes">Toutes ({all.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mes-demandes" className="mt-4">
            <Liste
              items={miennes}
              vide="Vous n'avez encore fait aucune demande de pièces."
            />
          </TabsContent>
          <TabsContent value="a-valider" className="mt-4">
            <Liste items={aValider} vide="Aucune demande en attente de validation." />
          </TabsContent>
          <TabsContent value="a-traiter" className="mt-4">
            <Liste items={aTraiter} vide="Aucune demande validée à traiter." />
          </TabsContent>
          <TabsContent value="toutes" className="mt-4">
            <Liste items={all} vide="Aucune demande de sortie." />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
