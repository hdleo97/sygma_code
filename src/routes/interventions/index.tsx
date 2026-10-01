import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ExportMenu } from "@/components/export-menu";
import { exportRows, fmtDate } from "@/lib/exports";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/demandes";
import {
  NATURES_INTERVENTION,
  STATUTS_INTERVENTION,
  formatDuree,
  natureInterventionLabel,
  statutInterventionClasses,
  statutInterventionLabel,
  type Intervention,
} from "@/lib/interventions";

export const Route = createFileRoute("/interventions/")({
  component: ListeInterventions,
  head: () => ({
    meta: [
      { title: "Interventions — SYGMA" },
      {
        name: "description",
        content:
          "Suivi des interventions curatives et préventives : planification, techniciens affectés, durées et statuts.",
      },
      { property: "og:title", content: "Interventions — SYGMA" },
      {
        property: "og:description",
        content: "Planifiez et suivez les interventions de maintenance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = Intervention & {
  equipements: { reference: string; designation: string } | null;
  intervention_techniciens: {
    technicien_id: string;
    profils_utilisateurs: { nom: string | null; prenom: string | null } | null;
  }[];
};

function ListeInterventions() {
  const { user, currentEtablissementId } = useAuth();
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("all");
  const [nature, setNature] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["interventions", currentEtablissementId],
    queryFn: async () => {
      let query = supabase
        .from("interventions")
        .select(
          "*, equipements(reference, designation), intervention_techniciens(technicien_id, profils_utilisateurs:profils_utilisateurs!intervention_techniciens_technicien_id_fkey(nom, prenom))",
        )
        .order("created_at", { ascending: false });
      if (currentEtablissementId)
        query = query.eq("etablissement_id", currentEtablissementId);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (statut !== "all" && r.statut !== statut) return false;
      if (nature !== "all" && r.nature !== nature) return false;
      if (
        onlyMine &&
        !r.intervention_techniciens.some((t) => t.technicien_id === user?.id)
      )
        return false;
      if (!term) return true;
      return [
        r.description,
        r.localisation ?? "",
        r.equipements?.reference ?? "",
        r.equipements?.designation ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, q, statut, nature, onlyMine, user?.id]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Interventions
          </h1>
          <p className="text-sm text-muted-foreground">
            Planification, exécution et rapports d'intervention.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu disabled={rows.length === 0} onExport={(f) => exportRows(rows.map((r) => ({ Créée: fmtDate(r.created_at), Équipement: r.equipements ? `${r.equipements.reference} — ${r.equipements.designation}` : "", Description: r.description, Nature: natureInterventionLabel(r.nature), Statut: statutInterventionLabel(r.statut), Début: fmtDate(r.date_debut), Fin: fmtDate(r.date_fin), Durée: formatDuree(r.duree_minutes), Techniciens: r.intervention_techniciens.map((t) => [t.profils_utilisateurs?.prenom, t.profils_utilisateurs?.nom].filter(Boolean).join(" ")).join(", ") })), f, "Historique des interventions")} />
          <Button asChild>
          <Link to="/interventions/nouvelle">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle intervention
          </Link>
        </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (description, équipement, zone)"
            className="pl-8"
          />
        </div>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_INTERVENTION.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={nature} onValueChange={setNature}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Nature" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes natures</SelectItem>
            {NATURES_INTERVENTION.map((n) => (
              <SelectItem key={n.value} value={n.value}>
                {n.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={onlyMine ? "default" : "outline"}
          onClick={() => setOnlyMine((v) => !v)}
        >
          Mes interventions
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucune intervention.
          </p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Équipement</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Nature</th>
                <th className="px-3 py-2">Planifiée le</th>
                <th className="px-3 py-2">Durée</th>
                <th className="px-3 py-2">Techniciens</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2">
                    <Link
                      to="/interventions/$id"
                      params={{ id: r.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.equipements
                        ? `${r.equipements.reference} — ${r.equipements.designation}`
                        : "Sans équipement"}
                    </Link>
                  </td>
                  <td className="max-w-72 truncate px-3 py-2">
                    {r.description}
                  </td>
                  <td className="px-3 py-2">
                    {natureInterventionLabel(r.nature)}
                  </td>
                  <td className="px-3 py-2">
                    {formatDateTime(r.date_planifiee)}
                  </td>
                  <td className="px-3 py-2">{formatDuree(r.duree_minutes)}</td>
                  <td className="px-3 py-2">
                    {r.intervention_techniciens.length === 0
                      ? "—"
                      : r.intervention_techniciens
                          .map(
                            (t) =>
                              [
                                t.profils_utilisateurs?.prenom,
                                t.profils_utilisateurs?.nom,
                              ]
                                .filter(Boolean)
                                .join(" ") || "—",
                          )
                          .join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutInterventionClasses(r.statut)}`}
                    >
                      {statutInterventionLabel(r.statut)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
