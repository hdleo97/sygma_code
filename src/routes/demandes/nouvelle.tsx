import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { DemandeForm } from "@/components/demande-form";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demandes/nouvelle")({
  component: NouvelleDemande,
  head: () => ({
    meta: [
      { title: "Nouvelle demande d'intervention — SYGMA" },
      {
        name: "description",
        content:
          "Déclarez une panne ou un besoin d'intervention : équipement, description, priorité et pièces jointes.",
      },
      {
        property: "og:title",
        content: "Nouvelle demande d'intervention — SYGMA",
      },
      {
        property: "og:description",
        content: "Créez une demande d'intervention dans SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function NouvelleDemande() {
  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/demandes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux demandes
        </Link>
      </Button>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        Nouvelle demande d'intervention
      </h1>
      <div className="max-w-3xl rounded-lg border border-border bg-card p-4 sm:p-6">
        <DemandeForm />
      </div>
    </div>
  );
}
