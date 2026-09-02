import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Loader2, Plus } from "lucide-react";
import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/etablissements")({
  component: EtablissementsPage,
  head: () => ({
    meta: [
      { title: "Établissements et vue consolidée — SYGMA" },
      {
        name: "description",
        content:
          "Gérez vos sites de maintenance et comparez leurs indicateurs clés : équipements, demandes et interventions.",
      },
      { property: "og:title", content: "Établissements — SYGMA" },
      {
        property: "og:description",
        content:
          "Écran de gestion des établissements et tableau consolidé multi-sites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Etab = Tables<"etablissements">;

type FormState = {
  id?: string;
  nom: string;
  adresse: string;
  responsable: string;
  contact: string;
};

const EMPTY: FormState = { nom: "", adresse: "", responsable: "", contact: "" };

type Kpi = {
  etablissement_id: string;
  equipements: number;
  equipementsEnPanne: number;
  demandesOuvertes: number;
  interventionsEnCours: number;
  interventionsSignees: number;
};

function EtablissementsPage() {
  const { hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const canCreate = hasAnyRole(["super_admin", "responsable_maintenance"]);
  const canEdit = hasAnyRole([
    "super_admin",
    "responsable_maintenance",
    "responsable_etablissement",
  ]);

  const { data: etabs, isLoading } = useQuery({
    queryKey: ["etablissements-gestion"],
    queryFn: async (): Promise<Etab[]> => {
      const { data, error } = await supabase
        .from("etablissements")
        .select("*")
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: kpis } = useQuery({
    queryKey: ["etablissements-kpis"],
    queryFn: async (): Promise<Kpi[]> => {
      const [eq, di, itv] = await Promise.all([
        supabase.from("equipements").select("etablissement_id, statut"),
        supabase.from("demandes_intervention").select("etablissement_id, statut"),
        supabase.from("interventions").select("etablissement_id, statut"),
      ]);
      if (eq.error) throw eq.error;
      if (di.error) throw di.error;
      if (itv.error) throw itv.error;

      const map = new Map<string, Kpi>();
      const get = (id: string) => {
        let k = map.get(id);
        if (!k) {
          k = {
            etablissement_id: id,
            equipements: 0,
            equipementsEnPanne: 0,
            demandesOuvertes: 0,
            interventionsEnCours: 0,
            interventionsSignees: 0,
          };
          map.set(id, k);
        }
        return k;
      };

      for (const r of eq.data ?? []) {
        const k = get(r.etablissement_id);
        k.equipements += 1;
        if (r.statut === "en_panne") k.equipementsEnPanne += 1;
      }
      for (const r of di.data ?? []) {
        const k = get(r.etablissement_id);
        if (r.statut !== "cloturee" && r.statut !== "refusee")
          k.demandesOuvertes += 1;
      }
      for (const r of itv.data ?? []) {
        const k = get(r.etablissement_id);
        if (r.statut === "planifiee" || r.statut === "en_cours")
          k.interventionsEnCours += 1;
        if (r.statut === "signee") k.interventionsSignees += 1;
      }
      return [...map.values()];
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        nom: f.nom,
        adresse: f.adresse || null,
        responsable: f.responsable || null,
        contact: f.contact || null,
      };
      const { error } = f.id
        ? await supabase.from("etablissements").update(payload).eq("id", f.id)
        : await supabase.from("etablissements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Établissement enregistré");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["etablissements-gestion"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible"),
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Établissements
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion des sites et comparaison consolidée des indicateurs.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setForm({ ...EMPTY })}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel établissement
          </Button>
        )}
      </div>

      <Tabs defaultValue="gestion" className="mt-6">
        <TabsList>
          <TabsTrigger value="gestion">Gestion</TabsTrigger>
          <TabsTrigger value="consolide">Vue consolidée</TabsTrigger>
        </TabsList>

        <TabsContent value="gestion" className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Adresse</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(etabs ?? []).map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {e.nom}
                      </td>
                      <td className="px-4 py-3">{e.adresse ?? "—"}</td>
                      <td className="px-4 py-3">{e.responsable ?? "—"}</td>
                      <td className="px-4 py-3">{e.contact ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setForm({
                                id: e.id,
                                nom: e.nom,
                                adresse: e.adresse ?? "",
                                responsable: e.responsable ?? "",
                                contact: e.contact ?? "",
                              })
                            }
                          >
                            Modifier
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="consolide" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Site</th>
                  <th className="px-4 py-3">Équipements</th>
                  <th className="px-4 py-3">En panne</th>
                  <th className="px-4 py-3">DI ouvertes</th>
                  <th className="px-4 py-3">Interventions en cours</th>
                  <th className="px-4 py-3">Rapports signés</th>
                </tr>
              </thead>
              <tbody>
                {(etabs ?? []).map((e) => {
                  const k = kpis?.find((x) => x.etablissement_id === e.id);
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {e.nom}
                      </td>
                      <td className="px-4 py-3">{k?.equipements ?? 0}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            (k?.equipementsEnPanne ?? 0) > 0
                              ? "font-medium text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {k?.equipementsEnPanne ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">{k?.demandesOuvertes ?? 0}</td>
                      <td className="px-4 py-3">
                        {k?.interventionsEnCours ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        {k?.interventionsSignees ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Modifier l'établissement" : "Nouvel établissement"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adresse">Adresse</Label>
                <Input
                  id="adresse"
                  value={form.adresse}
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsable">Responsable</Label>
                <Input
                  id="responsable"
                  value={form.responsable}
                  onChange={(e) =>
                    setForm({ ...form, responsable: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact</Label>
                <Input
                  id="contact"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Annuler
            </Button>
            <Button
              disabled={save.isPending || !form?.nom}
              onClick={() => form && save.mutate(form)}
            >
              {save.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
