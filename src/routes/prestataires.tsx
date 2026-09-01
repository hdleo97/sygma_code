import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import {
  contratLabel,
  deletePrestataire,
  fetchPrestataires,
  upsertPrestataire,
  type Prestataire,
} from "@/lib/prestataires";

export const Route = createFileRoute("/prestataires")({
  component: PrestatairesPage,
  head: () => ({
    meta: [
      { title: "Prestataires externes — SYGMA" },
      {
        name: "description",
        content:
          "Annuaire des prestataires de maintenance externes : spécialité, zone d'intervention et contrat.",
      },
      { property: "og:title", content: "Prestataires externes — SYGMA" },
      {
        property: "og:description",
        content:
          "Gérez les sociétés prestataires et leurs informations contractuelles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type FormState = {
  id?: string;
  raison_sociale: string;
  contact_nom: string;
  contact_email: string;
  contact_telephone: string;
  specialite: string;
  zone_intervention: string;
  contrat_reference: string;
  contrat_debut: string;
  contrat_fin: string;
  contrat_notes: string;
};

const EMPTY: FormState = {
  raison_sociale: "",
  contact_nom: "",
  contact_email: "",
  contact_telephone: "",
  specialite: "",
  zone_intervention: "",
  contrat_reference: "",
  contrat_debut: "",
  contrat_fin: "",
  contrat_notes: "",
};

function PrestatairesPage() {
  const { currentEtablissementId, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const canManage = hasAnyRole(["super_admin", "responsable_maintenance"]);

  const { data, isLoading } = useQuery({
    queryKey: ["prestataires", currentEtablissementId],
    queryFn: () => fetchPrestataires(currentEtablissementId),
  });

  const save = useMutation({
    mutationFn: async (f: FormState) =>
      upsertPrestataire({
        id: f.id,
        raison_sociale: f.raison_sociale,
        contact_nom: f.contact_nom || null,
        contact_email: f.contact_email || null,
        contact_telephone: f.contact_telephone || null,
        specialite: f.specialite || null,
        zone_intervention: f.zone_intervention || null,
        contrat_reference: f.contrat_reference || null,
        contrat_debut: f.contrat_debut || null,
        contrat_fin: f.contrat_fin || null,
        contrat_notes: f.contrat_notes || null,
        etablissement_id: f.id ? undefined : currentEtablissementId,
      }),
    onSuccess: () => {
      toast.success("Prestataire enregistré");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["prestataires"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible"),
  });

  const remove = useMutation({
    mutationFn: deletePrestataire,
    onSuccess: () => {
      toast.success("Prestataire supprimé");
      queryClient.invalidateQueries({ queryKey: ["prestataires"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Suppression impossible"),
  });

  const openEdit = (p: Prestataire) =>
    setForm({
      id: p.id,
      raison_sociale: p.raison_sociale,
      contact_nom: p.contact_nom ?? "",
      contact_email: p.contact_email ?? "",
      contact_telephone: p.contact_telephone ?? "",
      specialite: p.specialite ?? "",
      zone_intervention: p.zone_intervention ?? "",
      contrat_reference: p.contrat_reference ?? "",
      contrat_debut: p.contrat_debut ?? "",
      contrat_fin: p.contrat_fin ?? "",
      contrat_notes: p.contrat_notes ?? "",
    });

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Prestataires
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Sociétés externes pouvant être affectées aux demandes et
            interventions.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setForm({ ...EMPTY })}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau prestataire
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (data ?? []).length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Aucun prestataire enregistré.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Raison sociale</th>
                <th className="px-4 py-3">Spécialité</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Contrat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {p.raison_sociale}
                    {!p.actif && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (inactif)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.specialite ?? "—"}</td>
                  <td className="px-4 py-3">{p.zone_intervention ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[p.contact_nom, p.contact_email, p.contact_telephone]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {contratLabel(p)}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(p)}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Modifier le prestataire" : "Nouveau prestataire"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="raison">Raison sociale</Label>
                <Input
                  id="raison"
                  value={form.raison_sociale}
                  onChange={(e) =>
                    setForm({ ...form, raison_sociale: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="specialite">Spécialité</Label>
                  <Input
                    id="specialite"
                    value={form.specialite}
                    onChange={(e) =>
                      setForm({ ...form, specialite: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zone">Zone d'intervention</Label>
                  <Input
                    id="zone"
                    value={form.zone_intervention}
                    onChange={(e) =>
                      setForm({ ...form, zone_intervention: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnom">Contact</Label>
                  <Input
                    id="cnom"
                    value={form.contact_nom}
                    onChange={(e) =>
                      setForm({ ...form, contact_nom: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cmail">Email</Label>
                  <Input
                    id="cmail"
                    type="email"
                    value={form.contact_email}
                    onChange={(e) =>
                      setForm({ ...form, contact_email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ctel">Téléphone</Label>
                  <Input
                    id="ctel"
                    value={form.contact_telephone}
                    onChange={(e) =>
                      setForm({ ...form, contact_telephone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cref">Référence contrat</Label>
                  <Input
                    id="cref"
                    value={form.contrat_reference}
                    onChange={(e) =>
                      setForm({ ...form, contrat_reference: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cdeb">Début de contrat</Label>
                  <Input
                    id="cdeb"
                    type="date"
                    value={form.contrat_debut}
                    onChange={(e) =>
                      setForm({ ...form, contrat_debut: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfin">Fin de contrat</Label>
                  <Input
                    id="cfin"
                    type="date"
                    value={form.contrat_fin}
                    onChange={(e) =>
                      setForm({ ...form, contrat_fin: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnotes">Informations contractuelles</Label>
                <Textarea
                  id="cnotes"
                  rows={3}
                  value={form.contrat_notes}
                  onChange={(e) =>
                    setForm({ ...form, contrat_notes: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Annuler
            </Button>
            <Button
              disabled={save.isPending || !form?.raison_sociale}
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
