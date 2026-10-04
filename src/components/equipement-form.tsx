import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EquipementPhoto } from "@/components/equipement-photo";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  STATUTS,
  uploadPhoto,
  type Equipement,
  type EquipementStatut,
} from "@/lib/equipements";

type FormState = {
  reference: string;
  designation: string;
  categorie: string;
  etablissement_id: string;
  zone: string;
  marque: string;
  modele: string;
  numero_serie: string;
  date_mise_en_service: string;
  fournisseur: string;
  statut: EquipementStatut;
};

function initialState(
  equipement: Equipement | undefined,
  fallbackEtab: string | null,
): FormState {
  return {
    reference: equipement?.reference ?? "",
    designation: equipement?.designation ?? "",
    categorie: equipement?.categorie ?? "",
    etablissement_id: equipement?.etablissement_id ?? fallbackEtab ?? "",
    zone: equipement?.zone ?? "",
    marque: equipement?.marque ?? "",
    modele: equipement?.modele ?? "",
    numero_serie: equipement?.numero_serie ?? "",
    date_mise_en_service: equipement?.date_mise_en_service ?? "",
    fournisseur: equipement?.fournisseur ?? "",
    statut: equipement?.statut ?? "en_service",
  };
}

export function EquipementForm({ equipement }: { equipement?: Equipement }) {
  const { etablissements, currentEtablissementId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(() =>
    initialState(equipement, currentEtablissementId),
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      let photo_path = equipement?.photo_path ?? null;
      if (file) photo_path = await uploadPhoto(file);

      const payload = {
        reference: form.reference.trim(),
        designation: form.designation.trim(),
        categorie: form.categorie.trim() || null,
        etablissement_id: form.etablissement_id,
        zone: form.zone.trim() || null,
        marque: form.marque.trim() || null,
        modele: form.modele.trim() || null,
        numero_serie: form.numero_serie.trim() || null,
        date_mise_en_service: form.date_mise_en_service || null,
        fournisseur: form.fournisseur.trim() || null,
        statut: form.statut,
        photo_path,
      };

      if (equipement) {
        const { data, error } = await supabase
          .from("equipements")
          .update(payload)
          .eq("id", equipement.id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }

      const { data, error } = await supabase
        .from("equipements")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["equipements"] });
      queryClient.invalidateQueries({ queryKey: ["equipement", id] });
      toast.success(equipement ? "Équipement mis à jour" : "Équipement créé");
      navigate({ to: "/equipements/$id", params: { id } });
    },
    onError: (e: unknown) => {
      toast.error(
        e instanceof Error ? e.message : "Enregistrement impossible",
      );
    },
  });

  const canSubmit =
    form.reference.trim() && form.designation.trim() && form.etablissement_id;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) {
          toast.error("Référence, désignation et établissement sont requis");
          return;
        }
        mutation.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reference">Référence *</Label>
          <Input
            id="reference"
            value={form.reference}
            onChange={(e) => set("reference", e.target.value)}
            placeholder="EQ-0001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="designation">Désignation *</Label>
          <Input
            id="designation"
            value={form.designation}
            onChange={(e) => set("designation", e.target.value)}
            placeholder="Compresseur d'air"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="categorie">Catégorie / famille</Label>
          <Input
            id="categorie"
            value={form.categorie}
            onChange={(e) => set("categorie", e.target.value)}
            list="ref-categories"
            placeholder="Utilités"
          />
        </div>
        <div className="space-y-2">
          <Label>Établissement *</Label>
          <Select
            value={form.etablissement_id}
            onValueChange={(v) => set("etablissement_id", v)}
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
          <Label htmlFor="zone">Zone / localisation</Label>
          <Input
            id="zone"
            value={form.zone}
            onChange={(e) => set("zone", e.target.value)}
            list="ref-zones"
          />
          <datalist id="ref-zones">
            {(refs ?? []).filter((r) => r.type === "zone" && r.actif).map((r) => (
              <option key={r.id} value={r.libelle} />
            ))}
          </datalist>
          <datalist id="ref-categories">
            {(refs ?? []).filter((r) => r.type === "categorie_equipement" && r.actif).map((r) => (
              <option key={r.id} value={r.libelle} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select
            value={form.statut}
            onValueChange={(v) => set("statut", v as EquipementStatut)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="marque">Marque</Label>
          <Input
            id="marque"
            value={form.marque}
            onChange={(e) => set("marque", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modele">Modèle</Label>
          <Input
            id="modele"
            value={form.modele}
            onChange={(e) => set("modele", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="numero_serie">Numéro de série</Label>
          <Input
            id="numero_serie"
            value={form.numero_serie}
            onChange={(e) => set("numero_serie", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_mise_en_service">Date de mise en service</Label>
          <Input
            id="date_mise_en_service"
            type="date"
            value={form.date_mise_en_service}
            onChange={(e) => set("date_mise_en_service", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fournisseur">Fournisseur</Label>
          <Input
            id="fournisseur"
            value={form.fournisseur}
            onChange={(e) => set("fournisseur", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo">Photo</Label>
        <div className="flex items-center gap-4">
          {preview ? (
            <img
              src={preview}
              alt="Aperçu de la photo sélectionnée"
              className="h-24 w-24 rounded-md border border-border object-cover"
            />
          ) : (
            <EquipementPhoto
              path={equipement?.photo_path ?? null}
              alt={equipement?.designation ?? "Équipement"}
              className="h-24 w-24"
            />
          )}
          <div>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              className="max-w-xs"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Upload className="h-3 w-3" /> JPEG ou PNG, 5 Mo maximum
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {equipement ? "Enregistrer" : "Créer l'équipement"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            equipement
              ? navigate({
                  to: "/equipements/$id",
                  params: { id: equipement.id },
                })
              : navigate({ to: "/equipements" })
          }
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
