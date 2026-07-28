import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { EquipementForm } from "@/components/equipement-form";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/equipements/nouveau")({
  component: NouvelEquipement,
  head: () => ({
    meta: [
      { title: "Nouvel équipement — SYGMA" },
      {
        name: "description",
        content:
          "Créez une fiche équipement : référence, désignation, localisation, statut et photo.",
      },
      { property: "og:title", content: "Nouvel équipement — SYGMA" },
      {
        property: "og:description",
        content: "Ajoutez un équipement au parc machine SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function NouvelEquipement() {
  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/equipements">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au parc
        </Link>
      </Button>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        Nouvel équipement
      </h1>
      <div className="max-w-3xl rounded-lg border border-border bg-card p-4 sm:p-6">
        <EquipementForm />
      </div>
    </div>
  );
}
