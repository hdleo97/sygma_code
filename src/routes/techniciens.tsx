import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ComptesUtilisateurs } from "@/components/comptes-utilisateurs";
import { useAuth } from "@/lib/auth-context";
import { formatDuree } from "@/lib/interventions";
import {
  DISPONIBILITES,
  disponibiliteClasses,
  disponibiliteLabel,
  fetchPlanningTechniciens,
  fetchTechnicienProfils,
  profilName,
  updateProfilTechnicien,
  type Profil,
} from "@/lib/techniciens";

export const Route = createFileRoute("/techniciens")({
  component: TechniciensPage,
  head: () => ({
    meta: [
      { title: "Techniciens et planning — SYGMA" },
      {
        name: "description",
        content:
          "Compétences, habilitations, disponibilité et charge de travail des techniciens de maintenance.",
      },
      { property: "og:title", content: "Techniciens et planning — SYGMA" },
      {
        property: "og:description",
        content:
          "Gérez les compétences des techniciens et visualisez leur planning d'interventions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function TechniciensPage() {
  const { currentEtablissementId, hasAnyRole } = useAuth();
  const canAdmin = hasAnyRole(["super_admin", "responsable_maintenance"]);
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<Profil | null>(null);

  const { data: techs, isLoading } = useQuery({
    queryKey: ["technicien-profils"],
    queryFn: fetchTechnicienProfils,
  });

  const { data: planning } = useQuery({
    queryKey: ["planning-techniciens", currentEtablissementId],
    queryFn: () => fetchPlanningTechniciens(currentEtablissementId),
  });

  const charge = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number }>();
    for (const p of planning ?? []) {
      const cur = map.get(p.technicien_id) ?? { count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += p.duree_estimee_minutes ?? 0;
      map.set(p.technicien_id, cur);
    }
    return map;
  }, [planning]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Techniciens
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Compétences, disponibilité et charge de travail des intervenants.
      </p>

      <Tabs defaultValue="equipe" className="mt-6">
        <TabsList>
          <TabsTrigger value="equipe">Équipe</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          {canAdmin && <TabsTrigger value="comptes">Comptes</TabsTrigger>}
        </TabsList>

        <TabsContent value="equipe" className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (techs ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Aucun technicien enregistré.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Technicien</th>
                    <th className="px-4 py-3">Compétences / habilitations</th>
                    <th className="px-4 py-3">Disponibilité</th>
                    <th className="px-4 py-3">Supérieur</th>
                    <th className="px-4 py-3">Charge</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(techs ?? []).map((t) => {
                    const c = charge.get(t.id);
                    const sup = (techs ?? []).find((x) => x.id === t.superieur_id);
                    return (
                      <tr key={t.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {profilName(t)}
                        </td>
                        <td className="px-4 py-3">
                          {t.competences.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {t.competences.map((k) => (
                                <span
                                  key={k}
                                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${disponibiliteClasses(t.disponibilite)}`}
                          >
                            {disponibiliteLabel(t.disponibilite)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {sup ? profilName(sup) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c ? `${c.count} interv. · ${formatDuree(c.minutes)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEdited(t)}
                          >
                            Modifier
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="planning" className="mt-4 space-y-4">
          {(techs ?? []).map((t) => {
            const items = (planning ?? []).filter(
              (p) => p.technicien_id === t.id,
            );
            return (
              <div
                key={t.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {profilName(t)}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {items.length} intervention(s) ·{" "}
                    {formatDuree(
                      items.reduce(
                        (s, i) => s + (i.duree_estimee_minutes ?? 0),
                        0,
                      ),
                    )}{" "}
                    estimées
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aucune intervention en cours ou à venir.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {items.map((i) => (
                      <li key={i.id}>
                        <Link
                          to="/interventions/$id"
                          params={{ id: i.id }}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                        >
                          <span className="truncate">{i.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {i.date_planifiee
                              ? new Date(i.date_planifiee).toLocaleString(
                                  "fr-FR",
                                )
                              : "Non planifiée"}{" "}
                            · {i.statut === "en_cours" ? "En cours" : "Planifiée"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </TabsContent>
        {canAdmin && (
          <TabsContent value="comptes" className="mt-4">
            <ComptesUtilisateurs />
          </TabsContent>
        )}
      </Tabs>

      <EditDialog
        profil={edited}
        profils={techs ?? []}
        onClose={() => setEdited(null)}
        onSaved={() => {
          setEdited(null);
          queryClient.invalidateQueries({ queryKey: ["technicien-profils"] });
        }}
      />
    </div>
  );
}

function EditDialog({
  profil,
  profils,
  onClose,
  onSaved,
}: {
  profil: Profil | null;
  profils: Profil[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [competences, setCompetences] = useState("");
  const [disponibilite, setDisponibilite] = useState("disponible");
  const [superieur, setSuperieur] = useState("none");
  const [initialised, setInitialised] = useState<string | null>(null);

  if (profil && initialised !== profil.id) {
    setInitialised(profil.id);
    setCompetences(profil.competences.join(", "));
    setDisponibilite(profil.disponibilite);
    setSuperieur(profil.superieur_id ?? "none");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!profil) return;
      await updateProfilTechnicien(profil.id, {
        competences: competences
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        disponibilite,
        superieur_id: superieur === "none" ? null : superieur,
      });
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible"),
  });

  return (
    <Dialog open={!!profil} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {profil ? profilName(profil) : "Technicien"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="competences">
              Compétences / habilitations (séparées par des virgules)
            </Label>
            <Input
              id="competences"
              value={competences}
              onChange={(e) => setCompetences(e.target.value)}
              placeholder="Électricité BT, Habilitation B2V, Soudure"
            />
          </div>
          <div className="space-y-2">
            <Label>Disponibilité</Label>
            <Select value={disponibilite} onValueChange={setDisponibilite}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPONIBILITES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supérieur hiérarchique</Label>
            <Select value={superieur} onValueChange={setSuperieur}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {profils
                  .filter((p) => p.id !== profil?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {profilName(p)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
