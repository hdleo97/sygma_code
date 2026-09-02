import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  NATURES_INTERVENTION,
  fetchTechniciens,
  fromLocalInput,
  technicienName,
  type InterventionNature,
} from "@/lib/interventions";
import { fetchPrestataires } from "@/lib/prestataires";

type Search = {
  demande?: string;
  equipement?: string;
  description?: string;
};

export const Route = createFileRoute("/interventions/nouvelle")({
  component: NouvelleIntervention,
  validateSearch: (search: Record<string, unknown>): Search => ({
    demande: typeof search.demande === "string" ? search.demande : undefined,
    equipement:
      typeof search.equipement === "string" ? search.equipement : undefined,
    description:
      typeof search.description === "string" ? search.description : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Planifier une intervention — SYGMA" },
      {
        name: "description",
        content:
          "Planifiez une intervention : équipement, nature, date, techniciens affectés et durée estimée.",
      },
      { property: "og:title", content: "Planifier une intervention — SYGMA" },
      {
        property: "og:description",
        content: "Créez et planifiez une intervention de maintenance SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function NouvelleIntervention() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { currentEtablissementId } = useAuth();

  const [equipementId, setEquipementId] = useState(search.equipement ?? "");
  const [description, setDescription] = useState(search.description ?? "");
  const [nature, setNature] = useState<InterventionNature>(
    search.demande ? "curative" : "preventive",
  );
  const [localisation, setLocalisation] = useState("");
  const [datePlanifiee, setDatePlanifiee] = useState("");
  const [dureeEstimee, setDureeEstimee] = useState("");
  const [techniciens, setTechniciens] = useState<string[]>([]);
  const [prestataireId, setPrestataireId] = useState("none");

  const { data: prestataires } = useQuery({
    queryKey: ["prestataires", currentEtablissementId],
    queryFn: () => fetchPrestataires(currentEtablissementId),
  });

  const { data: equipements } = useQuery({
    queryKey: ["equipements-select", currentEtablissementId],
    queryFn: async () => {
      let q = supabase
        .from("equipements")
        .select("id, reference, designation, zone, etablissement_id")
        .order("reference");
      if (currentEtablissementId)
        q = q.eq("etablissement_id", currentEtablissementId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: techs } = useQuery({
    queryKey: ["techniciens"],
    queryFn: fetchTechniciens,
  });

  const equipement = equipements?.find((e) => e.id === equipementId);

  useEffect(() => {
    if (equipement?.zone && !localisation) setLocalisation(equipement.zone);
  }, [equipement, localisation]);

  const create = useMutation({
    mutationFn: async () => {
      const etablissementId =
        equipement?.etablissement_id ?? currentEtablissementId;
      if (!etablissementId) throw new Error("Établissement introuvable");

      const { data, error } = await supabase
        .from("interventions")
        .insert({
          demande_id: search.demande ?? null,
          equipement_id: equipementId || null,
          etablissement_id: etablissementId,
          description,
          nature,
          localisation: localisation || null,
          date_appel: new Date().toISOString(),
          date_planifiee: fromLocalInput(datePlanifiee),
          duree_estimee_minutes: dureeEstimee ? Number(dureeEstimee) : null,
          prestataire_id: prestataireId === "none" ? null : prestataireId,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (techniciens.length > 0) {
        const { error: e2 } = await supabase
          .from("intervention_techniciens")
          .insert(
            techniciens.map((t) => ({
              intervention_id: data.id,
              technicien_id: t,
            })),
          );
        if (e2) throw e2;
      }
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Intervention planifiée");
      navigate({ to: "/interventions/$id", params: { id } });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Création impossible"),
  });

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/interventions">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux interventions
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Planifier une intervention
      </h1>
      {search.demande && (
        <p className="text-sm text-muted-foreground">
          Créée à partir d'une demande d'intervention validée.
        </p>
      )}

      <form
        className="mt-6 grid max-w-2xl gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-2">
          <Label>Équipement</Label>
          <Select value={equipementId} onValueChange={setEquipementId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un équipement" />
            </SelectTrigger>
            <SelectContent>
              {(equipements ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.reference} — {e.designation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nature</Label>
            <Select
              value={nature}
              onValueChange={(v) => setNature(v as InterventionNature)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATURES_INTERVENTION.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="localisation">Localisation</Label>
            <Input
              id="localisation"
              value={localisation}
              onChange={(e) => setLocalisation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date et heure planifiées</Label>
            <Input
              id="date"
              type="datetime-local"
              value={datePlanifiee}
              onChange={(e) => setDatePlanifiee(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duree">Durée estimée (minutes)</Label>
            <Input
              id="duree"
              type="number"
              min={0}
              value={dureeEstimee}
              onChange={(e) => setDureeEstimee(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Technicien(s) affecté(s)</Label>
          <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
            {(techs ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun technicien disponible.
              </p>
            )}
            {(techs ?? []).map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={techniciens.includes(t.id)}
                  onCheckedChange={(c) =>
                    setTechniciens((prev) =>
                      c ? [...prev, t.id] : prev.filter((x) => x !== t.id),
                    )
                  }
                />
                {technicienName(t)}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Prestataire externe (optionnel)</Label>
          <Select value={prestataireId} onValueChange={setPrestataireId}>
            <SelectTrigger>
              <SelectValue placeholder="Aucun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun (équipe interne)</SelectItem>
              {(prestataires ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.raison_sociale}
                  {p.specialite ? ` — ${p.specialite}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Planifier
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/interventions">Annuler</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
