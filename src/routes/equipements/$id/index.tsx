import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";

import { EquipementPhoto } from "@/components/equipement-photo";
import { FicheDeVie } from "@/components/fiche-de-vie";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  formatDate,
  statutClasses,
  statutLabel,
  type Equipement,
} from "@/lib/equipements";

export const Route = createFileRoute("/equipements/$id/")({
  component: FicheEquipement,
  head: () => ({
    meta: [
      { title: "Fiche équipement — SYGMA" },
      {
        name: "description",
        content:
          "Fiche détaillée d'un équipement du parc machine : caractéristiques, statut et historique.",
      },
      { property: "og:title", content: "Fiche équipement — SYGMA" },
      {
        property: "og:description",
        content: "Consultez le détail d'un équipement du parc machine SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function FicheEquipement() {
  const { id } = Route.useParams();
  const { etablissements } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["equipement", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipements")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Equipement | null;
    },
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          Équipement introuvable ou inaccessible.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/equipements">Retour au parc</Link>
        </Button>
      </div>
    );
  }

  const etab =
    etablissements.find((e) => e.id === data.etablissement_id)?.nom ?? "—";

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/equipements">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au parc
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <EquipementPhoto
            path={data.photo_path}
            alt={data.designation}
            className="h-24 w-24 shrink-0"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {data.designation}
            </h1>
            <p className="text-sm text-muted-foreground">{data.reference}</p>
            <span
              className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutClasses(data.statut)}`}
            >
              {statutLabel(data.statut)}
            </span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/equipements/$id/modifier" params={{ id: data.id }}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="fiche" className="mt-6">
        <TabsList>
          <TabsTrigger value="fiche">Fiche</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>


        <TabsContent value="fiche">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Catégorie / famille" value={data.categorie ?? "—"} />
              <Info label="Établissement" value={etab} />
              <Info label="Zone / localisation" value={data.zone ?? "—"} />
              <Info label="Marque" value={data.marque ?? "—"} />
              <Info label="Modèle" value={data.modele ?? "—"} />
              <Info label="Numéro de série" value={data.numero_serie ?? "—"} />
              <Info
                label="Mise en service"
                value={formatDate(data.date_mise_en_service)}
              />
              <Info label="Fournisseur" value={data.fournisseur ?? "—"} />
              <Info label="Créé le" value={formatDate(data.created_at)} />
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="historique">
          <FicheDeVie
            equipementId={data.id}
            equipementLabel={`${data.reference}-${data.designation}`}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}
