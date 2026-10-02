import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, Download, FileText, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUTS_DI } from "@/lib/demandes";
import { buildExport, downloadBlob, fmtDate, slug, type ExportFormat } from "@/lib/exports";
import {
  NATURES_INTERVENTION,
  STATUTS_INTERVENTION,
  fetchTechniciens,
  technicienName,
} from "@/lib/interventions";
import {
  RAPPORT_TYPES,
  SOURCES,
  fetchRapports,
  fetchSourceRows,
  rapportTypeLabel,
  rapportUrl,
  saveRapport,
  type FiltresRapport,
} from "@/lib/rapports";
import { moisPrecedent } from "@/lib/rapports-format";

export const Route = createFileRoute("/rapports")({
  component: RapportsPage,
  head: () => ({
    meta: [
      { title: "Rapports — SYGMA" },
      {
        name: "description",
        content:
          "Bibliothèque des rapports générés et création de rapports personnalisés (PDF, Excel).",
      },
      { property: "og:title", content: "Rapports — SYGMA" },
      {
        property: "og:description",
        content: "Consultez, générez et téléchargez vos rapports de maintenance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function useEquipements() {
  return useQuery({
    queryKey: ["rapports-equipements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipements")
        .select("id, reference, designation, etablissement_id")
        .order("reference");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function RapportsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
        <p className="text-sm text-muted-foreground">
          Bibliothèque des rapports générés et création de rapports personnalisés.
        </p>
      </div>
      <Tabs defaultValue="bibliotheque">
        <TabsList>
          <TabsTrigger value="bibliotheque">Bibliothèque</TabsTrigger>
          <TabsTrigger value="personnalise">Rapport personnalisé</TabsTrigger>
        </TabsList>
        <TabsContent value="bibliotheque" className="mt-4">
          <Bibliotheque />
        </TabsContent>
        <TabsContent value="personnalise" className="mt-4">
          <Generateur />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Bibliotheque() {
  const { etablissements, user } = useAuth();
  const qc = useQueryClient();
  const { data: equipements } = useEquipements();
  const { data, isLoading } = useQuery({ queryKey: ["rapports"], queryFn: fetchRapports });
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [etab, setEtab] = useState("all");
  const [equip, setEquip] = useState("all");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (etab !== "all" && r.etablissement_id !== etab) return false;
      if (equip !== "all" && r.equipement_id !== equip) return false;
      if (du && r.created_at.slice(0, 10) < du) return false;
      if (au && r.created_at.slice(0, 10) > au) return false;
      return !t || r.titre.toLowerCase().includes(t);
    });
  }, [data, q, type, etab, equip, du, au]);

  const ouvrir = async (path: string) => {
    const url = await rapportUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Fichier introuvable");
  };

  const genererMensuel = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const m = moisPrecedent();
      const filtres: FiltresRapport = {
        source: "visites", du: m.debut, au: m.fin, etablissement: "all",
        equipement: "all", technicien: "all", statut: "all", nature: "all",
      };
      const lignes = await fetchSourceRows(filtres);
      const titre = `Rapport mensuel des visites quotidiennes — ${m.label}`;
      const blob = buildExport(lignes, "pdf", titre, {
        sousTitre: `${lignes.length} visite(s) du ${m.debut} au ${m.fin}`,
      });
      await saveRapport({
        blob, format: "pdf", type: "mensuel_preventif", titre, filtres,
        periode_debut: m.debut, periode_fin: m.fin, userId: user.id,
      });
      downloadBlob(blob, `${slug(titre)}.pdf`);
      qc.invalidateQueries({ queryKey: ["rapports"] });
      toast.success("Rapport mensuel généré");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{rows.length} rapport(s)</CardTitle>
        <Button variant="outline" onClick={genererMensuel} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarRange className="mr-2 h-4 w-4" />}
          Générer le mensuel du mois dernier
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {RAPPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={etab} onValueChange={setEtab}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous établissements</SelectItem>
              {etablissements.map((e) => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={equip} onValueChange={setEquip}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous équipements</SelectItem>
              {(equipements ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.reference} — {e.designation}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} aria-label="Du" />
            <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} aria-label="Au" />
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun rapport.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{r.titre}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rapportTypeLabel(r.type)} · {r.format.toUpperCase()} · {fmtDate(r.created_at)}
                    {r.etablissements ? ` · ${r.etablissements.nom}` : ""}
                    {r.equipements ? ` · ${r.equipements.reference}` : ""}
                    {" · "}
                    {r.profils_utilisateurs
                      ? [r.profils_utilisateurs.prenom, r.profils_utilisateurs.nom].filter(Boolean).join(" ")
                      : "Automatique"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => ouvrir(r.fichier_path)}>
                  <Download className="mr-1 h-4 w-4" /> Télécharger
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Generateur() {
  const { etablissements, user } = useAuth();
  const qc = useQueryClient();
  const { data: equipements } = useEquipements();
  const { data: techniciens } = useQuery({ queryKey: ["techniciens-options"], queryFn: fetchTechniciens });
  const [f, setF] = useState<FiltresRapport>({
    source: "interventions", du: moisPrecedent().debut, au: new Date().toISOString().slice(0, 10),
    etablissement: "all", equipement: "all", technicien: "all", statut: "all", nature: "all",
  });
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const set = (k: keyof FiltresRapport) => (v: string) =>
    setF((p) => ({ ...p, [k]: v, ...(k === "source" ? { statut: "all", nature: "all" } : {}) }));

  const statuts =
    f.source === "interventions"
      ? STATUTS_INTERVENTION
      : f.source === "demandes"
        ? STATUTS_DI
        : [{ value: "signee", label: "Signée" }, { value: "non_signee", label: "Non signée" }];

  const equipsFiltres = (equipements ?? []).filter(
    (e) => f.etablissement === "all" || e.etablissement_id === f.etablissement,
  );

  const generer = async (format: ExportFormat) => {
    if (!user) return;
    setBusy(format);
    try {
      const lignes = await fetchSourceRows(f);
      const src = SOURCES.find((s) => s.value === f.source)!;
      const titre = `${src.label} — du ${f.du || "début"} au ${f.au || "aujourd'hui"}`;
      const blob = buildExport(lignes, format, titre, { sousTitre: `${lignes.length} ligne(s)` });
      downloadBlob(blob, `${slug(titre)}.${format}`);
      await saveRapport({
        blob, format, type: "personnalise", titre, filtres: f,
        etablissement_id: f.etablissement === "all" ? null : f.etablissement,
        equipement_id: f.equipement === "all" ? null : f.equipement,
        periode_debut: f.du || null, periode_fin: f.au || null, userId: user.id,
      });
      qc.invalidateQueries({ queryKey: ["rapports"] });
      toast.success(`Rapport généré (${lignes.length} ligne(s)) et ajouté à la bibliothèque`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const Champ = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Combinaison de filtres</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Champ label="Type de données">
            <Select value={f.source} onValueChange={set("source")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Champ>
          <Champ label="Du"><Input type="date" value={f.du} onChange={(e) => set("du")(e.target.value)} /></Champ>
          <Champ label="Au"><Input type="date" value={f.au} onChange={(e) => set("au")(e.target.value)} /></Champ>
          <Champ label="Établissement">
            <Select value={f.etablissement} onValueChange={(v) => setF((p) => ({ ...p, etablissement: v, equipement: "all" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {etablissements.map((e) => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </Champ>
          <Champ label="Équipement">
            <Select value={f.equipement} onValueChange={set("equipement")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {equipsFiltres.map((e) => <SelectItem key={e.id} value={e.id}>{e.reference} — {e.designation}</SelectItem>)}
              </SelectContent>
            </Select>
          </Champ>
          <Champ label="Technicien">
            <Select value={f.technicien} onValueChange={set("technicien")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(techniciens ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{technicienName(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Champ>
          <Champ label="Statut">
            <Select value={f.statut} onValueChange={set("statut")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {statuts.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Champ>
          {f.source === "interventions" ? (
            <Champ label="Nature">
              <Select value={f.nature} onValueChange={set("nature")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {NATURES_INTERVENTION.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Champ>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => generer("pdf")} disabled={!!busy}>
            {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Générer en PDF
          </Button>
          <Button variant="outline" onClick={() => generer("xlsx")} disabled={!!busy}>
            {busy === "xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Générer en Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
