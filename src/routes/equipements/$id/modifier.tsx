import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { EquipementForm } from "@/components/equipement-form";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Equipement } from "@/lib/equipements";

export const Route = createFileRoute("/equipements/$id/modifier")({
  component: ModifierEquipement,
  head: () => ({
    meta: [
      { title: "Modifier un équipement — SYGMA" },
      {
        name: "description",
        content:
          "Mettez à jour les caractéristiques, le statut et la photo d'un équipement du parc.",
      },
      { property: "og:title", content: "Modifier un équipement — SYGMA" },
      {
        property: "og:description",
        content: "Édition d'une fiche équipement du parc machine SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ModifierEquipement() {
  const { id } = Route.useParams();

  const { data, isLoading, isError } = useQuery({
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

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/equipements/$id" params={{ id }}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la fiche
        </Link>
      </Button>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        Modifier l'équipement
      </h1>
      <div className="max-w-3xl rounded-lg border border-border bg-card p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-destructive">
            Équipement introuvable ou inaccessible.
          </p>
        ) : (
          <EquipementForm equipement={data} />
        )}
      </div>
    </div>
  );
}
