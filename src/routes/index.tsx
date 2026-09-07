import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Gauge,
  Loader2,
  Timer,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import {
  computeKpis,
  fetchDashboardData,
  type DashboardFilters,
} from "@/lib/dashboard";
import { fetchTechniciens, technicienName } from "@/lib/interventions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "SYGMA — Tableau de bord maintenance" },
      {
        name: "description",
        content:
          "Indicateurs de maintenance SYGMA : demandes, disponibilité des équipements, MTTR, MTBF, préventif et alertes stock.",
      },
      { property: "og:title", content: "SYGMA — Tableau de bord maintenance" },
      {
        property: "og:description",
        content:
          "Vue consolidée des indicateurs de maintenance : DI, interventions, disponibilité, MTTR/MTBF et stocks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "#64748b",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

function Dashboard() {
  const {
    user,
    loading: authLoading,
    etablissements,
    currentEtablissementId,
    isGlobal,
    hasAnyRole,
  } = useAuth();

  const restreint = !isGlobal && hasAnyRole(["technicien", "prestataire"]);

  const [from, setFrom] = useState(isoDaysAgo(180));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [etab, setEtab] = useState<string>("all");
  const [categorie, setCategorie] = useState<string>("all");
  const [technicien, setTechnicien] = useState<string>("all");

  const effectiveEtab =
    etab !== "all"
      ? etab
      : (currentEtablissementId ??
        (etablissements.length === 1 ? etablissements[0].id : null));

  const filters: DashboardFilters = useMemo(
    () => ({
      from,
      to,
      etablissementId: effectiveEtab,
      categorie: categorie === "all" ? null : categorie,
      technicienId: restreint
        ? (user?.id ?? null)
        : technicien === "all"
          ? null
          : technicien,
    }),
    [from, to, effectiveEtab, categorie, technicien, restreint, user?.id],
  );

  const { data: techniciens = [] } = useQuery({
    queryKey: ["dash-techniciens"],
    queryFn: fetchTechniciens,
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["dash-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipements")
        .select("categorie")
        .not("categorie", "is", null);
      if (error) throw error;
      return [
        ...new Set((data ?? []).map((r) => r.categorie as string)),
      ].sort();
    },
    enabled: !!user,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => fetchDashboardData(filters),
    enabled: !!user,
  });

  const technicienNames = useMemo(
    () => new Map(techniciens.map((t) => [t.id, technicienName(t)])),
    [techniciens],
  );

  const kpis = useMemo(
    () => (data ? computeKpis(data, filters, technicienNames) : null),
    [data, filters, technicienNames],
  );

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold tracking-tight">SYGMA</h1>
          <p className="mt-2 text-muted-foreground">
            Connectez-vous pour accéder au tableau de bord de maintenance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          {restreint
            ? "Vos indicateurs personnels de maintenance."
            : "Vue consolidée des indicateurs de maintenance."}
        </p>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Du</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Au</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Établissement</Label>
            <Select value={etab} onValueChange={setEtab}>
              <SelectTrigger>
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {etablissements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Catégorie d'équipement</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Technicien</Label>
            <Select
              value={restreint ? "me" : technicien}
              onValueChange={setTechnicien}
              disabled={restreint}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                {restreint ? (
                  <SelectItem value="me">Moi</SelectItem>
                ) : (
                  <>
                    <SelectItem value="all">Tous</SelectItem>
                    {techniciens.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {technicienName(t)}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">
            Impossible de charger les indicateurs : {(error as Error)?.message}
          </CardContent>
        </Card>
      ) : kpis ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Kpi
              icon={ClipboardList}
              label="Demandes d'intervention"
              value={String(kpis.totalDi)}
              hint="sur la période"
            />
            <Kpi
              icon={Gauge}
              label="Disponibilité parc"
              value={`${kpis.tauxDisponibilite} %`}
              hint={`${kpis.equipementsEnService}/${kpis.equipementsTotal} en service`}
            />
            <Kpi
              icon={Timer}
              label="MTTR"
              value={
                kpis.mttrMinutes === null
                  ? "—"
                  : `${Math.floor(kpis.mttrMinutes / 60)} h ${kpis.mttrMinutes % 60} min`
              }
              hint="durée moyenne de réparation"
            />
            <Kpi
              icon={Activity}
              label="MTBF"
              value={kpis.mtbfHeures === null ? "—" : `${kpis.mtbfHeures} h`}
              hint="temps moyen entre pannes"
            />
            <Kpi
              icon={Wrench}
              label="Plan préventif réalisé"
              value={`${kpis.tauxPreventif} %`}
              hint={`${kpis.preventifRealisees}/${kpis.preventifTotal} interventions`}
            />
            <Kpi
              icon={AlertTriangle}
              label="Alertes stock"
              value={String(data?.alertesStock.length ?? 0)}
              hint="pièces sous le seuil"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Demandes d'intervention par statut">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.diParStatut}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} dy={8} height={50} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Interventions par type">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={kpis.parNature}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    label
                  >
                    {kpis.parNature.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Interventions par statut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={kpis.parStatutIntervention}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={85}
                    label
                  >
                    {kpis.parStatutIntervention.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Taux de réalisation du plan préventif">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="65%"
                  outerRadius="100%"
                  startAngle={210}
                  endAngle={-30}
                  data={[{ name: "Réalisé", value: kpis.tauxPreventif, fill: COLORS[0] }]}
                >
                  <RadialBar background dataKey="value" cornerRadius={8} />
                  <Tooltip />
                </RadialBarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Interventions par technicien">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.parTechnicien} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Interventions par équipement">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.parEquipement} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[5]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Évolution mensuelle des interventions">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpis.evolution}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="mois" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="curative"
                    name="Curative"
                    stroke={COLORS[1]}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="preventive"
                    name="Préventive"
                    stroke={COLORS[0]}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Top 5 des équipements les plus en panne
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kpis.topPannes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune panne enregistrée sur la période.
                  </p>
                ) : (
                  kpis.topPannes.map((e, i) => (
                    <div
                      key={e.name}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="truncate">
                        {i + 1}. {e.name}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {e.value} panne{e.value > 1 ? "s" : ""}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {!restreint && (data?.alertesStock.length ?? 0) > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Alertes stock actives
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data!.alertesStock.map((a) => (
                  <div
                    key={`${a.piece_id}:${a.magasin_id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      {a.code_article} — {a.designation}{" "}
                      <span className="text-muted-foreground">({a.magasin})</span>
                    </span>
                    <span className="font-semibold text-destructive">
                      {a.quantite} / seuil {a.seuil}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
