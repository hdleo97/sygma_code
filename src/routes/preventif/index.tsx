import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  echeanceClasses,
  echeanceLabel,
  fetchPlans,
  fetchPreventifsPlanifies,
  fetchVisites,
  formatDateHeure,
  genererPreventifs,
  niveauEcheance,
  setPlanActif,
  updateReleveCompteur,
} from "@/lib/preventif";

export const Route = createFileRoute("/preventif/")({
  component: PreventifPage,
  head: () => ({
    meta: [
      { title: "Préventif — Plans et calendrier SYGMA" },
      {
        name: "description",
        content:
          "Planifiez la maintenance préventive : plans par temps ou compteur, calendrier des échéances et visites quotidiennes.",
      },
      { property: "og:title", content: "Maintenance préventive — SYGMA" },
      {
        property: "og:description",
        content:
          "Calendrier des interventions préventives à venir et gestion des plans de maintenance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function moisLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function Calendrier() {
  const [mois, setMois] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { data, isLoading } = useQuery({
    queryKey: ["preventifs-planifies"],
    queryFn: fetchPreventifsPlanifies,
  });

  const parJour = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>>();
    for (const i of data ?? []) {
      if (!i.date_planifiee) continue;
      const d = new Date(i.date_planifiee);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(i);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const cases = useMemo(() => {
    const premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
    const decalage = (premier.getDay() + 6) % 7;
    const nbJours = new Date(
      mois.getFullYear(),
      mois.getMonth() + 1,
      0,
    ).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < decalage; i++) out.push(null);
    for (let j = 1; j <= nbJours; j++)
      out.push(new Date(mois.getFullYear(), mois.getMonth(), j));
    return out;
  }, [mois]);

  const enRetard = (data ?? []).filter(
    (i) => niveauEcheance(i.date_planifiee) === "depassee",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))
            }
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium capitalize">
            {moisLabel(mois)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))
            }
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {enRetard.length > 0 && (
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            {enRetard.length} échéance(s) dépassée(s)
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {JOURS.map((j) => (
                <div key={j} className="py-1">
                  {j}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cases.map((d, idx) => {
                if (!d)
                  return <div key={`v-${idx}`} className="min-h-24 rounded-md" />;
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                const items = parJour.get(key) ?? [];
                const aujourdhui =
                  d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={key}
                    className={`min-h-24 rounded-md border p-1 ${
                      aujourdhui
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="mb-1 text-right text-xs text-muted-foreground">
                      {d.getDate()}
                    </div>
                    <div className="space-y-1">
                      {items.map((i) => {
                        const n = niveauEcheance(i.date_planifiee);
                        return (
                          <Link
                            key={i.id}
                            to="/interventions/$id"
                            params={{ id: i.id }}
                            className={`block truncate rounded border px-1 py-0.5 text-[11px] ${echeanceClasses(n)}`}
                            title={`${i.equipements?.reference ?? ""} — ${i.description}`}
                          >
                            {i.equipements?.reference ?? "Équipement"} —{" "}
                            {i.description}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Prochaines échéances
        </h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Équipement</TableHead>
                <TableHead>Intervention</TableHead>
                <TableHead>Date planifiée</TableHead>
                <TableHead>Alerte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Aucune intervention préventive planifiée.
                  </TableCell>
                </TableRow>
              )}
              {(data ?? []).map((i) => {
                const n = niveauEcheance(i.date_planifiee);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap">
                      {i.equipements
                        ? `${i.equipements.reference} — ${i.equipements.designation}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/interventions/$id"
                        params={{ id: i.id }}
                        className="text-primary hover:underline"
                      >
                        {i.description}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateHeure(i.date_planifiee)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${echeanceClasses(n)}`}
                      >
                        {echeanceLabel(n)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function Plans() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["plans-preventifs"],
    queryFn: fetchPlans,
  });

  const toggle = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) =>
      setPlanActif(id, actif),
    onSuccess: () => {
      toast.success("Plan mis à jour");
      void qc.invalidateQueries({ queryKey: ["plans-preventifs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releve = useMutation({
    mutationFn: ({ id, valeur }: { id: string; valeur: number }) =>
      updateReleveCompteur(id, valeur),
    onSuccess: () => {
      toast.success("Relevé enregistré");
      void qc.invalidateQueries({ queryKey: ["plans-preventifs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  if ((data ?? []).length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Aucun plan préventif défini.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {(data ?? []).map((p) => (
        <section
          key={p.id}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-foreground">{p.libelle}</h3>
              <p className="text-sm text-muted-foreground">
                {p.equipements
                  ? `${p.equipements.reference} — ${p.equipements.designation}`
                  : `Catégorie : ${p.categorie_equipement}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.periodicite === "temps"
                  ? `Tous les ${p.periodicite_valeur} jour(s)`
                  : `Toutes les ${p.periodicite_valeur} ${p.unite_compteur ?? "unités"}`}
                {p.checklist_categorie
                  ? ` · Gamme : ${p.checklist_categorie}`
                  : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: p.id, actif: !p.actif })}
            >
              {p.actif ? "Désactiver" : "Activer"}
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {p.plan_echeances.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune échéance encore initialisée — lancez la génération.
              </p>
            )}
            {p.plan_echeances.map((e) => {
              const n = niveauEcheance(e.prochaine_echeance);
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {e.equipements
                      ? `${e.equipements.reference} — ${e.equipements.designation}`
                      : "Équipement"}
                  </span>
                  {p.periodicite === "temps" ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${echeanceClasses(n)}`}
                    >
                      {echeanceLabel(n)} · {formatDateHeure(e.prochaine_echeance)}
                    </span>
                  ) : (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        const fd = new FormData(ev.currentTarget);
                        const v = Number(fd.get("releve"));
                        if (Number.isFinite(v))
                          releve.mutate({ id: e.id, valeur: v });
                      }}
                    >
                      <span className="text-xs text-muted-foreground">
                        Relevé compteur ({p.unite_compteur ?? "unités"}) :
                      </span>
                      <Input
                        name="releve"
                        type="number"
                        step="any"
                        defaultValue={Number(e.compteur_releve)}
                        className="h-8 w-28"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Enregistrer
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Dernier déclenchement :{" "}
                        {Number(e.compteur_dernier_declenchement)}
                      </span>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Visites() {
  const { data, isLoading } = useQuery({
    queryKey: ["visites-quotidiennes"],
    queryFn: fetchVisites,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Équipement</TableHead>
            <TableHead>Signée par</TableHead>
            <TableHead>Observations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                Aucune visite quotidienne enregistrée.
              </TableCell>
            </TableRow>
          )}
          {(data ?? []).map((v) => (
            <TableRow key={v.id}>
              <TableCell className="whitespace-nowrap">
                {formatDateHeure(v.date_visite)}
              </TableCell>
              <TableCell>
                {v.equipements
                  ? `${v.equipements.reference} — ${v.equipements.designation}`
                  : "—"}
              </TableCell>
              <TableCell>{v.signature_nom ?? "—"}</TableCell>
              <TableCell className="max-w-xs truncate">
                {v.observations ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PreventifPage() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const peutGerer = hasAnyRole([
    "super_admin",
    "responsable_maintenance",
    "responsable_etablissement",
  ]);

  const generer = useMutation({
    mutationFn: genererPreventifs,
    onSuccess: (n) => {
      toast.success(
        n > 0
          ? `${n} intervention(s) préventive(s) générée(s)`
          : "Aucune échéance atteinte",
      );
      void qc.invalidateQueries({ queryKey: ["preventifs-planifies"] });
      void qc.invalidateQueries({ queryKey: ["plans-preventifs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <CalendarClock className="h-6 w-6" />
            Maintenance préventive
          </h1>
          <p className="text-sm text-muted-foreground">
            Plans périodiques, calendrier des échéances et visites quotidiennes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/preventif/visite">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Visite quotidienne
            </Link>
          </Button>
          {peutGerer && (
            <>
              <Button
                variant="outline"
                disabled={generer.isPending}
                onClick={() => generer.mutate()}
              >
                {generer.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Générer les échéances
              </Button>
              <Button asChild>
                <Link to="/preventif/nouveau">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau plan
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="calendrier">
        <TabsList>
          <TabsTrigger value="calendrier">Calendrier</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="visites">Visites quotidiennes</TabsTrigger>
        </TabsList>
        <TabsContent value="calendrier" className="mt-4">
          <Calendrier />
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <Plans />
        </TabsContent>
        <TabsContent value="visites" className="mt-4">
          <Visites />
        </TabsContent>
      </Tabs>
    </div>
  );
}
