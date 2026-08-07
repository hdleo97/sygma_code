import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SignaturePad } from "@/components/signature-pad";
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
import { enregistrerVisite, type PointControle } from "@/lib/preventif";
import { fetchChecklist } from "@/lib/rapport-phases";

export const Route = createFileRoute("/preventif/visite")({
  component: VisiteQuotidiennePage,
  head: () => ({
    meta: [
      { title: "Visite quotidienne — SYGMA" },
      {
        name: "description",
        content:
          "Formulaire simplifié de visite quotidienne : checklist de vérification, observations et signature tactile.",
      },
      { property: "og:title", content: "Visite quotidienne — SYGMA" },
      {
        property: "og:description",
        content:
          "Réalisez et signez une visite quotidienne d'équipement en quelques secondes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type EquipementLite = {
  id: string;
  reference: string;
  designation: string;
  categorie: string | null;
  etablissement_id: string;
  zone: string | null;
  marque: string | null;
  modele: string | null;
  numero_serie: string | null;
};

function VisiteQuotidiennePage() {
  const navigate = useNavigate();
  const { user, profil, etablissements } = useAuth();

  const [equipementId, setEquipementId] = useState("");
  const [points, setPoints] = useState<PointControle[]>([]);
  const [libreLibelle, setLibreLibelle] = useState("");
  const [observations, setObservations] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  const nomSignataire =
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    user?.email ||
    "Technicien";

  const equipementsQ = useQuery({
    queryKey: ["equipements-visite"],
    queryFn: async (): Promise<EquipementLite[]> => {
      const { data, error } = await supabase
        .from("equipements")
        .select(
          "id, reference, designation, categorie, etablissement_id, zone, marque, modele, numero_serie",
        )
        .order("reference");
      if (error) throw error;
      return data ?? [];
    },
  });

  const equipement = useMemo(
    () => (equipementsQ.data ?? []).find((e) => e.id === equipementId) ?? null,
    [equipementsQ.data, equipementId],
  );

  const checklistQ = useQuery({
    queryKey: ["checklist-visite", equipement?.categorie ?? null],
    queryFn: () => fetchChecklist(equipement?.categorie ?? null),
    enabled: !!equipement,
  });

  useEffect(() => {
    if (!checklistQ.data) return;
    setPoints(
      checklistQ.data.map((o) => ({
        operation_id: o.id,
        libelle: o.libelle,
        conforme: false,
        commentaire: "",
      })),
    );
  }, [checklistQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!equipement || !user || !signature)
        throw new Error("Informations incomplètes");
      return enregistrerVisite({
        equipement_id: equipement.id,
        etablissement_id: equipement.etablissement_id,
        technicien_id: user.id,
        observations: observations.trim() || null,
        signature,
        signature_nom: nomSignataire,
        points,
      });
    },
    onSuccess: () => {
      toast.success("Visite enregistrée et signée");
      void navigate({ to: "/preventif" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const etabNom = equipement
    ? (etablissements.find((e) => e.id === equipement.etablissement_id)?.nom ??
      "—")
    : "—";

  return (
    <div className="p-4 sm:p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/preventif">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au préventif
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Visite quotidienne
      </h1>
      <p className="text-sm text-muted-foreground">
        Contrôle allégé : informations générales, checklist, observations et
        signature.
      </p>

      <div className="mt-6 max-w-3xl space-y-6">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Informations générales</h2>
          <div className="space-y-2">
            <Label>Équipement *</Label>
            <Select value={equipementId} onValueChange={setEquipementId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un équipement" />
              </SelectTrigger>
              <SelectContent>
                {(equipementsQ.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.reference} — {e.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {equipement && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  Établissement
                </dt>
                <dd>{etabNom}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  Localisation
                </dt>
                <dd>{equipement.zone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  Marque / modèle
                </dt>
                <dd>
                  {[equipement.marque, equipement.modele]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  N° de série
                </dt>
                <dd>{equipement.numero_serie ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  Date
                </dt>
                <dd>{new Date().toLocaleString("fr-FR")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  Intervenant
                </dt>
                <dd>{nomSignataire}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">
            Checklist de vérification
          </h2>
          {!equipement && (
            <p className="text-sm text-muted-foreground">
              Sélectionnez d'abord un équipement.
            </p>
          )}
          {equipement && checklistQ.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          )}
          <div className="space-y-2">
            {points.map((p, idx) => (
              <div
                key={`${p.operation_id ?? "libre"}-${idx}`}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <Checkbox
                  id={`pt-${idx}`}
                  checked={p.conforme}
                  onCheckedChange={(v) =>
                    setPoints((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, conforme: v === true } : x,
                      ),
                    )
                  }
                />
                <Label htmlFor={`pt-${idx}`} className="flex-1 cursor-pointer">
                  {p.libelle}
                </Label>
                <Input
                  value={p.commentaire}
                  placeholder="Commentaire"
                  className="h-8 w-full sm:w-56"
                  onChange={(e) =>
                    setPoints((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, commentaire: e.target.value } : x,
                      ),
                    )
                  }
                />
                {!p.operation_id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer le point"
                    onClick={() =>
                      setPoints((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {equipement && (
            <div className="mt-3 flex gap-2">
              <Input
                value={libreLibelle}
                placeholder="Ajouter un point de contrôle libre"
                onChange={(e) => setLibreLibelle(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!libreLibelle.trim()}
                onClick={() => {
                  setPoints((prev) => [
                    ...prev,
                    {
                      operation_id: null,
                      libelle: libreLibelle.trim(),
                      conforme: false,
                      commentaire: "",
                    },
                  ]);
                  setLibreLibelle("");
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Observations</h2>
          <Textarea
            rows={4}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Anomalies constatées, remarques…"
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Signature</h2>
          <SignaturePad
            label="Signature de l'intervenant"
            value={signature}
            signedBy={signature ? nomSignataire : null}
            onSign={setSignature}
            disabled={!equipement}
          />
        </section>

        <div className="flex gap-2 pb-6">
          <Button
            disabled={!equipement || !signature || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Enregistrer la visite
          </Button>
          <Button asChild variant="outline">
            <Link to="/preventif">Annuler</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
