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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  PRIORITES_DI,
  STATUTS_DI,
  formatDateTime,
  prioriteDiClasses,
  prioriteDiLabel,
  statutDiClasses,
  statutDiLabel,
  type Demande,
} from "@/lib/demandes";

export const Route = createFileRoute("/demandes/")({
  component: DemandesListe,
  head: () => ({
    meta: [
      { title: "Demandes d'intervention — SYGMA" },
      {
        name: "description",
        content:
          "Suivez les demandes d'intervention : statut, priorité, équipement, demandeur et technicien affecté.",
      },
      { property: "og:title", content: "Demandes d'intervention — SYGMA" },
      {
        property: "og:description",
        content: "Liste, recherche et filtres des demandes d'intervention.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Row = Demande & {
  equipements: { reference: string; designation: string } | null;
  demandeur: { nom: string | null; prenom: string | null } | null;
  technicien: { nom: string | null; prenom: string | null } | null;
};

function personName(p: { nom: string | null; prenom: string | null } | null) {
  if (!p) return "—";
  return [p.prenom, p.nom].filter(Boolean).join(" ") || "—";
}

function DemandesListe() {
  const { user, hasAnyRole } = useAuth();
  const [vue, setVue] = useState("toutes");
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("all");
  const [priorite, setPriorite] = useState("all");
  const [equipement, setEquipement] = useState("all");
  const [depuis, setDepuis] = useState("");

  const isTech = hasAnyRole(["technicien", "prestataire"]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["demandes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes_intervention")
        .select(
          "*, equipements(reference, designation), demandeur:profils_utilisateurs!demandes_intervention_demandeur_id_fkey(nom, prenom), technicien:profils_utilisateurs!demandes_intervention_technicien_id_fkey(nom, prenom)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const equipementsOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data ?? []) {
      if (d.equipement_id && d.equipements) {
        map.set(
          d.equipement_id,
          `${d.equipements.reference} — ${d.equipements.designation}`,
        );
      }
    }
    return Array.from(map.entries());
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      if (vue === "mes" && d.demandeur_id !== user?.id) return false;
      if (vue === "affectees" && d.technicien_id !== user?.id) return false;
      if (statut !== "all" && d.statut !== statut) return false;
      if (priorite !== "all" && d.priorite !== priorite) return false;
      if (equipement !== "all" && d.equipement_id !== equipement) return false;
      if (depuis && new Date(d.created_at) < new Date(depuis)) return false;
      if (!q) return true;
      return [
        d.description,
        d.localisation,
        d.equipements?.reference,
        d.equipements?.designation,
        personName(d.demandeur),
        personName(d.technicien),
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [data, vue, user?.id, search, statut, priorite, equipement, depuis]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Demandes d'intervention
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} demande{rows.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportMenu disabled={rows.length === 0} onExport={(f) => exportRows(rows.map((d) => ({ Date: fmtDate(d.created_at), Équipement: d.equipements ? `${d.equipements.reference} — ${d.equipements.designation}` : "", Description: d.description, Priorité: prioriteDiLabel(d.priorite), Statut: statutDiLabel(d.statut), Localisation: d.localisation ?? "", Demandeur: personName(d.demandeur), Technicien: personName(d.technicien) })), f, "Demandes d'intervention")} />
          <Button asChild>
          <Link to="/demandes/nouvelle">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle demande
          </Link>
        </Button>
        </div>
      </div>

      <Tabs value={vue} onValueChange={setVue} className="mb-4">
        <TabsList>
          <TabsTrigger value="toutes">Toutes</TabsTrigger>
          <TabsTrigger value="mes">Mes demandes</TabsTrigger>
          {isTech && (
            <TabsTrigger value="affectees">
              Mes interventions affectées
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger>
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_DI.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorite} onValueChange={setPriorite}>
          <SelectTrigger>
            <SelectValue placeholder="Priorité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les priorités</SelectItem>
            {PRIORITES_DI.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={equipement} onValueChange={setEquipement}>
          <SelectTrigger>
            <SelectValue placeholder="Équipement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les équipements</SelectItem>
            {equipementsOptions.map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={depuis}
          onChange={(e) => setDepuis(e.target.value)}
          aria-label="Demandes créées à partir du"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : isError ? (
          <div className="p-10 text-center text-sm text-destructive">
            Impossible de charger les demandes.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aucune demande ne correspond aux critères.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Équipement
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Demandeur
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Technicien
                  </TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <Link to="/demandes/$id" params={{ id: d.id }}>
                        {formatDateTime(d.created_at)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[24rem] font-medium">
                      <Link
                        to="/demandes/$id"
                        params={{ id: d.id }}
                        className="line-clamp-2"
                      >
                        {d.description}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {d.equipements
                        ? `${d.equipements.reference} — ${d.equipements.designation}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {personName(d.demandeur)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {personName(d.technicien)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${prioriteDiClasses(d.priorite)}`}
                      >
                        {prioriteDiLabel(d.priorite)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statutDiClasses(d.statut)}`}
                      >
                        {statutDiLabel(d.statut)}
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
