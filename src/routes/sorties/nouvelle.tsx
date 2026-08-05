import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fetchPieces } from "@/lib/stocks";
import { DS_URGENCES, creerDemandeSortie, type DsUrgence } from "@/lib/sorties";

export const Route = createFileRoute("/sorties/nouvelle")({
  component: NouvelleDemandeSortie,
  head: () => ({
    meta: [
      { title: "Demander des pièces — SYGMA" },
      {
        name: "description",
        content:
          "Créez une demande de sortie de pièces liée à une intervention, avec niveau d'urgence et justification.",
      },
      { property: "og:title", content: "Demander des pièces — SYGMA" },
      {
        property: "og:description",
        content: "Formulaire de demande de sortie de pièces SYGMA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type LigneForm = { piece_id: string; quantite: string };

function NouvelleDemandeSortie() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, currentEtablissementId, etablissements } = useAuth();

  const [interventionId, setInterventionId] = useState("none");
  const [urgence, setUrgence] = useState<DsUrgence>("moyenne");
  const [justification, setJustification] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>([
    { piece_id: "", quantite: "1" },
  ]);

  const piecesQ = useQuery({ queryKey: ["pieces"], queryFn: fetchPieces });

  const interventionsQ = useQuery({
    queryKey: ["interventions-ouvertes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interventions")
        .select("id, description, equipement_id, etablissement_id, statut")
        .neq("statut", "signee")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const interventions = interventionsQ.data ?? [];
  const intervention = interventions.find((i) => i.id === interventionId);

  const etablissementId =
    intervention?.etablissement_id ??
    currentEtablissementId ??
    etablissements[0]?.id ??
    null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Session expirée");
      if (!etablissementId)
        throw new Error("Aucun établissement rattaché à votre compte");
      const items = lignes
        .filter((l) => l.piece_id && Number(l.quantite) > 0)
        .map((l) => ({ piece_id: l.piece_id, quantite: Number(l.quantite) }));
      if (items.length === 0) throw new Error("Ajoutez au moins une pièce");
      return creerDemandeSortie({
        technicien_id: user.id,
        etablissement_id: etablissementId,
        intervention_id: intervention?.id ?? null,
        equipement_id: intervention?.equipement_id ?? null,
        urgence,
        justification: justification.trim() || null,
        lignes: items,
      });
    },
    onSuccess: (id) => {
      toast.success("Demande de sortie créée");
      void queryClient.invalidateQueries({ queryKey: ["demandes-sortie"] });
      void navigate({ to: "/sorties/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pieces = piecesQ.data ?? [];

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/sorties">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux sorties de pièces
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Demander des pièces
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Votre demande sera validée par un responsable maintenance puis traitée
        par le gestionnaire de stock.
      </p>

      <div className="mt-6 max-w-3xl space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Intervention concernée</Label>
            <Select value={interventionId} onValueChange={setInterventionId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sans intervention</SelectItem>
                {interventions.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.description.slice(0, 60)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              L'équipement de l'intervention justifie automatiquement le besoin.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Niveau d'urgence</Label>
            <Select
              value={urgence}
              onValueChange={(v) => setUrgence(v as DsUrgence)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DS_URGENCES.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Pièces demandées</Label>
          {lignes.map((l, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1 space-y-1">
                <Select
                  value={l.piece_id}
                  onValueChange={(v) =>
                    setLignes((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, piece_id: v } : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une pièce" />
                  </SelectTrigger>
                  <SelectContent>
                    {pieces.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code_article} — {p.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="w-28"
                type="number"
                min="0"
                step="0.01"
                value={l.quantite}
                onChange={(e) =>
                  setLignes((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, quantite: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={lignes.length === 1}
                onClick={() =>
                  setLignes((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLignes((prev) => [...prev, { piece_id: "", quantite: "1" }])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une pièce
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="justification">Justification du besoin</Label>
          <Textarea
            id="justification"
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Ex. : remplacement du roulement défectueux sur le convoyeur"
          />
        </div>

        <Button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Envoyer la demande
        </Button>
      </div>
    </div>
  );
}
