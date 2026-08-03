import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
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
import {
  exporterFicheDeVieExcel,
  fetchFicheDeVie,
  formatDateFdv,
} from "@/lib/fiche-de-vie";
import {
  formatDuree,
  natureInterventionLabel,
  statutInterventionLabel,
  type InterventionNature,
} from "@/lib/interventions";
import { exporterRapportPdf } from "@/lib/rapport-pdf";

type Props = {
  equipementId: string;
  equipementLabel: string;
};

export function FicheDeVie({ equipementId, equipementLabel }: Props) {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [nature, setNature] = useState<InterventionNature | "toutes">("toutes");
  const [pdfId, setPdfId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fiche-de-vie", equipementId, du, au, nature],
    queryFn: () => fetchFicheDeVie(equipementId, { du, au, nature }),
  });

  const rows = data ?? [];

  const exportPdf = (interventionId: string) => {
    setPdfId(interventionId);
    exporterRapportPdf(interventionId)
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Export PDF impossible"),
      )
      .finally(() => setPdfId(null));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="fdv-du">Du</Label>
          <Input
            id="fdv-du"
            type="date"
            className="w-40"
            value={du}
            onChange={(e) => setDu(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fdv-au">Au</Label>
          <Input
            id="fdv-au"
            type="date"
            className="w-40"
            value={au}
            onChange={(e) => setAu(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type d'intervention</Label>
          <Select
            value={nature}
            onValueChange={(v) => setNature(v as InterventionNature | "toutes")}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes</SelectItem>
              <SelectItem value="curative">Curative</SelectItem>
              <SelectItem value="preventive">Préventive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(du || au || nature !== "toutes") && (
          <Button
            variant="ghost"
            onClick={() => {
              setDu("");
              setAu("");
              setNature("toutes");
            }}
          >
            Réinitialiser
          </Button>
        )}
        <Button
          variant="outline"
          className="ml-auto"
          disabled={rows.length === 0}
          onClick={() => exporterFicheDeVieExcel(rows, equipementLabel)}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exporter la fiche de vie en Excel
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la fiche de
          vie…
        </div>
      ) : isError ? (
        <p className="p-6 text-sm text-destructive">
          Impossible de charger la fiche de vie.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Aucun événement enregistré
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Les interventions signées apparaîtront ici automatiquement.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatDateFdv(r.date_evenement)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {natureInterventionLabel(r.nature)}
                    </span>
                    <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {statutInterventionLabel(r.statut_final)}
                    </span>
                    <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {formatDuree(r.interventions?.duree_minutes ?? null)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pdfId === r.intervention_id}
                    onClick={() => exportPdf(r.intervention_id)}
                  >
                    {pdfId === r.intervention_id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Rapport PDF
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      to="/interventions/$id"
                      params={{ id: r.intervention_id }}
                    >
                      Ouvrir
                    </Link>
                  </Button>
                </div>
              </div>
              {r.techniciens && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Technicien(s) : {r.techniciens}
                </p>
              )}
              {r.resume && (
                <p className="mt-1 text-sm text-foreground">{r.resume}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
