import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Paperclip } from "lucide-react";
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
import {
  PRIORITES_DI,
  uploadPieceJointe,
  type DemandePriorite,
} from "@/lib/demandes";

export function DemandeForm() {
  const { user, etablissements, currentEtablissementId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [etablissementId, setEtablissementId] = useState(
    currentEtablissementId ?? "",
  );
  const [equipementId, setEquipementId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState<DemandePriorite>("moyenne");
  const [localisation, setLocalisation] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const { data: equipements } = useQuery({
    queryKey: ["equipements-select", etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipements")
        .select("id, reference, designation, zone")
        .eq("etablissement_id", etablissementId)
        .order("reference");
      if (error) throw error;
      return data;
    },
    enabled: !!etablissementId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Session expirée");
      const pieces: string[] = [];
      for (const f of files) pieces.push(await uploadPieceJointe(f));

      const { data, error } = await supabase
        .from("demandes_intervention")
        .insert({
          etablissement_id: etablissementId,
          equipement_id: equipementId || null,
          description: description.trim(),
          priorite,
          localisation: localisation.trim() || null,
          demandeur_id: user.id,
          pieces_jointes: pieces,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast.success("Demande d'intervention créée");
      navigate({ to: "/demandes/$id", params: { id } });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Création impossible"),
  });

  const canSubmit = etablissementId && description.trim().length > 0;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) {
          toast.error("Établissement et description sont requis");
          return;
        }
        mutation.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Établissement *</Label>
          <Select
            value={etablissementId}
            onValueChange={(v) => {
              setEtablissementId(v);
              setEquipementId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un établissement" />
            </SelectTrigger>
            <SelectContent>
              {etablissements.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Équipement concerné</Label>
          <Select
            value={equipementId}
            onValueChange={(v) => {
              setEquipementId(v);
              const eq = equipements?.find((x) => x.id === v);
              if (eq?.zone && !localisation) setLocalisation(eq.zone);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucun / non identifié" />
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
          <Label>Priorité</Label>
          <Select
            value={priorite}
            onValueChange={(v) => setPriorite(v as DemandePriorite)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITES_DI.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
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
            placeholder="Atelier B — ligne 2"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description du problème *</Label>
        <Textarea
          id="description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Décrivez la panne ou le besoin d'intervention…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pieces">Pièces jointes</Label>
        <Input
          id="pieces"
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="max-w-md"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          {files.length > 0
            ? `${files.length} fichier(s) sélectionné(s)`
            : "Photos ou documents (PDF, Office)"}
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Créer la demande
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/demandes" })}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
